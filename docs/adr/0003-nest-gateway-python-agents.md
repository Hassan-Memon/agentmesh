# ADR-0003: Nest.js for the gateway, Python for the agents

- Status: accepted
- Date: 2026-11-09
- Deciders: Hassan Memon

## Context and problem statement

The platform needs an edge service (REST, WebSockets, persistence, auth later) and an agent
execution service (LLM calls, graphs, embeddings). One language for both would be simpler to
hire for and to build. Why two?

## Decision drivers

- The AI ecosystem (LangGraph, LangChain, sentence-transformers, pgvector bindings) is
  Python-first; parity in TypeScript lags and some pieces do not exist.
- Web edge concerns (WebSockets at scale, structured DI, request validation, Prisma) are
  mature in Node, and the target team already runs Node services.
- Independent scaling: WebSocket fan-out is I/O bound and cheap; agent execution is latency
  bound on model calls and may want different instance sizes or GPUs.
- Failure isolation: a runaway agent should not take down the API that shows you it is
  running away.

## Considered options

1. All TypeScript (LangGraph.js in the gateway process).
2. All Python (FastAPI gateway + agents in one process).
3. TypeScript gateway + Python agent runtime, gRPC between them (ADR-0001).

## Decision outcome

Chosen option: **option 3**.

Nest.js was chosen over plain Express or Fastify because its module system and dependency
injection keep a growing gateway organised (see
`docs/learn/03-concepts/nestjs-modules-providers-di.md`), it has first-class WebSocket
gateways (Socket.IO), and its testing module makes service-layer unit tests with mocked
dependencies trivial (`apps/gateway/src/runs/runs.service.spec.ts`).

### Consequences

Good:

- Each side uses its best-in-class tooling: Prisma, Socket.IO, class-validator on one side;
  LangGraph, psycopg, pgvector on the other.
- The runtime can be deployed on a box with a GPU or next to Ollama; the gateway can sit on a
  cheap free-tier web service.
- The protobuf contract is a natural seam for a team split (platform vs. agent authors).

Bad:

- Two toolchains, two CI jobs, two Dockerfiles, two sets of dependency updates.
- Shared concepts (event shape, status enum) are declared twice (proto + Prisma enum). The
  proto is authoritative; the gateway maps explicitly in `events/run-event.ts`.

## Notes

The all-Python option is a reasonable choice for a solo project. We rejected it because the
role this project targets explicitly wants Node/Nest at the edge, and because the Python
WebSocket story (uvicorn + raw websockets) is thinner than Socket.IO's rooms, reconnects and
fallbacks.
