"""researcher: retrieval-augmented answers over the pgvector knowledge namespace.

START -> retrieve -> synthesize -> END
"""

from __future__ import annotations

from typing import Any

from langgraph.graph import END, START, StateGraph

from ..memory.seed import KNOWLEDGE_NAMESPACE
from .common import ask
from .registry import AgentDeps
from .state import AgentState
from .tracing import traced

SYSTEM = (
    "You are the AgentMesh research agent. Answer the user's question using only the provided "
    "context. Cite sources by their title in square brackets. If the context is insufficient, say so."
)


def build_graph(deps: AgentDeps) -> StateGraph:
    @traced("retrieve")
    async def retrieve(state: AgentState) -> dict[str, Any]:
        hits = await deps.memory.search(state["input"], k=4, namespace=KNOWLEDGE_NAMESPACE)
        return {"context": [h.as_dict() for h in hits]}

    @traced("synthesize")
    async def synthesize(state: AgentState) -> dict[str, Any]:
        context = state.get("context", [])
        ctx_text = (
            "\n\n".join(f"[{c['metadata'].get('title', 'untitled')}] {c['content']}" for c in context)
            or "(no context retrieved)"
        )
        prompt = f"Context:\n{ctx_text}\n\nQuestion: {state['input']}"
        text, usage, budget = await ask(
            deps.model, SYSTEM, prompt, budget_tokens=deps.settings.context_budget_tokens
        )
        sources = [
            {
                "title": c["metadata"].get("title", "untitled"),
                "source": c["metadata"].get("source"),
                "score": c["score"],
            }
            for c in context
        ]
        return {
            "usage": usage,
            "output": {"answer": text, "sources": sources, "budget": budget},
        }

    graph = StateGraph(AgentState)
    graph.add_node("retrieve", retrieve)
    graph.add_node("synthesize", synthesize)
    graph.add_edge(START, "retrieve")
    graph.add_edge("retrieve", "synthesize")
    graph.add_edge("synthesize", END)
    return graph
