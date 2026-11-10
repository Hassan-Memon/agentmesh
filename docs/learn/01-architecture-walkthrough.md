# 01. Architecture walkthrough

This lesson follows one request through every box in the system and explains why each box
exists. Read it with the repository open; every section names the file it describes.

## The boxes

**Dashboard** (`apps/dashboard`). Next.js 15. It shows state and collects two inputs:
"start a run" and "approve or reject". It talks to the gateway over HTTP and a WebSocket,
never to Python. It is a separate app because Vercel hosts Next.js free, and server
components keep list pages fast.

**Gateway** (`apps/gateway`). A Nest.js service. It is the edge: it validates requests
(`runs/dto/*.ts`), persists run records with Prisma (`prisma/schema.prisma`), relays events
to browsers (`ws/runs.gateway.ts`), and translates between the browser's world (JSON, REST,
WebSocket) and the runtime's world (protobuf, gRPC). It owns no agent logic.

**Agent runtime** (`services/agent-runtime`). A Python gRPC server. It hosts LangGraph
graphs discovered from a registry (`agents/registry.py`), executes them (`runs/engine.py`),
and emits events. It owns all AI concerns: models (`llm.py`), embeddings and vector search
(`memory/`), context budgeting (`context.py`), checkpoints (`runs/checkpointer.py`).

**Event bus** (`packages/bus`, RabbitMQ in compose). Every RunEvent the runtime emits is
published to a topic exchange with the routing key `run.<run_id>.<type>`. The gateway
consumes it to fan out to WebSocket clients, and anything else (an audit log, a billing
service) can bind its own queue without the runtime knowing.

**Postgres with pgvector**. Three uses in one database: the gateway's `Run` and `RunEvent`
tables, LangGraph's checkpoint tables, and the `agent_memories` vector table.

**Optional boxes.** MongoDB for the event log (when `MONGO_URL` is set), Redpanda as a
Kafka-compatible bus, Ollama for a local model, Redis reserved for later.

## The request path, end to end

1. **You click "Start run"** in `components/run-form.tsx`. It `POST`s `/runs` with
   `{agent, input, metadata}` via `lib/api.ts`.

2. **`RunsController.start`** (`runs/runs.controller.ts`) receives it. The global
   `ValidationPipe` already checked the body against `StartRunDto`. The controller calls
   `RunsService.start`.

3. **`RunsService.start`** (`runs/runs.service.ts`) generates a UUID, inserts a `Run` row
   with status `QUEUED`, then calls `AgentGrpcClient.startRun(...)`. It does not await the
   stream; it returns the run record so the HTTP response is immediate (202 Accepted). The
   dashboard navigates to `/runs/<id>`.

4. **`AgentGrpcClient`** (`grpc/agent-grpc.client.ts`) loaded `agent.proto` at startup with
   `@grpc/proto-loader` and holds a channel to the runtime. `StartRun` is a server-streaming
   RPC, so it returns a readable stream of `RunEvent` messages.

5. **`AgentService.StartRun`** (`agentmesh_runtime/server.py`) receives the call, asks
   `RunEngine.start_run` for an async iterator of events, converts each dict to a protobuf
   `RunEvent` and yields it.

6. **`RunEngine._stream`** (`runs/engine.py`) looks up the agent, compiles its graph with the
   checkpointer (once, cached), and runs `graph.astream(state, config, stream_mode=["custom",
   "updates"])` with `thread_id = run_id`. Each node is wrapped by `@traced` (`agents/tracing.py`),
   which writes `node_started`, `node_finished` and `token_usage` into the custom stream. The
   engine turns these into RunEvents, assigns a per-run `seq`, stores them in `RunStore`, and
   publishes each to the bus.

7. **Inside a node**, say `researcher.synthesize`, the code calls `ask()` in
   `agents/common.py`. That trims the messages to the token budget (`context.py`) and
   invokes the model from `llm.py`. In `DEMO_MODE` that is the `StubChatModel`; otherwise it
   is `ChatOpenAI` pointed at Ollama, Groq, Gemini, OpenRouter or OpenInfer.

8. **If the graph calls `interrupt()`** (the `reviewer` agent), LangGraph writes a checkpoint
   and the stream yields an `__interrupt__` update. The engine emits an `INTERRUPT` event with
   the prompt and stops. The gRPC stream ends.

9. **Back in the gateway**, the stream consumer in `RunsService.consume` appends every event
   to the event log, updates the run's status (`applyStatus`), and, if no bus relay is active,
   emits it to the WebSocket room `run:<id>`. If RabbitMQ is configured, the
   `RabbitMqConsumerService` does the emitting instead, so any gateway replica relays any run.

10. **In the browser**, `components/live-run.tsx` joined the room on mount and merges each
    `run.event` by `seq`. On `INTERRUPT` it refetches the run and shows `ApprovalCard`.

11. **You click Approve.** `POST /runs/:id/approve` -> `RunsService.approve` checks the status
    is `WAITING_APPROVAL`, then calls `ResumeRun`. The engine runs the same graph with
    `Command(resume={...})`; LangGraph loads the checkpoint, `interrupt()` returns your
    decision, and `finalize` produces the output. A `DONE` event closes the loop and the run
    row gets `status = COMPLETED` and the output JSON.

Every arrow is either a typed contract (protobuf, Prisma, DTOs) or deliberately loose JSON
(event payloads, agent outputs) so agents evolve without redeploying the gateway.
