"""Exercise the real gRPC surface over loopback with an in-process server."""

import json

import grpc
import pytest

from agentmesh_runtime.bootstrap import Runtime
from agentmesh_runtime.proto_gen import agent_pb2, agent_pb2_grpc
from agentmesh_runtime.server import create_server


@pytest.fixture
async def stub(runtime: Runtime):
    server, port = await create_server(runtime.engine, "127.0.0.1:0")
    await server.start()
    async with grpc.aio.insecure_channel(f"127.0.0.1:{port}") as channel:
        yield agent_pb2_grpc.AgentServiceStub(channel)
    await server.stop(grace=None)


async def test_list_agents(stub) -> None:
    resp = await stub.ListAgents(agent_pb2.ListAgentsRequest())
    names = {a.name: a for a in resp.agents}
    assert set(names) == {"researcher", "writer", "reviewer"}
    assert names["reviewer"].requires_approval is True
    assert "rag" in names["researcher"].capabilities


async def test_start_run_streams_events_and_get_run_reports_completion(stub) -> None:
    req = agent_pb2.StartRunRequest(run_id="g1", agent="writer", input="hello", metadata={"tenant": "t1"})
    events = [e async for e in stub.StartRun(req)]
    assert events[0].type == agent_pb2.RUN_STARTED
    assert events[-1].type == agent_pb2.DONE
    assert events[-1].metadata["tenant"] == "t1"
    assert json.loads(events[-1].payload_json)["output"]["draft"]
    assert events[-1].usage.total_tokens > 0

    run = await stub.GetRun(agent_pb2.GetRunRequest(run_id="g1"))
    assert run.status == agent_pb2.RUN_STATUS_COMPLETED
    assert json.loads(run.output_json)["outline"]


async def test_hitl_round_trip_over_grpc(stub) -> None:
    start = [
        e async for e in stub.StartRun(agent_pb2.StartRunRequest(run_id="g2", agent="reviewer", input="txt"))
    ]
    assert start[-1].type == agent_pb2.INTERRUPT
    waiting = await stub.GetRun(agent_pb2.GetRunRequest(run_id="g2"))
    assert waiting.status == agent_pb2.RUN_STATUS_WAITING_APPROVAL
    assert json.loads(waiting.interrupt_json)["question"]

    resumed = [
        e
        async for e in stub.ResumeRun(
            agent_pb2.ResumeRunRequest(
                run_id="g2", approved=True, resume_payload_json='{"approved_by": "qa"}'
            )
        )
    ]
    assert resumed[-1].type == agent_pb2.DONE
    out = json.loads(resumed[-1].payload_json)["output"]
    assert out["status"] == "approved" and out["approved_by"] == "qa"


async def test_error_status_codes(stub) -> None:
    with pytest.raises(grpc.aio.AioRpcError) as exc:
        [e async for e in stub.StartRun(agent_pb2.StartRunRequest(run_id="g3", agent="missing", input="x"))]
    assert exc.value.code() == grpc.StatusCode.NOT_FOUND

    with pytest.raises(grpc.aio.AioRpcError) as exc:
        await stub.GetRun(agent_pb2.GetRunRequest(run_id="never"))
    assert exc.value.code() == grpc.StatusCode.NOT_FOUND

    [e async for e in stub.StartRun(agent_pb2.StartRunRequest(run_id="g4", agent="writer", input="x"))]
    with pytest.raises(grpc.aio.AioRpcError) as exc:
        [e async for e in stub.ResumeRun(agent_pb2.ResumeRunRequest(run_id="g4", approved=True))]
    assert exc.value.code() == grpc.StatusCode.FAILED_PRECONDITION
