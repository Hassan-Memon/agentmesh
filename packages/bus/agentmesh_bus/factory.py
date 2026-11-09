"""Pick an adapter from a URL so deployments switch brokers with one env var."""

from __future__ import annotations

from urllib.parse import urlparse

from .base import EventBus
from .memory import InMemoryBus


def build_bus(url: str | None) -> EventBus:
    """`memory://` (default), `amqp://user:pass@host/`, or `kafka://host:9092,host2:9092`."""
    if not url or url.startswith("memory"):
        return InMemoryBus()
    scheme = urlparse(url).scheme
    if scheme in {"amqp", "amqps"}:
        from .rabbitmq import RabbitMQBus

        return RabbitMQBus(url)
    if scheme == "kafka":
        from .kafka import KafkaBus

        servers = url[len("kafka://") :].rstrip("/")
        return KafkaBus(servers)
    raise ValueError(f"unsupported bus url scheme: {scheme!r}")
