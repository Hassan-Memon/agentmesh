# Multi-stage build for the Python agent runtime.
# Build context is the repo root (the runtime depends on ../../packages/bus):
#   docker build -f services/agent-runtime/Dockerfile -t agentmesh-runtime .
# See docs/learn/03-concepts/docker-multistage.md.

# ---- stage 1: resolve and install dependencies with uv -------------------------------
FROM ghcr.io/astral-sh/uv:python3.13-bookworm-slim AS builder
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PROJECT_ENVIRONMENT=/opt/venv
WORKDIR /src

# Copy only dependency metadata first so this layer is cached until deps change.
COPY packages/bus/pyproject.toml packages/bus/README.md packages/bus/
COPY packages/bus/agentmesh_bus packages/bus/agentmesh_bus
COPY services/agent-runtime/pyproject.toml services/agent-runtime/uv.lock services/agent-runtime/README.md services/agent-runtime/
WORKDIR /src/services/agent-runtime
RUN uv sync --frozen --no-dev --no-editable --no-install-project

# Now the source. Installing the project itself is cheap.
COPY services/agent-runtime/agentmesh_runtime agentmesh_runtime
RUN uv sync --frozen --no-dev --no-editable

# ---- stage 2: slim runtime image without uv or build tools ----------------------------
FROM python:3.13-slim-bookworm AS runtime
ENV PYTHONUNBUFFERED=1 PATH="/opt/venv/bin:$PATH"
RUN useradd --create-home --uid 10001 app
WORKDIR /app
COPY --from=builder /opt/venv /opt/venv
COPY --from=builder /src/services/agent-runtime/agentmesh_runtime /app/agentmesh_runtime
USER app
EXPOSE 50051
CMD ["python", "-m", "agentmesh_runtime"]
