# 04. Interview talk track

## The two-minute version

"AgentMesh is an open, self-hostable platform for running LangGraph agents as services.
Agent frameworks stop at the graph; hosted platforms add runs, observability and approvals
but lock you to one vendor. AgentMesh gives you those pieces on any model and any cloud.

Three services: a Next.js 15 dashboard, a Nest.js 11 gateway with REST and Socket.IO, and a
Python runtime hosting the graphs behind a gRPC contract. Every node start, node finish,
token count, interrupt and completion becomes a RunEvent on RabbitMQ; the gateway relays it
to the browser and persists it with Prisma. Human approval is one `interrupt()` call: the run
checkpoints to Postgres, the dashboard shows an approval card, and approving resumes it from
the checkpoint, even in another process.

Model, broker, vector store and event log each sit behind a small interface with an
env-selected adapter, so it runs with `docker compose up` and zero API keys, and deploys on
free tiers."

## The fifteen-minute version

Walk the README sequence diagram, then go deeper on four points:

1. **Contract.** `agent.proto`: four RPCs, server streaming for runs, JSON for agent-specific
   payloads, typed fields for shared ones. proto-loader on Node, generated stubs on Python
   (ADR-0001).
2. **Events.** `tracing.py` emits node events through LangGraph's custom stream; `engine.py`
   has one `_stream` for start and resume; `BusState` stops the gateway's two relay paths from
   duplicating (ADR-0002).
3. **HITL.** `reviewer.py`, the replay semantics of `interrupt()`, thread id equals run id
   (ADR-0005).
4. **Memory.** State, checkpoints, pgvector with HNSW, and the context budgeter as the valve
   to the model (ADR-0004).

Close with what breaks first at 10x (lesson 02).

## Numbers to quote

- 3 agents, 4 RPCs, 10 event types, 6 run statuses.
- 24 offline runtime tests in under 10 s; 11 gateway Jest tests with mocked gRPC and Prisma.
- A simple run emits 7 events; a reviewer run emits 9 across interrupt and resume.
- Context budget 6000 tokens by default, tiktoken with a chars/4 fallback.
- At-least-once delivery, deduplicated by per-run `seq`; event log upserts on `(runId, seq)`.
- Free deploy: Vercel, two Render services, Neon, CloudAMQP. Cost zero, 30 to 60 s cold start.

## Ten likely questions

**1. Why gRPC, not REST, between gateway and runtime?** Streaming with flow control and a
typed, versioned contract across two languages. Browsers cannot speak gRPC; hiding that is the
gateway's job.

**2. Is a gRPC stream plus a bus redundant?** No. The stream is the control path that drives
status and persistence. The bus is fan-out to anyone (replicas, audit, billing) without the
runtime knowing them. If the bus is down, the stream still works.

**3. How do you avoid duplicate events?** One relay path at a time (`BusState`), a monotonic
`seq` per run, upserts in the log and dedupe in the dashboard.

**4. The runtime dies while a run awaits approval. Then what?** Nothing is lost: the
checkpoint is in Postgres keyed by run id and any runtime sharing the database can resume it.

**5. Why Nest over plain Express?** Modules, DI, DTO validation, WebSocket gateways and a
testing module for mocked service tests. It is Express underneath.

**6. Why pgvector, not a vector database?** One database, one free tier, and HNSW is enough
to tens of millions of vectors. `SemanticMemory` is the seam for Qdrant later.

**7. Back-pressure?** gRPC streaming blocks a fast producer, RabbitMQ `prefetch(100)` caps
in-flight messages. The real limit is model rate limits; next step is a per-provider
semaphore in `llm.py`.

**8. Keeping prompts inside the context window?** Every call goes through `ask()`, which keeps
system messages, keeps the newest, truncates rather than drops the current turn, and reports
what it trimmed.

**9. Auth and multi-tenancy?** A Nest guard plus Socket.IO middleware validating JWTs; tenant
id in `metadata`, which already rides on every event, plus a `tenantId` column. The runtime
does not change.

**10. What would you do with more time?** Generate TypeScript types from the proto,
summarise instead of drop in the budgeter, stream tokens to the dashboard, add Testcontainers
integration tests, and an idempotency key on `POST /runs`.
