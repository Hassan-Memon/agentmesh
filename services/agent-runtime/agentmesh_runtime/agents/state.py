"""Shared graph state.

LangGraph state is a TypedDict; each node returns a partial dict that is merged into it.
Keys annotated with a reducer (`Annotated[type, fn]`) merge instead of overwrite:
`messages` appends, `usage` sums. Everything else is last-write-wins.

This state is the *short-term memory* of a run. Because every node result is written to a
checkpoint, the history of this state is also the run's *episodic memory*.
"""

from __future__ import annotations

from typing import Annotated, Any, TypedDict

from langchain_core.messages import BaseMessage
from langgraph.graph.message import add_messages


def merge_usage(left: dict[str, int] | None, right: dict[str, int] | None) -> dict[str, int]:
    """Reducer: add token counts from each node into a running total."""
    left = left or {}
    right = right or {}
    keys = {"prompt_tokens", "completion_tokens", "total_tokens"}
    return {k: int(left.get(k, 0)) + int(right.get(k, 0)) for k in keys}


class AgentState(TypedDict, total=False):
    run_id: str
    input: str
    metadata: dict[str, str]

    messages: Annotated[list[BaseMessage], add_messages]
    usage: Annotated[dict[str, int], merge_usage]

    # researcher
    context: list[dict[str, Any]]
    # writer
    outline: str
    draft: str
    # reviewer
    review: dict[str, Any]
    approval: dict[str, Any]

    # every agent ends by setting this
    output: dict[str, Any]
