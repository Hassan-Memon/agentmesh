"""Broker-agnostic event bus used by the AgentMesh Python runtime.

The gateway (TypeScript) consumes the same RabbitMQ exchange with amqplib, so the
message shape produced here (JSON body, routing key `run.<run_id>.<type>`) is a
contract shared across languages. Keep it boring.
"""

from .base import Envelope, EventBus, Subscription, topic_matches
from .factory import build_bus
from .memory import InMemoryBus

__all__ = [
    "Envelope",
    "EventBus",
    "InMemoryBus",
    "Subscription",
    "build_bus",
    "topic_matches",
]
