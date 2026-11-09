# agentmesh-bus

A tiny async event-bus abstraction with three adapters behind one interface:

| URL scheme | Adapter | Use |
| --- | --- | --- |
| `memory://` | `InMemoryBus` | tests, single-process demos |
| `amqp://`, `amqps://` | `RabbitMQBus` (aio-pika) | default for local and free-tier deploys |
| `kafka://host:port[,host:port]` | `KafkaBus` (aiokafka) | high-volume, replayable event log |

```python
from agentmesh_bus import build_bus

bus = build_bus("memory://")
await bus.connect()
async with bus.subscribe("run.#") as sub:
    await bus.publish("run.123.done", {"run_id": "123"})
    env = await sub.get()
```

Routing keys follow the AMQP topic convention (`run.<run_id>.<event_type>`), and the
`*` / `#` wildcards work identically for every adapter (Kafka filters client-side).
See `docs/learn/03-concepts/message-brokers-and-delivery-guarantees.md` in the repo root.
