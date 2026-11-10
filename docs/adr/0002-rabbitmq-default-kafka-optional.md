# ADR-0002: RabbitMQ as the default event bus, Kafka behind the same interface

- Status: accepted
- Date: 2026-11-09
- Deciders: Hassan Memon

## Context and problem statement

Every run emits events (node started, node finished, token usage, interrupt, done). The
dashboard wants them live, an event log wants them persisted, and future consumers (billing,
alerting, analytics) will want them too, without the runtime knowing who they are. Which
broker, and how tightly should the code depend on it?

## Decision drivers

- Fan-out to many consumers with topic-style filtering (`run.<id>.*`, `run.*.interrupt`).
- Free tier available for remote deploys (CloudAMQP "Little Lemur").
- Small operational footprint for a laptop (`docker compose up`).
- Some teams already run Kafka; they should not have to rewrite agents.

## Considered options

1. RabbitMQ (AMQP) only.
2. Kafka / Redpanda only.
3. Broker abstraction with RabbitMQ default and a Kafka adapter.
4. No broker: gateway fans out from the gRPC stream directly.

## Decision outcome

Chosen option: **option 3**.

`packages/bus` defines `EventBus` with `publish(routing_key, payload)` and `subscribe(pattern)`.
Three adapters implement it: in-memory (tests), RabbitMQ (aio-pika), Kafka (aiokafka).
Routing keys follow the AMQP topic convention `run.<run_id>.<event_type>`; the Kafka adapter
uses the key as the record key and filters patterns client side so behaviour is identical.

The gateway consumes with `amqplib` on an exclusive queue bound to `run.#`, and relays to
WebSocket clients. When no broker is configured, the gateway's gRPC stream consumer relays
events itself; a shared `BusState.relayEnabled` flag guarantees exactly one of the two paths
emits, so clients never see duplicates.

### Consequences

Good:

- RabbitMQ's topic exchange gives per-run filtering for free; a future consumer that only
  wants interrupts binds `run.*.interrupt`.
- Any number of gateway replicas can serve WebSocket clients for any run, because each
  replica receives every event.
- Agents are broker-agnostic; switching is a URL change (`BUS_URL=kafka://...`).

Bad:

- At-least-once delivery means consumers must deduplicate. `RunEvent.seq` is monotonic per
  run, and the event log upserts on `(runId, seq)`.
- Two code paths for WebSocket relay (bus or direct) is one more thing to test. The unit
  tests in `runs.service.spec.ts` cover both.

## When to switch to Kafka

Kafka earns its complexity when you need replay (re-run analytics over last month's events),
very high throughput, or strict ordering across partitions. Redpanda ships in compose under
the `kafka` profile for exactly that experiment.
