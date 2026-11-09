"""Node tracing: turn every node into NODE_STARTED / NODE_FINISHED / TOKEN_USAGE events.

LangGraph's `get_stream_writer()` returns a function bound to the current graph run; anything
passed to it is yielded by `graph.astream(..., stream_mode="custom")`. The run engine
listens for these and converts them into RunEvents. Doing it in a decorator means agent
authors never think about events; they just write nodes.
"""

from __future__ import annotations

import functools
import time
from collections.abc import Awaitable, Callable
from typing import Any

from langgraph.config import get_stream_writer

from .state import AgentState

NodeFn = Callable[[AgentState], Awaitable[dict[str, Any]]]


def traced(node_name: str) -> Callable[[NodeFn], NodeFn]:
    def decorate(fn: NodeFn) -> NodeFn:
        @functools.wraps(fn)
        async def wrapper(state: AgentState) -> dict[str, Any]:
            writer = _writer()
            writer({"type": "node_started", "node": node_name})
            started = time.perf_counter()
            try:
                result = await fn(state)
            except Exception as exc:
                writer({"type": "node_failed", "node": node_name, "error": str(exc)})
                raise
            duration_ms = round((time.perf_counter() - started) * 1000, 1)
            writer(
                {
                    "type": "node_finished",
                    "node": node_name,
                    "duration_ms": duration_ms,
                    "summary": summarize_update(result),
                }
            )
            usage = result.get("usage") if isinstance(result, dict) else None
            if usage:
                writer({"type": "token_usage", "node": node_name, "usage": usage})
            return result

        return wrapper

    return decorate


def _writer() -> Callable[[Any], None]:
    try:
        return get_stream_writer()
    except Exception:  # not running inside a graph (unit test calling the node directly)
        return lambda _payload: None


def summarize_update(update: Any, limit: int = 240) -> dict[str, Any]:
    """Shrink a node's state update into something safe to ship over the wire."""
    if not isinstance(update, dict):
        return {"value": _short(str(update), limit)}
    out: dict[str, Any] = {}
    for key, value in update.items():
        if key in {"messages", "usage"}:
            continue
        if isinstance(value, str):
            out[key] = _short(value, limit)
        elif isinstance(value, list):
            out[key] = f"{len(value)} item(s)"
        elif isinstance(value, dict):
            out[key] = {k: _short(str(v), 80) for k, v in list(value.items())[:8]}
        else:
            out[key] = _short(str(value), limit)
    return out


def _short(text: str, limit: int) -> str:
    return text if len(text) <= limit else text[: limit - 3] + "..."
