"""reviewer: model review followed by a mandatory human decision.

    START -> review -> human_approval -> finalize -> END

`human_approval` calls LangGraph's `interrupt()`. The first time the node runs, interrupt()
raises internally, the graph persists a checkpoint and `astream` yields an `__interrupt__`
update. Nothing else runs until the gateway calls ResumeRun, which re-invokes the graph with
`Command(resume={...})`; LangGraph replays the node and this time `interrupt()` returns the
resume value. See docs/learn/03-concepts/langgraph-interrupts-and-checkpoints.md.
"""

from __future__ import annotations

from typing import Any

from langgraph.graph import END, START, StateGraph
from langgraph.types import interrupt

from .common import ask, parse_json_object
from .registry import AgentDeps
from .state import AgentState
from .tracing import traced

REVIEW_SYSTEM = (
    "You are the AgentMesh review agent. Review the submitted text for clarity, correctness and "
    "tone. Return JSON only with keys: verdict ('approve' | 'revise'), score (1-10), notes (list of strings)."
)


def build_graph(deps: AgentDeps) -> StateGraph:
    @traced("review")
    async def review(state: AgentState) -> dict[str, Any]:
        text, usage, _ = await ask(
            deps.model, REVIEW_SYSTEM, state["input"], budget_tokens=deps.settings.context_budget_tokens
        )
        parsed = parse_json_object(text) or {"verdict": "revise", "score": 0, "notes": [text]}
        return {"review": parsed, "usage": usage}

    @traced("human_approval")
    async def human_approval(state: AgentState) -> dict[str, Any]:
        decision = interrupt(
            {
                "question": "The reviewer recommends a verdict. Approve to publish, reject to send back.",
                "review": state.get("review", {}),
                "submission_preview": state["input"][:400],
            }
        )
        # `decision` is whatever ResumeRun passed: {"approved": bool, "feedback": str, ...}
        return {"approval": decision if isinstance(decision, dict) else {"approved": bool(decision)}}

    @traced("finalize")
    async def finalize(state: AgentState) -> dict[str, Any]:
        approval = state.get("approval", {})
        approved = bool(approval.get("approved"))
        return {
            "output": {
                "status": "approved" if approved else "rejected",
                "review": state.get("review", {}),
                "feedback": approval.get("feedback", ""),
                "approved_by": approval.get("approved_by", "dashboard"),
            }
        }

    graph = StateGraph(AgentState)
    graph.add_node("review", review)
    graph.add_node("human_approval", human_approval)
    graph.add_node("finalize", finalize)
    graph.add_edge(START, "review")
    graph.add_edge("review", "human_approval")
    graph.add_edge("human_approval", "finalize")
    graph.add_edge("finalize", END)
    return graph
