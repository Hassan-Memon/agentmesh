"""Shared fixtures. Everything here is offline: stub model, in-memory bus, memory and checkpointer."""

from __future__ import annotations

import os

# Must happen before agentmesh_runtime.config is imported anywhere.
os.environ["DEMO_MODE"] = "1"
os.environ["BUS_URL"] = "memory://"
os.environ.pop("DATABASE_URL", None)

import pytest  # noqa: E402

from agentmesh_runtime.bootstrap import Runtime, build_runtime  # noqa: E402
from agentmesh_runtime.config import Settings  # noqa: E402


@pytest.fixture
def settings() -> Settings:
    return Settings(demo_mode=True, bus_url="memory://", database_url=None, _env_file=None)


@pytest.fixture
async def runtime(settings: Settings) -> Runtime:
    rt = await build_runtime(settings, offline=True)
    yield rt
    await rt.close()


async def collect(stream) -> list[dict]:
    return [event async for event in stream]
