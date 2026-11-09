"""Agent registry: the single place that knows which graphs exist.

An agent is a function `build_graph(deps) -> StateGraph` plus metadata. The run engine
compiles the graph with a checkpointer at startup. Adding an agent is one import and one
entry in REGISTRY; the gateway and dashboard discover it through ListAgents.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any

from langchain_core.language_models.chat_models import BaseChatModel

from ..config import Settings

if TYPE_CHECKING:
    from langgraph.graph import StateGraph

    from ..memory.store import SemanticMemory


@dataclass(slots=True)
class AgentDeps:
    """Runtime dependencies injected into every graph builder."""

    settings: Settings
    model: BaseChatModel
    memory: SemanticMemory


@dataclass(slots=True)
class AgentSpec:
    name: str
    description: str
    version: str
    build_graph: Callable[[AgentDeps], StateGraph]
    capabilities: list[str] = field(default_factory=list)
    requires_approval: bool = False

    def as_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "description": self.description,
            "version": self.version,
            "capabilities": list(self.capabilities),
            "requires_approval": self.requires_approval,
        }


def _build_registry() -> dict[str, AgentSpec]:
    # Imported lazily to avoid an import cycle (agents import AgentDeps from here).
    from . import researcher, reviewer, writer

    specs = [
        AgentSpec(
            name="researcher",
            description=(
                "Answers questions with retrieval-augmented generation over the pgvector knowledge base."
            ),
            version="0.1.0",
            build_graph=researcher.build_graph,
            capabilities=["rag", "pgvector", "citations"],
        ),
        AgentSpec(
            name="writer",
            description="Produces an outline and then a full draft for a requested piece of writing.",
            version="0.1.0",
            build_graph=writer.build_graph,
            capabilities=["writing", "two-step"],
        ),
        AgentSpec(
            name="reviewer",
            description=(
                "Reviews submitted text, then pauses for a human approve/reject decision before finalizing."
            ),
            version="0.1.0",
            build_graph=reviewer.build_graph,
            capabilities=["review", "hitl", "interrupt"],
            requires_approval=True,
        ),
    ]
    return {s.name: s for s in specs}


REGISTRY: dict[str, AgentSpec] = _build_registry()


def list_agents() -> list[AgentSpec]:
    return list(REGISTRY.values())


def get_agent(name: str) -> AgentSpec:
    try:
        return REGISTRY[name]
    except KeyError:
        raise KeyError(f"unknown agent {name!r}; known: {sorted(REGISTRY)}") from None
