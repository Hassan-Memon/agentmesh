"""Wire the runtime together: settings -> model, memory, checkpointer, bus -> engine.

Kept separate from server.py so tests can build a fully working engine with in-memory
everything and no gRPC.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

from agentmesh_bus import EventBus, InMemoryBus, build_bus
from langgraph.checkpoint.base import BaseCheckpointSaver
from langgraph.checkpoint.memory import InMemorySaver

from .agents.registry import AgentDeps
from .config import Settings
from .llm import build_chat_model, resolve_provider
from .memory import InMemorySemanticMemory, SemanticMemory, build_embeddings, build_memory
from .memory.seed import seed_knowledge
from .runs.checkpointer import Closer, build_checkpointer
from .runs.engine import RunEngine
from .runs.store import RunStore

log = logging.getLogger(__name__)


@dataclass(slots=True)
class Runtime:
    settings: Settings
    engine: RunEngine
    bus: EventBus
    memory: SemanticMemory
    close_checkpointer: Closer
    provider: str

    async def close(self) -> None:
        await self.bus.close()
        await self.memory.close()
        await self.close_checkpointer()


async def build_runtime(settings: Settings, *, offline: bool = False) -> Runtime:
    """Build everything. `offline=True` forces in-memory bus/memory/checkpointer (tests)."""
    provider = resolve_provider(settings)
    model = build_chat_model(settings, provider)
    embeddings, dim = build_embeddings(settings)

    memory: SemanticMemory
    checkpointer: BaseCheckpointSaver
    bus: EventBus
    if offline:
        memory = InMemorySemanticMemory(embeddings)
        checkpointer = InMemorySaver()
        bus = InMemoryBus()

        async def close_cp() -> None:
            return None

    else:
        memory = await build_memory(settings, embeddings, dim)
        checkpointer, close_cp = await build_checkpointer(settings)
        bus = build_bus(settings.bus_url)
        try:
            await bus.connect()
        except Exception as exc:  # noqa: BLE001
            log.warning("bus %s unreachable (%s); events stay in-process only", settings.bus_url, exc)
            bus = InMemoryBus()

    inserted = await seed_knowledge(memory)
    if inserted:
        log.info("seeded %d knowledge documents", inserted)

    deps = AgentDeps(settings=settings, model=model, memory=memory)
    engine = RunEngine(deps, checkpointer, bus, RunStore(settings.run_store_max_events))
    log.info("runtime ready: provider=%s demo_mode=%s", provider, settings.demo_mode)
    return Runtime(settings, engine, bus, memory, close_cp, provider)
