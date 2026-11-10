# Concepts

One short lesson per concept that is new to a Python-first developer and used in this repo.
Each one names the files where you can see it in action.

| Lesson | Where it lives in the code |
| --- | --- |
| [gRPC and protobuf](grpc-and-protobuf.md) | `proto/`, `services/agent-runtime/agentmesh_runtime/server.py`, `apps/gateway/src/grpc/` |
| [Message brokers and delivery guarantees](message-brokers-and-delivery-guarantees.md) | `packages/bus/`, `apps/gateway/src/bus/` |
| [Nest.js modules, providers, DI](nestjs-modules-providers-di.md) | `apps/gateway/src/**/*.module.ts`, `*.service.ts` |
| [Next.js App Router](nextjs-app-router.md) | `apps/dashboard/src/app/`, `apps/dashboard/src/components/` |
| [WebSockets vs SSE vs WebRTC](websockets-vs-sse-vs-webrtc.md) | `apps/gateway/src/ws/`, `apps/dashboard/src/lib/socket.ts` |
| [Prisma](prisma.md) | `apps/gateway/prisma/`, `apps/gateway/src/prisma/` |
| [Docker multi-stage](docker-multistage.md) | `*/Dockerfile`, `infra/docker-compose.yml` |
| [LangGraph interrupts and checkpoints](langgraph-interrupts-and-checkpoints.md) | `agents/reviewer.py`, `runs/engine.py`, `runs/checkpointer.py` |
| [pgvector and HNSW](pgvector-and-hnsw.md) | `agentmesh_runtime/memory/store.py` |
| [Context-window budgeting](context-window-budgeting.md) | `agentmesh_runtime/context.py`, `agents/common.py` |
