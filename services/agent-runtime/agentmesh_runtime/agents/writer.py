"""writer: two-step long-form writing.

    START -> outline -> draft -> END

Two nodes instead of one so the dashboard shows real progress and so the outline is
checkpointed: if the draft call fails, a retry resumes after the outline.
"""

from __future__ import annotations

from typing import Any

from langgraph.graph import END, START, StateGraph

from .common import ask
from .registry import AgentDeps
from .state import AgentState
from .tracing import traced

OUTLINE_SYSTEM = (
    "You are the AgentMesh writing agent. Produce a numbered outline (4 to 6 points) for the "
    "requested piece. Output only the outline."
)
DRAFT_SYSTEM = (
    "You are the AgentMesh writing agent. Write the full draft following the given outline. "
    "Plain prose, short paragraphs, no em-dashes."
)


def build_graph(deps: AgentDeps) -> StateGraph:
    budget = deps.settings.context_budget_tokens

    @traced("outline")
    async def outline(state: AgentState) -> dict[str, Any]:
        text, usage, _ = await ask(deps.model, OUTLINE_SYSTEM, state["input"], budget_tokens=budget)
        return {"outline": text, "usage": usage}

    @traced("draft")
    async def draft(state: AgentState) -> dict[str, Any]:
        prompt = f"Topic: {state['input']}\n\nOutline:\n{state.get('outline', '')}"
        text, usage, budget_report = await ask(deps.model, DRAFT_SYSTEM, prompt, budget_tokens=budget)
        return {
            "draft": text,
            "usage": usage,
            "output": {"outline": state.get("outline", ""), "draft": text, "budget": budget_report},
        }

    graph = StateGraph(AgentState)
    graph.add_node("outline", outline)
    graph.add_node("draft", draft)
    graph.add_edge(START, "outline")
    graph.add_edge("outline", "draft")
    graph.add_edge("draft", END)
    return graph
