# 02. System design masterclass, with your products as the whiteboard

System design is architecture plus numbers. This lesson is organised the way a system design interview is, and every section ends with how the idea is already applied in your repos so you can point at code.

## Chapter 1: Start with the numbers

Before drawing anything, estimate load. For IntakeAgent serving a 5-clinic group:

| Quantity | Estimate |
|---|---|
| Intakes per clinic per day | 40 |
| Total intakes per day | 200 |
| Audio per intake | 6 minutes, roughly 2.5 MB of opus |
| Audio per day | 500 MB |
| LLM tokens per intake (extraction and questions) | 8,000 |
| Tokens per day | 1.6 million |
| Cost at a cheap cloud model | under 1 USD per day |
| Cost at a local 7B model on one Oracle Always Free ARM VM | 0 USD, roughly 12 tokens per second, so 11 minutes of compute per intake spread across the day |

The last row tells you something important: a free ARM VM can handle a 5-clinic pilot if intakes are spread across the day and extraction runs asynchronously. That is a sentence you can say in a sales call and in an interview.

Do the same table for AgentMesh (runs per day, events per run, bus messages per second) and OpenInfer (requests per second, tokens per second per backend). The repos' `docs/learn/02-system-design-tradeoffs.md` give you the numbers to start from.

## Chapter 2: The request path and its latency budget

Trace one request end to end and assign a budget to each hop. For a dashboard user starting an AgentMesh run:

1. Browser to Vercel edge, 50 ms
2. Vercel to Render gateway, 100 ms (cross-region on free tiers)
3. Gateway to Postgres insert, 10 ms
4. Gateway to agent runtime over gRPC, 5 ms to open the stream
5. Return the run id to the browser

Total under 200 ms. Everything else arrives over the WebSocket. If you had made the HTTP call wait for the agent to finish, the budget would be 30 to 120 seconds and you would hit the Render free tier's request timeout. Latency budgets are how you discover that a design is wrong before you build it.

## Chapter 3: Queues, back-pressure and delivery guarantees

A message broker does three jobs: it decouples producers from consumers in time, it absorbs bursts, and it gives you a delivery guarantee you can reason about.

- At-most-once: fire and forget. Fine for metrics.
- At-least-once: the consumer acknowledges after processing; a crash means redelivery. This is what AgentMesh uses for run events. Consumers must be idempotent: applying the same "node finished" event twice must not corrupt the run. The event id plus a unique index in Postgres gives you that.
- Exactly-once: mostly a marketing term. It is at-least-once plus idempotent consumers, or transactional outboxes.

Back-pressure: what happens when agents produce events faster than the dashboard relay consumes them? RabbitMQ queues grow in memory then disk, then it blocks publishers. Kafka keeps appending and consumers fall behind by an offset. Your ADR on RabbitMQ versus Kafka explains the choice: RabbitMQ for routed work queues at MVP scale, Kafka when you need replay or more than tens of thousands of events per second.

## Chapter 4: State, checkpoints and the "resume after crash" test

Ask of every design: if I kill every process right now and restart, what is lost? In AgentMesh, run state lives in LangGraph's Postgres checkpointer after every node. The gateway's own state is in Postgres. The dashboard has no state. The bus holds unacknowledged events. Kill everything, restart, and the run resumes from its last checkpoint and the dashboard re-renders from the event log. That is the property healthcare and legal clients pay for, and the property that lets you deploy at 2 p.m. on a weekday.

## Chapter 5: Scaling each tier independently

Because the tiers are separate, each scales on its own axis:

- Dashboard: static and edge-cached, effectively infinite on Vercel.
- Gateway: stateless, scale horizontally; sticky sessions are not needed because WebSocket fan-out comes from the bus, not from process memory.
- Agent runtime: scale by adding consumers on the same queue; LangGraph checkpoints mean any replica can resume any run.
- Postgres: the first real bottleneck. Read replicas first, then partition runs by tenant, then move the event log to Mongo or Kafka with retention.
- Inference: the expensive tier. OpenInfer's router lets you add a GPU box as another backend without touching any caller.

The interview question "what breaks first at 10x?" has a precise answer here: the single Postgres instance, specifically checkpoint writes, because each node writes a full state snapshot. The fix is to checkpoint less often, store large blobs in object storage with a pointer in Postgres, or move to a checkpointer with incremental writes.

## Chapter 6: Failure modes and what you do about them

| Failure | Blast radius | Mitigation already in the repos | Next step |
|---|---|---|---|
| Cloud LLM rate limit | Single request | Router fallback chain and backoff | Per-tenant token buckets |
| Agent runtime crash mid-run | One run | Postgres checkpoint, resume on restart | Health checks and automatic restart in compose or Kubernetes |
| Broker down | All new events | Publisher retries with local buffer | Transactional outbox table |
| Dashboard disconnect | One user | Socket.IO reconnect and replay from event log | Event cursors per client |
| PHI sent to cloud by mistake | Legal and reputational | Redaction step and private tag that forces local | Policy tests in CI that fail if a private route reaches a cloud backend |

## Chapter 7: Security and multi-tenancy, briefly

Start with tenant id on every table and every event. Row-level security in Postgres is cheap to add early and painful to add late. Secrets come from the environment and never from the repo. Audit log: every HITL approval records who, when and the diff. These three things are what a US healthcare buyer's security questionnaire asks on page one.

## Chapter 8: Observability

You cannot run what you cannot see. OpenInfer exposes Prometheus metrics; AgentMesh emits an event per node; IntakeAgent stores evidence spans for every extracted field. Add structured JSON logs with a request id that travels across the gRPC and bus hops (propagate it in message headers). Then one grep tells the story of a run across three services.

## Practice: the 45-minute interview drill

Set a timer. Design "an agent platform for a staffing company that screens 10,000 resumes a day with human review on the top 5 percent". Use your AgentMesh diagram as the base, estimate load, assign a latency budget, choose the broker, define the HITL state, and name what breaks first. Then compare your answer with the repo's ADRs. Do this once a week until the structure is automatic.
