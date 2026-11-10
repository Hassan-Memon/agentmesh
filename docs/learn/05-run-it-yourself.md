# 05. Run it yourself

Exercises in three flavours: observe it, break it, extend it. Each should take 15 to 60
minutes. Start the stack first:

```bash
cp .env.example .env
docker compose -f infra/docker-compose.yml up --build
```

## Observe

**1. Follow one run through every layer.**
Start a `reviewer` run from the dashboard. In parallel open: the RabbitMQ management UI
(http://localhost:15672, exchange `agentmesh.events`), the gateway logs
(`docker compose logs -f gateway`), the runtime logs, and the browser Network tab filtered
to WS. Map each `run.event` frame to a log line and a broker message. Then approve it and do
it again for the resume path.

**2. Read the checkpoint.**
`docker compose exec postgres psql -U agentmesh -c "select thread_id, checkpoint_id, parent_checkpoint_id from checkpoints order by checkpoint_id desc limit 10;"`
Find the run id you just approved. Count the checkpoints and match them to nodes.

**3. See the budgeter work.**
Set `CONTEXT_BUDGET_TOKENS=300` in `.env`, restart the runtime, run `researcher`, and read
the `budget` block in the output. Raise it until `dropped` is zero.

## Break

**4. Kill the broker.**
`docker compose stop rabbitmq` mid-run. Expect: runtime logs a publish warning, gateway
switches `busRelay` to false on `/health`, and the dashboard still updates because the
gRPC path emits. Start RabbitMQ again and confirm the relay comes back without a restart.

**5. Kill the runtime during an approval.**
Start a `reviewer` run, wait for the approval card, then `docker compose restart
agent-runtime`. Approve. Expect: it works, because the checkpoint is in Postgres. Now set
`DATABASE_URL=` for the runtime (in-memory checkpointer), repeat, and watch the approve call
fail with a clear `FAILED_PRECONDITION`/404. Write down why.

**6. Send duplicates.**
Publish a copy of an existing event by hand from the RabbitMQ UI (copy a payload from
`GET /runs/:id/events`, publish to `agentmesh.events` with routing key `run.<id>.done`).
Expect: the dashboard shows nothing new (dedupe by `seq`), and `GET /runs/:id/events` has no
duplicate row.

**7. Break the contract.**
Rename `payload_json` to `payload` in `agent.proto`, regenerate Python stubs, restart the
runtime only. Observe how the gateway fails (proto-loader reads the file at startup, so it
does not fail until restarted; the Python side now sends a field the old gateway never reads).
Revert. Lesson: proto changes need coordinated deploys unless they are additive.

## Extend

**8. Add a fourth agent.**
Create `agents/summarizer.py` with one node that calls `ask()`, register it in
`registry.py`, add a test in `tests/test_agents.py`. No gateway or dashboard changes should
be needed; confirm it appears on `/agents` and in the new-run form.

**9. Add an SSE endpoint.**
In the gateway, add `GET /runs/:id/stream` that subscribes to the WebSocket gateway's events
for that run and writes them as `text/event-stream`. Compare the code size with the Socket.IO
path and decide which you would keep if you could only have one. Read
`03-concepts/websockets-vs-sse-vs-webrtc.md` first.

**10. Swap the broker.**
`docker compose --profile kafka up`, set `BUS_URL=kafka://redpanda:9092` on the runtime, and
start a run. The gateway consumer is RabbitMQ only; write a Kafka consumer in Nest with
`kafkajs` that reuses `fromBusMessage`. Note what you had to change (routing patterns become
client-side filters) and what you did not (the event shape).

**11. Make `POST /runs` idempotent.**
Accept an `Idempotency-Key` header, store it on `Run` with a unique index (new Prisma
migration), and return the existing run on a retry. Add a Jest test.

**12. Add token streaming.**
Add `"messages"` to the `stream_mode` list in `engine.py`, map token chunks to a new `TOKEN`
RunEvent type (new enum value in the proto, regenerate), and render them in the timeline as
they arrive. Think about volume: hundreds of events per node. Where would you throttle?

## Check yourself

After the exercises you should be able to answer, without notes: where is run state stored
and why in three places; what guarantees the bus gives and how the system copes; what
`interrupt()` does on the second execution of a node; and what breaks first at 10x.
