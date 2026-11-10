# ADR-0001: gRPC between the gateway and the agent runtime

- Status: accepted
- Date: 2026-11-09
- Deciders: Hassan Memon

## Context and problem statement

The gateway is TypeScript (Nest.js) and the agents are Python (LangGraph). They run as
separate processes, usually on separate hosts. The gateway needs to start a run, receive a
stream of progress events while it executes, resume a paused run, and query run state. What
protocol should sit between them?

## Decision drivers

- Streaming: a run produces many events over seconds or minutes; polling is wasteful and
  adds latency to the dashboard.
- A contract that both languages can enforce at compile or load time, not just by convention.
- Low ceremony on a Windows dev machine with no `protoc` installed.
- Internal traffic only; browsers never call this API directly.

## Considered options

1. REST + JSON with Server-Sent Events for the stream.
2. gRPC with protobuf, server-streaming RPCs for StartRun/ResumeRun.
3. Put everything on the message bus (request/reply over RabbitMQ).

## Decision outcome

Chosen option: **gRPC (option 2)**.

`proto/agentmesh/v1/agent.proto` is the single source of truth. Python stubs are generated
with `grpcio-tools` (`uv run python -m scripts.gen_proto`) and committed; the Node side loads
the same file at runtime with `@grpc/proto-loader`, so there is no codegen toolchain to
install on either side. `StartRun` and `ResumeRun` are server-streaming RPCs: one request,
a stream of `RunEvent` messages until the graph finishes or pauses.

### Consequences

Good:

- Typed contract with versioned package (`agentmesh.v1`). Adding a field is backwards
  compatible; renaming one is a visible breaking change.
- Native streaming over HTTP/2 with flow control; the runtime cannot flood a slow gateway.
- Clear status codes (`NOT_FOUND`, `FAILED_PRECONDITION`, `ALREADY_EXISTS`) map cleanly to
  HTTP in the gateway.

Bad:

- Hand-written TypeScript mirrors of the messages (`apps/gateway/src/grpc/types.ts`) must be
  kept in sync with the proto. Acceptable for one small service; generated types are the
  upgrade path if the surface grows.
- Free PaaS tiers vary in HTTP/2 support. Render supports it; some others do not, which is why
  `docs/deploy.md` recommends keeping gateway and runtime on the same provider.

## Why not the alternatives

- REST + SSE works, but it means two mechanisms (request/response and a one-way stream) and a
  JSON schema that nothing enforces across languages.
- Request/reply over the bus couples the critical path to broker availability and makes
  request timeouts and backpressure much harder to reason about. The bus is for
  observability fan-out (ADR-0002), not for the control plane.
