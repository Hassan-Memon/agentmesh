"""End-to-end graph tests through the RunEngine with the stub model."""

import pytest

from agentmesh_runtime.agents import list_agents
from agentmesh_runtime.bootstrap import Runtime

from .conftest import collect


def types(events: list[dict]) -> list[str]:
    return [e["type"] for e in events]


def test_registry_has_three_agents_and_reviewer_requires_approval() -> None:
    names = {a.name: a for a in list_agents()}
    assert set(names) == {"researcher", "writer", "reviewer"}
    assert names["reviewer"].requires_approval is True
    assert names["researcher"].requires_approval is False


async def test_researcher_retrieves_then_answers_with_sources(runtime: Runtime) -> None:
    events = await collect(runtime.engine.start_run("r1", "researcher", "How does human in the loop work?"))
    assert types(events) == [
        "RUN_STARTED",
        "NODE_STARTED",
        "NODE_FINISHED",
        "NODE_STARTED",
        "NODE_FINISHED",
        "TOKEN_USAGE",
        "DONE",
    ]
    assert [e["node"] for e in events if e["type"] == "NODE_STARTED"] == ["retrieve", "synthesize"]
    done = events[-1]
    assert done["payload"]["status"] == "COMPLETED"
    output = done["payload"]["output"]
    assert "answer" in output and len(output["sources"]) > 0
    assert output["sources"][0]["title"] == "Human in the loop"  # lexical overlap wins with stub embeddings
    assert done["usage"]["total_tokens"] > 0
    # sequence numbers are monotonic starting at 1
    assert [e["seq"] for e in events] == list(range(1, len(events) + 1))


async def test_writer_produces_outline_then_draft(runtime: Runtime) -> None:
    events = await collect(runtime.engine.start_run("w1", "writer", "Why gRPC between services"))
    assert [e["node"] for e in events if e["type"] == "NODE_FINISHED"] == ["outline", "draft"]
    output = events[-1]["payload"]["output"]
    assert output["outline"].startswith("1.")
    assert "draft" in output and output["draft"]
    record = runtime.engine.store.require("w1")
    assert record.status == "COMPLETED"
    assert record.usage["total_tokens"] == events[-1]["usage"]["total_tokens"]


async def test_reviewer_interrupts_then_resumes_on_approval(runtime: Runtime) -> None:
    first = await collect(runtime.engine.start_run("rv1", "reviewer", "Please review this paragraph."))
    assert first[-1]["type"] == "INTERRUPT"
    assert first[-1]["payload"]["review"]["verdict"] == "approve"
    record = runtime.engine.store.require("rv1")
    assert record.status == "WAITING_APPROVAL"
    assert record.interrupt is not None and "question" in record.interrupt

    second = await collect(runtime.engine.resume_run("rv1", approved=True, feedback="ship it"))
    assert second[0]["type"] == "RESUMED"
    assert second[-1]["type"] == "DONE"
    assert second[-1]["payload"]["output"]["status"] == "approved"
    assert second[-1]["payload"]["output"]["feedback"] == "ship it"
    assert record.status == "COMPLETED"
    # resume continues the sequence instead of restarting it
    assert second[0]["seq"] == first[-1]["seq"] + 1


async def test_reviewer_rejection_marks_run_rejected(runtime: Runtime) -> None:
    await collect(runtime.engine.start_run("rv2", "reviewer", "Draft to reject."))
    events = await collect(runtime.engine.resume_run("rv2", approved=False, feedback="needs work"))
    assert events[-1]["payload"]["output"]["status"] == "rejected"
    assert runtime.engine.store.require("rv2").status == "REJECTED"


async def test_resume_requires_waiting_run(runtime: Runtime) -> None:
    await collect(runtime.engine.start_run("w2", "writer", "x"))
    with pytest.raises(ValueError):
        await collect(runtime.engine.resume_run("w2", approved=True))
    with pytest.raises(KeyError):
        await collect(runtime.engine.resume_run("nope", approved=True))


async def test_unknown_agent_raises_before_any_event(runtime: Runtime) -> None:
    with pytest.raises(KeyError):
        await collect(runtime.engine.start_run("x1", "does-not-exist", "x"))


async def test_every_event_is_published_to_the_bus_with_routing_key(runtime: Runtime) -> None:
    bus = runtime.bus
    async with bus.subscribe("run.b1.#") as sub:
        events = await collect(runtime.engine.start_run("b1", "writer", "bus check"))
        received = [await sub.get(timeout=1) for _ in events]
    assert [env.payload["seq"] for env in received] == [e["seq"] for e in events]
    assert received[0].routing_key == "run.b1.run_started"
    assert received[-1].routing_key == "run.b1.done"
