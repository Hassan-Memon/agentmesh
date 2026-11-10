"""Kafka / Redpanda adapter built on aiokafka.

Kafka has no topic wildcards and no per-message routing, so every event goes to one
topic (`agentmesh.events`) with the routing key as the record key. Subscribers filter
by pattern client-side using the same matcher as the in-memory bus. Partitioning by
key means all events for one run land on the same partition and stay ordered.
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

from .base import KAFKA_TOPIC, Envelope, EventBus, Subscription, topic_matches

log = logging.getLogger(__name__)


class KafkaBus(EventBus):
    def __init__(self, bootstrap_servers: str, topic: str = KAFKA_TOPIC) -> None:
        self._servers = bootstrap_servers
        self._topic = topic
        self._producer: Any = None
        self._tasks: dict[int, asyncio.Task[None]] = {}

    async def connect(self) -> None:
        from aiokafka import AIOKafkaProducer

        self._producer = AIOKafkaProducer(
            bootstrap_servers=self._servers,
            value_serializer=lambda v: json.dumps(v, default=str).encode("utf-8"),
            key_serializer=lambda k: k.encode("utf-8"),
            acks="all",  # wait for in-sync replicas: durability over latency
        )
        await self._producer.start()
        log.info("connected to Kafka at %s", self._servers)

    async def publish(
        self, routing_key: str, payload: dict[str, Any], headers: dict[str, str] | None = None
    ) -> None:
        if self._producer is None:
            raise RuntimeError("KafkaBus.publish called before connect()")
        kafka_headers = [(k, v.encode("utf-8")) for k, v in (headers or {}).items()]
        await self._producer.send_and_wait(self._topic, value=payload, key=routing_key, headers=kafka_headers)

    def subscribe(self, pattern: str, *, queue_name: str | None = None) -> Subscription:
        sub = Subscription(pattern, on_close=self._cancel)
        self._tasks[id(sub)] = asyncio.get_running_loop().create_task(self._consume(sub, pattern, queue_name))
        return sub

    async def _consume(self, sub: Subscription, pattern: str, group_id: str | None) -> None:
        from aiokafka import AIOKafkaConsumer

        consumer = AIOKafkaConsumer(
            self._topic,
            bootstrap_servers=self._servers,
            group_id=group_id,  # None => standalone consumer that sees everything
            auto_offset_reset="latest",
            enable_auto_commit=True,
        )
        await consumer.start()
        try:
            async for record in consumer:
                key = (record.key or b"").decode("utf-8")
                if topic_matches(pattern, key):
                    headers = {k: v.decode("utf-8") for k, v in (record.headers or [])}
                    sub._push(Envelope.from_bytes(key, record.value, headers))
        finally:
            await consumer.stop()

    async def _cancel(self, sub: Subscription) -> None:
        task = self._tasks.pop(id(sub), None)
        if task:
            task.cancel()

    async def close(self) -> None:
        for task in self._tasks.values():
            task.cancel()
        self._tasks.clear()
        if self._producer is not None:
            await self._producer.stop()
            self._producer = None
