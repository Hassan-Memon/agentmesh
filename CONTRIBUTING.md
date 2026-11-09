# Contributing to AgentMesh

Thanks for taking a look. This project is small enough to read in an afternoon and
that is deliberate. Please keep it that way.

## Ground rules

- Open an issue before a large change so we can agree on the design. Architecture
  decisions are recorded in `docs/adr/`; a change that reverses one needs a new ADR.
- Keep commits small and use Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`,
  `refactor:`, `test:`). One logical change per commit.
- Every new concept that a Python-first developer may not know gets a short note in
  `docs/learn/03-concepts/`.
- No em-dashes in prose. No secrets in the tree; use `.env` (see `.env.example`).

## Local setup

```bash
# Python runtime
cd services/agent-runtime && uv sync && uv run pytest

# Gateway
cd apps/gateway && npm ci && npx prisma generate && npm run build && npm test

# Dashboard
cd apps/dashboard && npm ci && npm run build

# Everything together
docker compose -f infra/docker-compose.yml up --build
```

## Pull request checklist

- [ ] `uv run pytest` passes in `services/agent-runtime`
- [ ] `npm run build` and `npm test` pass in `apps/gateway`
- [ ] `npm run build` passes in `apps/dashboard`
- [ ] `docker compose -f infra/docker-compose.yml config` validates
- [ ] Docs updated (README, ADR, or `docs/learn`) when behaviour or design changed
- [ ] Proto changes regenerate stubs with `uv run python -m scripts.gen_proto`

## Code style

- Python: `ruff` for lint and format, type hints everywhere, `async` for I/O.
- TypeScript: `strict: true`, no `any` unless it is at an untyped boundary and
  commented. Prefer explicit DTOs with `class-validator`.
- Comments explain why, not what. Where a concept is new (gRPC, DI, brokers),
  a one-line pointer to the relevant `docs/learn` page is welcome.
