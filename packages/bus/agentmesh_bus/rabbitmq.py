"""RabbitMQ adapter built on aio-pika.

Topology:
  exchange  agentmesh.events            (topic, durable)
  queue     <exclusive, auto-delete>    bound with the subscriber's pattern, or
            <queue_name, durable>       for competing consumers

Messages are published persistent (delivery_mode=2) so a broker restart does not drop
events that were already accepted. Consumers ack after the envelope is queued locally;
that is "at least once" delivery, so consumers must tolerate duplicates (RunEvent.seq
makes that trivial). See docs/learn/03-concepts/message-brokers-and-delivery-guarantees.md.
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

from .base import EXCHANGE_NAME, Envelope, EventBus, Subscription

log = logging.getLogger(__name__)


class RabbitMQBus(EventBus):
    def __init__(self, url: str) -> None:
        self._url = url
        self._connection: Any = None
        self._channel: Any = None
        self._exchange: Any = None
        self._consumers: dict[int, dict[str, Any]] = {}

    async def connect(self) -> None:
        import aio_pika  # lazy import: the in-memory bus must not need a broker library

        # connect_robust reconnects automatically if the broker restarts.
        self._connection = await aio_pika.connect_robust(self._url)
        self._channel = await self._connection.channel(publisher_confirms=True)
        self._exchange = await self._channel.declare_exchange(
            EXCHANGE_NAME, aio_pika.ExchangeType.TOPIC, durable=True
        )
        log.info("connected to RabbitMQ at %s", self._url.split("@")[-1])

    async def publish(
        self, routing_key: str, payload: dict[str, Any], headers: dict[str, str] | None = None
    ) -> None:
        import aio_pika

        if self._exchange is None:
            raise RuntimeError("RabbitMQBus.publish called before connect()")
        message = aio_pika.Message(
            body=json.dumps(payload, default=str).encode("utf-8"),
            content_type="application/json",
            delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
            headers=dict(headers or {}),
        )
        await self._exchange.publish(message, routing_key=routing_key)

    def subscribe(self, pattern: str, *, queue_name: str | None = None) -> Subscription:
        if self._channel is None:
            raise RuntimeError("RabbitMQBus.subscribe called before connect()")
        sub = Subscription(pattern, on_close=self._cancel)
        # Start the consumer in the background; the Subscription queue buffers until then.
        task = asyncio.get_running_loop().create_task(self._start_consumer(sub, pattern, queue_name))
        self._consumers[id(sub)] = {"task": task, "queue": None, "tag": None}
        return sub

    async def _start_consumer(self, sub: Subscription, pattern: str, queue_name: str | None) -> None:
        if queue_name:
            queue = await self._channel.declare_queue(queue_name, durable=True)
        else:
            queue = await self._channel.declare_queue(exclusive=True, auto_delete=True)
        await queue.bind(self._exchange, routing_key=pattern)

        async def on_message(message: Any) -> None:
            async with message.process():  # acks on success, nacks on exception
                sub._push(Envelope.from_bytes(message.routing_key or "", message.body, message.headers))

        tag = await queue.consume(on_message)
        entry = self._consumers.get(id(sub))
        if entry is not None:
            entry["queue"] = queue
            entry["tag"] = tag

    async def _cancel(self, sub: Subscription) -> None:
        entry = self._consumers.pop(id(sub), None)
        if not entry:
            return
        if entry["queue"] is not None and entry["tag"] is not None:
            try:
                await entry["queue"].cancel(entry["tag"])
            except Exception:  # broker may already be gone
                log.debug("consumer cancel failed", exc_info=True)
        else:
            entry["task"].cancel()

    async def close(self) -> None:
        for sub_id in list(self._consumers):
            entry = self._consumers.pop(sub_id)
            entry["task"].cancel()
        if self._connection is not None:
            await self._connection.close()
            self._connection = None
