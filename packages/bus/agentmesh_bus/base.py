"""Interface shared by every bus adapter.

Why an abstraction at all? RabbitMQ is the right default for a small platform (cheap,
free tier available, excellent routing), but a team that already runs Kafka should be
able to swap it without touching agent code. The runtime only ever calls
`publish()` and `subscribe()`; everything broker specific lives in one adapter file.
"""

from __future__ import annotations

import asyncio
import json
from abc import ABC, abstractmethod
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from typing import Any, Self

EXCHANGE_NAME = "agentmesh.events"
KAFKA_TOPIC = "agentmesh.events"


@dataclass(slots=True)
class Envelope:
    """A message as received from the bus."""

    routing_key: str
    payload: dict[str, Any]
    headers: dict[str, str] = field(default_factory=dict)

    @classmethod
    def from_bytes(cls, routing_key: str, body: bytes, headers: dict[str, Any] | None = None) -> Envelope:
        return cls(
            routing_key=routing_key,
            payload=json.loads(body.decode("utf-8")),
            headers={k: str(v) for k, v in (headers or {}).items()},
        )


class Subscription:
    """An async iterator over envelopes plus `get()` for tests.

    Adapters push into `_queue`; consumers use `async for env in sub` or `await sub.get()`.
    Acts as an async context manager so the underlying queue/consumer is torn down on exit.
    """

    def __init__(self, pattern: str, on_close: Callable[[Subscription], Awaitable[None]]) -> None:
        self.pattern = pattern
        self._queue: asyncio.Queue[Envelope | None] = asyncio.Queue()
        self._on_close = on_close
        self._closed = False

    def _push(self, env: Envelope) -> None:
        if not self._closed:
            self._queue.put_nowait(env)

    async def get(self, timeout: float | None = 5.0) -> Envelope:
        env = await asyncio.wait_for(self._queue.get(), timeout=timeout)
        if env is None:
            raise StopAsyncIteration
        return env

    def __aiter__(self) -> Self:
        return self

    async def __anext__(self) -> Envelope:
        env = await self._queue.get()
        if env is None:
            raise StopAsyncIteration
        return env

    async def close(self) -> None:
        if self._closed:
            return
        self._closed = True
        self._queue.put_nowait(None)
        await self._on_close(self)

    async def __aenter__(self) -> Self:
        return self

    async def __aexit__(self, *exc: object) -> None:
        await self.close()


class EventBus(ABC):
    """Publish/subscribe over topic-style routing keys."""

    @abstractmethod
    async def connect(self) -> None: ...

    @abstractmethod
    async def publish(
        self, routing_key: str, payload: dict[str, Any], headers: dict[str, str] | None = None
    ) -> None: ...

    @abstractmethod
    def subscribe(self, pattern: str, *, queue_name: str | None = None) -> Subscription:
        """Return a Subscription for routing keys matching an AMQP-style pattern.

        `queue_name` opts into a durable, shared queue (competing consumers). Without it the
        adapter creates an exclusive auto-delete queue so each subscriber sees every event.
        Adapters start the consumer lazily so this call can stay synchronous and ergonomic:
        `async with bus.subscribe("run.#") as sub:`.
        """

    @abstractmethod
    async def close(self) -> None: ...


def topic_matches(pattern: str, routing_key: str) -> bool:
    """AMQP topic matching: `*` is exactly one word, `#` is zero or more words.

    Implemented here so the in-memory and Kafka adapters behave exactly like RabbitMQ.
    """

    def match(p: list[str], k: list[str]) -> bool:
        if not p:
            return not k
        head, rest = p[0], p[1:]
        if head == "#":
            # '#' absorbs zero or more words: try every split point.
            return any(match(rest, k[i:]) for i in range(len(k) + 1))
        if not k:
            return False
        if head == "*" or head == k[0]:
            return match(rest, k[1:])
        return False

    return match(pattern.split("."), routing_key.split("."))
