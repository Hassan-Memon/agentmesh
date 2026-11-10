# Changelog

All notable changes to AgentMesh are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [0.1.0] - 2026-11-10

First public release. This repository previously held FastAPI book exercises from 2023. That
code was removed and the repository was rebuilt as AgentMesh.

### Added
- **Contract:** `proto/agentmesh/v1/agent.proto` defines `AgentService` with `ListAgents`,
  `StartRun` (a server stream of run events), `ResumeRun` and `GetRun`. Python stubs are
  generated and committed.
- **Agent runtime (Python):** a gRPC server hosting three LangGraph agents. `researcher` answers
  with retrieval over pgvector, `writer` drafts in two steps, and `reviewer` pauses for human
  approval with LangGraph `interrupt()` and resumes with `Command`. Runs are checkpointed in
  Postgres, with an in-memory fallback. A context-window budget trims messages by token count.
- **Event bus:** one async interface with RabbitMQ (aio-pika), Kafka or Redpanda (aiokafka) and
  in-memory adapters. Every node start and finish, token count, interrupt and completion is
  published as a run event.
- **Gateway (Nest.js 11):** REST endpoints for agents and runs, human approval, a Socket.IO
  channel that relays bus events to browsers, a gRPC client, and Prisma persistence in Postgres
  with optional MongoDB for the event log.
- **Dashboard (Next.js 15):** agents, runs, a live run timeline, an approval card and a new-run
  form, with light and dark themes.
- **Demo mode:** with `NEXT_PUBLIC_DEMO_MODE=1` the dashboard uses an in-browser simulation that
  matches the gateway's API and event shapes, with a banner on every page saying so.
- **Deployment:** a Docker Compose stack with Postgres and pgvector, RabbitMQ and Redis, plus
  optional Redpanda, MongoDB and Ollama profiles. The demo is deployed to Cloudflare Workers
  through OpenNext at https://agentmesh.hassan-memon.workers.dev.
- **CI:** GitHub Actions lint and test the runtime, the bus, the gateway and the dashboard, and
  validate the Compose file.
- **Documentation:** five architecture decision records, positioning, a free-tier deploy guide,
  a teaching track in `docs/learn/`, and a cross-product curriculum in `docs/curriculum/` on
  architecture, system design, market, marketing, selling and job hunting.

### Fixed
- The gateway no longer blocks startup when Postgres is unreachable.
- The production image now runs database migrations and fails loudly if they fail.
- LangGraph approval pauses are no longer reported as node failures.
- The dashboard header, demo banner and run timeline now fit phone screens without sideways
  scrolling.

[0.1.0]: https://github.com/Hassan-Memon/agentmesh/commits/main
