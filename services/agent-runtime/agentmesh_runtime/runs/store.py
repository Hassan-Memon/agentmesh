"""In-process view of runs, used to answer GetRun.

The durable record of a run lives in two places that are not this class: the LangGraph
checkpointer (graph state, for resume) and the gateway's Postgres (status + event log,
for the product). This store is the runtime's fast, local answer to "what is run X doing
right now", and it is also where per-run sequence numbers are issued.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any

STATUS_QUEUED = "QUEUED"
STATUS_RUNNING = "RUNNING"
STATUS_WAITING_APPROVAL = "WAITING_APPROVAL"
STATUS_COMPLETED = "COMPLETED"
STATUS_FAILED = "FAILED"
STATUS_REJECTED = "REJECTED"


def _now() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


@dataclass(slots=True)
class RunRecord:
    run_id: str
    agent: str
    status: str = STATUS_QUEUED
    output: dict[str, Any] | None = None
    interrupt: dict[str, Any] | None = None
    usage: dict[str, int] = field(
        default_factory=lambda: {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}
    )
    error: str = ""
    seq: int = 0
    metadata: dict[str, str] = field(default_factory=dict)
    events: list[dict[str, Any]] = field(default_factory=list)
    created_at: str = field(default_factory=_now)
    updated_at: str = field(default_factory=_now)

    def next_seq(self) -> int:
        self.seq += 1
        return self.seq

    def add_usage(self, usage: dict[str, int]) -> None:
        for key in self.usage:
            self.usage[key] += int(usage.get(key, 0))


class RunStore:
    def __init__(self, max_events: int = 500) -> None:
        self._runs: dict[str, RunRecord] = {}
        self._max_events = max_events

    def create(self, run_id: str, agent: str, metadata: dict[str, str] | None = None) -> RunRecord:
        record = RunRecord(run_id=run_id, agent=agent, metadata=dict(metadata or {}))
        self._runs[run_id] = record
        return record

    def get(self, run_id: str) -> RunRecord | None:
        return self._runs.get(run_id)

    def require(self, run_id: str) -> RunRecord:
        record = self._runs.get(run_id)
        if record is None:
            raise KeyError(f"unknown run {run_id!r}")
        return record

    def append_event(self, record: RunRecord, event: dict[str, Any]) -> None:
        record.events.append(event)
        if len(record.events) > self._max_events:
            del record.events[: len(record.events) - self._max_events]
        record.updated_at = _now()

    def all(self) -> list[RunRecord]:
        return list(self._runs.values())
