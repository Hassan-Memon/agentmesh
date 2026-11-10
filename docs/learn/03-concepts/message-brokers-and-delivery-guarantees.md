# Message brokers and delivery guarantees

**In one line:** a broker is a server that accepts messages from producers and hands them to
consumers later, so the two never need to be up, fast or even aware of each other at the same
time.

## Why AgentMesh has one

The runtime produces RunEvents. Today one consumer wants them (the gateway, for WebSockets).
Tomorrow: an audit log, a cost meter, a Slack notifier. Without a broker, the runtime must
know about and wait for each of them. With a broker, the runtime publishes once to
`agentmesh.events` and forgets. See `packages/bus/agentmesh_bus/rabbitmq.py` for the
publisher and `apps/gateway/src/bus/rabbitmq-consumer.service.ts` for a consumer.

## RabbitMQ vocabulary

- **Exchange**: where producers publish. Ours is a *topic* exchange named `agentmesh.events`.
- **Routing key**: a dotted string on each message, `run.<run_id>.<type>`, for example
  `run.4f2c.node_finished`.
- **Queue**: where messages wait for a consumer. Consumers create queues and *bind* them to
  the exchange with a pattern: `run.#` (everything), `run.*.interrupt` (only interrupts).
  `*` matches one word, `#` matches zero or more.
- **Ack**: the consumer tells the broker "I have handled this"; until then the broker keeps
  it and will redeliver if the consumer dies.

The gateway binds an *exclusive, auto-delete* queue so each gateway replica gets every event
(fan-out). A background worker that must process each event exactly once would instead use
one *named durable* queue shared by all its replicas (competing consumers). The Python bus
exposes both via `subscribe(pattern, queue_name=...)`.

## Delivery guarantees, honestly

| Guarantee | Meaning | Cost |
| --- | --- | --- |
| At most once | Fire and forget; may lose messages | Cheapest, fine for metrics |
| At least once | Never lost, may be duplicated | Consumer must deduplicate |
| Exactly once | Never lost, never duplicated | Needs transactions across broker and database; rare in practice |

AgentMesh uses **at least once**: messages are published persistent (survive broker
restart), consumers ack after handling, and redelivery can produce duplicates. The
defence is cheap: every RunEvent carries a per-run `seq`, the event log upserts on
`(runId, seq)` (`event-log.service.ts`), and the dashboard dedupes by `seq`
(`live-run.tsx`). Design for duplicates and "exactly once" stops being a problem you need.

## Ordering

RabbitMQ preserves order within one queue for one publisher. Since one runtime process
publishes one run's events in order, consumers see them in order unless a redelivery
happens. `seq` lets you sort anyway.

Kafka's model differs: no routing patterns, but a topic is split into partitions and order is
guaranteed per partition. `kafka.py` uses the routing key as the record key so every event
of one run lands on the same partition.

## Back-pressure

`channel.prefetch(100)` in the gateway consumer caps unacked messages in flight. If the
gateway falls behind, messages queue in RabbitMQ (which has disk) instead of in Node memory.
This is the broker's second gift after decoupling: it absorbs bursts.

## RabbitMQ vs Kafka in two sentences

RabbitMQ is a smart router with queues: great fit for fan-out, routing by pattern, modest
volume, simple operations. Kafka is a replicated log: great fit for replay, very high
throughput and stream processing, at the price of heavier operations. ADR-0002 explains why
RabbitMQ is the default here and when to flip the `BUS_URL`.

## Try it

Open http://localhost:15672 (agentmesh / agentmesh) while a run executes. Watch the
`agentmesh.events` exchange's message rate and the auto-named gateway queue. Then stop the
gateway container and start a run: messages accumulate in no queue (exclusive queues vanish
with their consumer), which is exactly why the event log is written from the gRPC path too.
