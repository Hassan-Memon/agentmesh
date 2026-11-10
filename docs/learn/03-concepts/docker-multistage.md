# Docker multi-stage builds

**In one line:** a multi-stage Dockerfile uses one image to build and a different, smaller
image to run, copying only the artefacts across, so compilers, dev dependencies and caches
never ship.

## The problem it solves

A naive Node image runs `npm ci && npm run build` and ships `node_modules` with TypeScript,
ESLint, Jest and the Nest CLI inside: 400 MB and a large attack surface. A naive Python
image ships `uv`, build tools and test dependencies. Multi-stage builds fix both.

## The runtime Dockerfile, annotated

`services/agent-runtime/Dockerfile`:

```dockerfile
FROM ghcr.io/astral-sh/uv:python3.13-bookworm-slim AS builder
ENV UV_PROJECT_ENVIRONMENT=/opt/venv
COPY packages/bus/pyproject.toml ... packages/bus/
COPY services/agent-runtime/pyproject.toml services/agent-runtime/uv.lock ...
RUN uv sync --frozen --no-dev --no-install-project
COPY services/agent-runtime/agentmesh_runtime agentmesh_runtime
RUN uv sync --frozen --no-dev

FROM python:3.13-slim-bookworm AS runtime
COPY --from=builder /opt/venv /opt/venv
COPY --from=builder /src/services/agent-runtime/agentmesh_runtime /app/agentmesh_runtime
CMD ["python", "-m", "agentmesh_runtime"]
```

Three ideas are packed in there:

1. **Layer caching by dependency metadata first.** `pyproject.toml` and `uv.lock` are copied
   and dependencies installed *before* the source. Editing a Python file invalidates only
   the last layers; the slow dependency install is cached.
2. **`--frozen`** installs exactly what the lock file says, so the image matches CI.
3. **The runtime stage has no `uv`** and no dev group. The virtualenv is copied across whole.

The gateway Dockerfile has three stages: `builder` (all deps, `prisma generate`, `nest
build`), `deps` (production deps only plus a second `prisma generate`, because the client
lives in `node_modules`), and `runtime` (Alpine Node, `dist/`, `node_modules` from `deps`,
the proto file). The dashboard uses Next's `standalone` output, which traces exactly the
files `server.js` needs, so the final image has no `node_modules` at all.

## Build context

All three Dockerfiles are built with the **repository root** as context
(`infra/docker-compose.yml` sets `context: ..`). The runtime needs `packages/bus`, the
gateway needs `proto/`. Each app has a `.dockerignore` so `node_modules` and `.next` on your
machine are not uploaded to the daemon.

## Non-root users and ports

Each runtime stage switches to an unprivileged user (`USER app`, `USER node`) and documents
its port with `EXPOSE`. `EXPOSE` is documentation; the actual publishing happens in compose
(`ports: "4000:4000"`).

## Compose profiles

`infra/docker-compose.yml` uses `profiles` so optional services do not start by default:
`--profile kafka` for Redpanda, `--profile nosql` for Mongo, `--profile local-llm` for
Ollama. `depends_on` with `condition: service_healthy` waits for Postgres and RabbitMQ
health checks before starting the apps, which removes a whole class of startup races.

## Environment variables at build vs run

`NEXT_PUBLIC_*` values are baked into the browser bundle at build time, so the dashboard
Dockerfile takes them as `ARG` and compose passes `args:`. Everything else is runtime
`environment:`. Secrets are never `ARG`s; they would end up in image history.

## Try it

```bash
docker build -f services/agent-runtime/Dockerfile -t agentmesh-runtime .
docker image ls agentmesh-runtime     # compare to python:3.13 (about 1 GB)
docker history agentmesh-runtime      # see which layer is the big one
```

Then change one line in `server.py`, rebuild, and watch every layer up to the source copy
report `CACHED`.
