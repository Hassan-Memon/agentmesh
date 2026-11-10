# 02. System design trade-offs

This is the "what happens at 10x" lesson. For each concern: what the MVP does, what breaks
first, and the next step. Numbers are rough but realistic for the free-tier deploy.

## Scaling

**Gateway.** Stateless apart from WebSocket connections. Horizontal scaling works today
because the RabbitMQ relay (`bus/rabbitmq-consumer.service.ts`) gives every replica every
event, so each replica can serve its own clients. Around 10k sockets per instance, add the
Socket.IO Redis adapter (Redis is already in compose).

**Runtime.** Each run is an asyncio task; model latency dominates, so one process handles
dozens of concurrent runs. What breaks first: CPU-bound embedding (if you switch to
sentence-transformers) blocks the event loop. Fix: run embeddings in a thread pool or a
separate service. Horizontal scaling of the runtime works for `StartRun` immediately
(stateless) and for `ResumeRun` as long as all replicas share the Postgres checkpointer
(ADR-0004). The in-process `RunStore` is per replica; `GetRun` through the gateway reads
Postgres, not the runtime, so that is fine.

**Postgres.** The event log is the write hot spot: about 7 rows per simple run. Even 50k
runs/day is trivial with the `(runId, seq)` index. Neon free storage (0.5 GB) runs out first:
move events to Mongo (`MONGO_URL`) or add retention.

## Failure modes

| Failure | What happens now | Improvement |
| --- | --- | --- |
| Runtime down | gRPC client reconnects with backoff; in-flight streams error; `RunsService.consume` marks the run `FAILED` with the gRPC message | Add a retry for `UNAVAILABLE` before marking failed; queue starts |
| RabbitMQ down | Runtime logs a warning and keeps serving; gateway consumer reconnects every 5 s and switches `relayEnabled` off so the direct path emits | Buffer events locally with a bounded queue |
| Postgres down | Gateway `POST /runs` fails (cannot create the record); runtime falls back to in-memory checkpointer at startup only | Health check gates traffic; checkpointer reconnect |
| LLM provider errors | Node raises, `@traced` emits `node_failed`, run ends `FAILED` | Retry with exponential backoff inside `ask()`, fall back to a second provider |
| Gateway crash mid-stream | Run continues in the runtime; events still reach the bus and the log misses them | Persist events from the bus consumer too (idempotent upsert already handles duplicates) |

## Back-pressure

gRPC server streaming has flow control built in: if the gateway reads slowly, the runtime's
`yield` blocks. The RabbitMQ consumer sets `prefetch(100)` so at most 100 unacked messages
are in flight per gateway. Socket.IO buffers per client; a slow browser tab accumulates
memory, so the next step is to drop `run.activity` broadcasts under pressure (they are only
hints) and keep `run.event`.

The model call is the slow part. Nothing today limits concurrent runs. At 10x, add a
semaphore per provider in `llm.py` (Groq free tier allows roughly 30 requests/min) and
return `RESOURCE_EXHAUSTED` from `StartRun` when the queue is deep.

## Idempotency

- **Starting a run.** The dashboard generates nothing; the gateway creates the UUID. A retried
  `POST /runs` creates a second run. Fix: accept an `Idempotency-Key` header and store it on
  the `Run` row with a unique index.
- **Events.** `seq` is monotonic per run and the event log upserts on `(runId, seq)`, so at-
  least-once delivery from the bus is safe. The dashboard also dedupes by `seq`.
- **Approval.** `RunsService.approve` checks status and the runtime checks again
  (`FAILED_PRECONDITION`), so a double click resumes once.
- **Node side effects.** Code before `interrupt()` runs twice (ADR-0005). Keep writes after
  the interrupt node.

## Consistency

Run status lives in Postgres (gateway) and the runtime's `RunStore`, and can briefly
disagree mid-stream. Postgres is the product's truth; `RunStore` is a cache for `GetRun`.

## What breaks first at 10x, in order

1. Free-tier LLM rate limits. Add a per-provider semaphore and a second provider.
2. Neon storage from the event log. Move events to Mongo or add retention.
3. Render cold starts hurting p95. Keep one paid instance or move to an always-on VM.
4. Single runtime process for CPU-heavy embeddings. Separate embedding service.
5. Socket.IO fan-out beyond one gateway instance. Redis adapter.

Nothing in that list requires changing an agent.
