# 01. Architecture principles, taught through your three products

Architecture is the set of decisions that are expensive to change later. Everything else is implementation. This lesson gives you eight principles and shows where each one is applied in AgentMesh, OpenInfer and IntakeAgent.

## Principle 1: Draw the boundaries around rates of change

Things that change at different speeds should live in different services. In AgentMesh the Nest.js gateway changes when the API or UI contract changes. The Python agent runtime changes when a prompt, a tool or a graph changes, which is many times per day. If they lived in one process, every prompt tweak would redeploy the API. That is why they are separate services talking over gRPC.

Ask yourself about any system: what changes weekly, what changes yearly? Put a boundary between them.

## Principle 2: Contracts before code

The proto file in `agentmesh/proto/agentmesh/v1/agent.proto` was written before either side had code. A contract that both sides generate from (Python stubs, Node runtime loader) means teams can work in parallel and breakages are compile-time or startup-time, not 3 a.m. production-time. The same idea appears in OpenInfer: it did not invent an API, it adopted the OpenAI wire format so every existing SDK is a client on day one.

Rule: when you cannot decide between two designs, pick the one with the clearer contract.

## Principle 3: Separate the request path from the event path

In AgentMesh, starting a run is a request (client waits for an id). Everything that happens afterwards is events on RabbitMQ (node started, tokens used, waiting for a human). The request path is synchronous and small. The event path is asynchronous, buffered, and survives a crashed dashboard. Mixing them (long HTTP calls that block until the agent finishes) is the most common mistake in agent systems and the reason they fall over under load.

## Principle 4: Make the human a first-class state, not an afterthought

LangGraph's `interrupt()` in the reviewer agent and in IntakeAgent's approval node means "waiting for a human" is a persisted state in Postgres, resumable days later, visible in the dashboard. Compare with a system that keeps a Python coroutine alive waiting for a webhook. The first survives a deploy. The second does not. Healthcare and legal buyers will not sign without this.

## Principle 5: Default to the boring database, leave a door for the specialised one

All three products start on Postgres. Vectors live in pgvector, not in a separate vector database. The ADRs explain why: one backup, one connection pool, one thing to secure, and transactional consistency between a record and its embedding. Each repo documents the trigger that justifies moving to Qdrant or Mongo (for example more than roughly ten million vectors, or write rates above what one Postgres can index). Knowing the trigger is what separates a principal from a senior.

## Principle 6: Policy is data, not code

OpenInfer's router reads `openinfer.yaml`. "Private requests never leave this machine" is a line of configuration, not an if-statement buried in Python. Operators change it without a deploy; auditors can read it. The same pattern is used in IntakeAgent for which fields are required per vertical.

## Principle 7: Every external dependency has a stub

All three products run with `DEMO_MODE=1` and no API keys. Tests run offline. This is not a convenience; it is architecture. It means your CI never depends on a third party being up, your demo never fails on stage because a free tier throttled you, and new contributors run the project in two minutes.

## Principle 8: Decide, record, revisit

Every repo has `docs/adr/`. An Architecture Decision Record states the context, the options, the decision and the consequences. When circumstances change, you write a new ADR that supersedes the old one; you never edit history. In interviews, ADRs are your evidence that you make decisions deliberately. On a team, they stop the same argument happening every quarter.

## Exercise

Open each repo's `docs/adr/` and, for every ADR, write one sentence on what would have to be true for you to reverse that decision. If you cannot answer, the ADR is missing its consequences section and you should add it.
