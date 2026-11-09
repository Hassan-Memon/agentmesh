"""Run engine: executes a graph for a run and turns what happens into RunEvents.

One function (`_stream`) handles both StartRun and ResumeRun. The only difference is the
input: a fresh state dict, or `Command(resume=...)` which tells LangGraph to continue the
thread from its last checkpoint.

Event dicts produced here have the same field names as the proto RunEvent (snake_case) so
the gRPC server can map them 1:1 and the bus consumer in the gateway can read them as JSON.
"""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from datetime import UTC, datetime
from typing import Any

from agentmesh_bus import EventBus
from langgraph.checkpoint.base import BaseCheckpointSaver
from langgraph.graph.state import CompiledStateGraph
from langgraph.types import Command

from ..agents.registry import AgentDeps, AgentSpec, get_agent
from .store import (
    STATUS_COMPLETED,
    STATUS_FAILED,
    STATUS_REJECTED,
    STATUS_RUNNING,
    STATUS_WAITING_APPROVAL,
    RunRecord,
    RunStore,
)

log = logging.getLogger(__name__)

CUSTOM_TYPE_MAP = {
    "node_started": "NODE_STARTED",
    "node_finished": "NODE_FINISHED",
    "node_failed": "LOG",
    "token_usage": "TOKEN_USAGE",
    "log": "LOG",
}


def _now() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


class RunEngine:
    def __init__(
        self,
        deps: AgentDeps,
        checkpointer: BaseCheckpointSaver[Any],
        bus: EventBus,
        store: RunStore,
    ) -> None:
        self.deps = deps
        self.checkpointer = checkpointer
        self.bus = bus
        self.store = store
        self._graphs: dict[str, CompiledStateGraph] = {}

    # ----------------------------------------------------------------- public API

    async def start_run(
        self, run_id: str, agent: str, input_text: str, metadata: dict[str, str] | None = None
    ) -> AsyncIterator[dict[str, Any]]:
        spec = get_agent(agent)  # raises KeyError for unknown agents
        record = self.store.create(run_id, agent, metadata)
        initial_state = {"run_id": run_id, "input": input_text, "metadata": dict(metadata or {})}
        async for event in self._stream(spec, record, initial_state, started_type="RUN_STARTED"):
            yield event

    async def resume_run(
        self,
        run_id: str,
        approved: bool,
        feedback: str = "",
        resume_payload: dict[str, Any] | None = None,
    ) -> AsyncIterator[dict[str, Any]]:
        record = self.store.require(run_id)
        if record.status != STATUS_WAITING_APPROVAL:
            raise ValueError(f"run {run_id} is {record.status}, not waiting for approval")
        spec = get_agent(record.agent)
        decision = {"approved": approved, "feedback": feedback, **(resume_payload or {})}
        async for event in self._stream(
            spec, record, Command(resume=decision), started_type="RESUMED", started_payload=decision
        ):
            yield event

    def graph_for(self, spec: AgentSpec) -> CompiledStateGraph:
        if spec.name not in self._graphs:
            self._graphs[spec.name] = spec.build_graph(self.deps).compile(checkpointer=self.checkpointer)
        return self._graphs[spec.name]

    # ----------------------------------------------------------------- internals

    async def _stream(
        self,
        spec: AgentSpec,
        record: RunRecord,
        graph_input: Any,
        *,
        started_type: str,
        started_payload: dict[str, Any] | None = None,
    ) -> AsyncIterator[dict[str, Any]]:
        graph = self.graph_for(spec)
        # thread_id == run_id: the checkpointer keys state by thread, so a run can be resumed later.
        config = {"configurable": {"thread_id": record.run_id}}

        record.status = STATUS_RUNNING
        record.interrupt = None
        yield await self._emit(
            record, started_type, payload=started_payload or {"input": _preview(graph_input)}
        )

        try:
            interrupted = False
            async for mode, chunk in graph.astream(
                graph_input, config=config, stream_mode=["custom", "updates"]
            ):
                if mode == "custom":
                    event = await self._from_custom(record, chunk)
                    if event:
                        yield event
                elif mode == "updates" and isinstance(chunk, dict) and "__interrupt__" in chunk:
                    interrupted = True
                    interrupts = chunk["__interrupt__"]
                    value = interrupts[0].value if interrupts else {}
                    record.interrupt = value if isinstance(value, dict) else {"value": value}
                    record.status = STATUS_WAITING_APPROVAL
                    yield await self._emit(
                        record, "INTERRUPT", node="human_approval", payload=record.interrupt
                    )

            if interrupted:
                return

            snapshot = await graph.aget_state(config)
            output = snapshot.values.get("output") or {}
            record.output = output
            record.status = STATUS_REJECTED if output.get("status") == "rejected" else STATUS_COMPLETED
            yield await self._emit(
                record, "DONE", payload={"output": output, "status": record.status}, usage=record.usage
            )
        except Exception as exc:  # noqa: BLE001 - surface every failure as an event
            log.exception("run %s failed", record.run_id)
            record.status = STATUS_FAILED
            record.error = str(exc)
            yield await self._emit(record, "FAILED", payload={"error": str(exc)})

    async def _from_custom(self, record: RunRecord, chunk: Any) -> dict[str, Any] | None:
        if not isinstance(chunk, dict) or "type" not in chunk:
            return None
        kind = CUSTOM_TYPE_MAP.get(chunk["type"])
        if kind is None:
            return None
        payload = {k: v for k, v in chunk.items() if k not in {"type", "node", "usage"}}
        usage = chunk.get("usage")
        if usage:
            record.add_usage(usage)
        return await self._emit(record, kind, node=chunk.get("node", ""), payload=payload, usage=usage)

    async def _emit(
        self,
        record: RunRecord,
        kind: str,
        *,
        node: str = "",
        payload: dict[str, Any] | None = None,
        usage: dict[str, int] | None = None,
    ) -> dict[str, Any]:
        event = {
            "run_id": record.run_id,
            "agent": record.agent,
            "type": kind,
            "node": node,
            "seq": record.next_seq(),
            "timestamp": _now(),
            "payload": payload or {},
            "usage": usage,
            "metadata": record.metadata,
            "status": record.status,
        }
        self.store.append_event(record, event)
        try:
            await self.bus.publish(f"run.{record.run_id}.{kind.lower()}", event)
        except Exception:  # noqa: BLE001 - the bus is observability, never the critical path
            log.warning("bus publish failed for run %s (%s)", record.run_id, kind, exc_info=True)
        return event


def _preview(graph_input: Any) -> str:
    if isinstance(graph_input, dict):
        text = str(graph_input.get("input", ""))
    else:
        text = str(graph_input)
    return text if len(text) <= 200 else text[:197] + "..."
