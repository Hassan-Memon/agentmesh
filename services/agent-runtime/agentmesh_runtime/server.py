"""gRPC AgentService implementation (grpc.aio).

The servicer is thin on purpose: validate, call the engine, translate dict events into
protobuf messages. Business logic stays in runs/engine.py where it is testable without
sockets. See docs/learn/03-concepts/grpc-and-protobuf.md.
"""

from __future__ import annotations

import asyncio
import json
import logging
import signal
from collections.abc import AsyncIterator
from typing import Any

import grpc

from .agents.registry import list_agents
from .bootstrap import Runtime, build_runtime
from .config import Settings, get_settings
from .proto_gen import agent_pb2, agent_pb2_grpc
from .runs.engine import RunEngine

log = logging.getLogger(__name__)

STATUS_TO_PROTO = {
    "QUEUED": agent_pb2.RUN_STATUS_QUEUED,
    "RUNNING": agent_pb2.RUN_STATUS_RUNNING,
    "WAITING_APPROVAL": agent_pb2.RUN_STATUS_WAITING_APPROVAL,
    "COMPLETED": agent_pb2.RUN_STATUS_COMPLETED,
    "FAILED": agent_pb2.RUN_STATUS_FAILED,
    "REJECTED": agent_pb2.RUN_STATUS_REJECTED,
}


def event_to_proto(event: dict[str, Any]) -> agent_pb2.RunEvent:
    usage = event.get("usage") or None
    return agent_pb2.RunEvent(
        run_id=event["run_id"],
        agent=event["agent"],
        type=agent_pb2.RunEventType.Value(event["type"]),
        node=event.get("node", ""),
        seq=int(event["seq"]),
        timestamp=event["timestamp"],
        payload_json=json.dumps(event.get("payload", {}), default=str),
        usage=agent_pb2.TokenUsage(**usage) if usage else None,
        metadata=dict(event.get("metadata") or {}),
    )


class AgentService(agent_pb2_grpc.AgentServiceServicer):
    def __init__(self, engine: RunEngine) -> None:
        self.engine = engine

    async def ListAgents(
        self, request: agent_pb2.ListAgentsRequest, context: grpc.aio.ServicerContext
    ) -> agent_pb2.ListAgentsResponse:
        return agent_pb2.ListAgentsResponse(
            agents=[
                agent_pb2.AgentInfo(
                    name=spec.name,
                    description=spec.description,
                    version=spec.version,
                    capabilities=spec.capabilities,
                    requires_approval=spec.requires_approval,
                )
                for spec in list_agents()
            ]
        )

    async def StartRun(
        self, request: agent_pb2.StartRunRequest, context: grpc.aio.ServicerContext
    ) -> AsyncIterator[agent_pb2.RunEvent]:
        if not request.run_id or not request.agent:
            await context.abort(grpc.StatusCode.INVALID_ARGUMENT, "run_id and agent are required")
        if self.engine.store.get(request.run_id) is not None:
            await context.abort(grpc.StatusCode.ALREADY_EXISTS, f"run {request.run_id} already exists")
        try:
            stream = self.engine.start_run(
                request.run_id, request.agent, request.input, dict(request.metadata)
            )
            async for event in stream:
                yield event_to_proto(event)
        except KeyError as exc:
            await context.abort(grpc.StatusCode.NOT_FOUND, str(exc))

    async def ResumeRun(
        self, request: agent_pb2.ResumeRunRequest, context: grpc.aio.ServicerContext
    ) -> AsyncIterator[agent_pb2.RunEvent]:
        payload: dict[str, Any] | None = None
        if request.resume_payload_json:
            try:
                payload = json.loads(request.resume_payload_json)
            except json.JSONDecodeError:
                await context.abort(grpc.StatusCode.INVALID_ARGUMENT, "resume_payload_json is not valid JSON")
        try:
            stream = self.engine.resume_run(request.run_id, request.approved, request.feedback, payload)
            async for event in stream:
                yield event_to_proto(event)
        except KeyError as exc:
            await context.abort(grpc.StatusCode.NOT_FOUND, str(exc))
        except ValueError as exc:
            await context.abort(grpc.StatusCode.FAILED_PRECONDITION, str(exc))

    async def GetRun(
        self, request: agent_pb2.GetRunRequest, context: grpc.aio.ServicerContext
    ) -> agent_pb2.GetRunResponse:
        record = self.engine.store.get(request.run_id)
        if record is None:
            await context.abort(grpc.StatusCode.NOT_FOUND, f"unknown run {request.run_id}")
        assert record is not None
        return agent_pb2.GetRunResponse(
            run_id=record.run_id,
            agent=record.agent,
            status=STATUS_TO_PROTO[record.status],
            output_json=json.dumps(record.output, default=str) if record.output else "",
            interrupt_json=json.dumps(record.interrupt, default=str) if record.interrupt else "",
            usage=agent_pb2.TokenUsage(**record.usage),
            error=record.error,
        )


async def create_server(engine: RunEngine, address: str) -> tuple[grpc.aio.Server, int]:
    """Create (not start) a server. Returns (server, bound_port). Port 0 picks a free port."""
    server = grpc.aio.server(
        options=[
            ("grpc.keepalive_time_ms", 30_000),
            ("grpc.max_receive_message_length", 8 * 1024 * 1024),
        ]
    )
    agent_pb2_grpc.add_AgentServiceServicer_to_server(AgentService(engine), server)
    port = server.add_insecure_port(address)
    return server, port


async def serve(settings: Settings | None = None) -> None:
    settings = settings or get_settings()
    runtime: Runtime = await build_runtime(settings)
    server, port = await create_server(runtime.engine, f"[::]:{settings.agent_runtime_grpc_port}")
    await server.start()
    log.info("AgentService listening on :%d (agents: %s)", port, [a.name for a in list_agents()])

    stop = asyncio.Event()
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, stop.set)
        except NotImplementedError:  # Windows event loop has no signal handlers
            pass
    try:
        await stop.wait()
    except (KeyboardInterrupt, asyncio.CancelledError):
        pass
    finally:
        log.info("shutting down")
        await server.stop(grace=5)
        await runtime.close()
