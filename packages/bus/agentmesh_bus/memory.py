"""In-process bus for tests and single-process demos.

Delivery guarantee: a subscriber receives an event only if it was attached when
publish() ran. That is exactly what unit tests want and nothing more.
"""

from __future__ import annotations

from typing import Any

from .base import Envelope, EventBus, Subscription, topic_matches


class InMemoryBus(EventBus):
    def __init__(self) -> None:
        self._subs: list[Subscription] = []
        self.published: list[Envelope] = []  # handy for assertions in tests

    async def connect(self) -> None:  # nothing to connect to
        return None

    async def publish(
        self, routing_key: str, payload: dict[str, Any], headers: dict[str, str] | None = None
    ) -> None:
        env = Envelope(routing_key=routing_key, payload=payload, headers=headers or {})
        self.published.append(env)
        for sub in list(self._subs):
            if topic_matches(sub.pattern, routing_key):
                sub._push(env)

    def subscribe(self, pattern: str, *, queue_name: str | None = None) -> Subscription:
        sub = Subscription(pattern, on_close=self._remove)
        self._subs.append(sub)
        return sub

    async def _remove(self, sub: Subscription) -> None:
        if sub in self._subs:
            self._subs.remove(sub)

    async def close(self) -> None:
        for sub in list(self._subs):
            await sub.close()
