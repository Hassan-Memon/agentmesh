# LangGraph interrupts and checkpoints

**In one line:** a checkpointer saves the graph state after every node; `interrupt()` stops
the graph at a point of your choosing and lets you continue later from that saved state
with a value from the outside world.

## Checkpoints

When a graph is compiled with a checkpointer (`spec.build_graph(deps).compile(checkpointer=
...)` in `runs/engine.py`), LangGraph writes the full state to it after each node, keyed by
a `thread_id` from the config:

```python
config = {"configurable": {"thread_id": run_id}}
async for mode, chunk in graph.astream(state, config=config, stream_mode=["custom", "updates"]):
```

Two consequences:

- **Resume.** Invoking the graph again with the same `thread_id` continues from the last
  checkpoint rather than starting over.
- **History.** `graph.aget_state(config)` returns the current snapshot;
  `aget_state_history` walks back in time. This is the run's episodic memory (ADR-0004).

Two checkpointers are wired in `runs/checkpointer.py`: `InMemorySaver` (tests, demos) and
`AsyncPostgresSaver` from `langgraph-checkpoint-postgres` (production). The Postgres saver is
what allows a different runtime process to resume a run.

## interrupt()

In `agents/reviewer.py`:

```python
@traced("human_approval")
async def human_approval(state):
    decision = interrupt({"question": "...", "review": state["review"]})
    return {"approval": decision}
```

The first time this node runs, `interrupt()` does not return. Internally it raises a special
exception; LangGraph catches it, checkpoints, and the `astream` loop yields an update
`{"__interrupt__": (Interrupt(value={...}),)}`. The engine handles that in
`RunEngine._stream`: it records the payload, sets status `WAITING_APPROVAL`, emits an
`INTERRUPT` event and returns. The run is now paused and costs nothing.

To continue:

```python
graph.astream(Command(resume={"approved": True, "feedback": "ship it"}), config=config, ...)
```

LangGraph loads the checkpoint, re-executes `human_approval` from the top, and this time
`interrupt()` returns the resume value. The node returns `{"approval": ...}`, the graph
proceeds to `finalize`, and the engine emits `DONE`.

## The one rule

**Code before `interrupt()` in the same node runs twice.** Keep that code pure (reading
state, building the prompt). Anything with a side effect (writing to a database, sending an
email) belongs in the node *after* the interrupt. The reviewer graph follows this: `review`
calls the model, `human_approval` only interrupts, `finalize` only shapes output.

## Why not just stop the graph and start a new one?

You could end the graph at "needs approval" and start a second graph on approval. You would
then have to carry the review, the input and any intermediate state across yourself, and
the dashboard would see two runs. With `interrupt()` it is one run, one thread, one
timeline, and the agent author wrote one line. ADR-0005 goes deeper.

## Streaming modes used here

`stream_mode=["custom", "updates"]` returns `(mode, chunk)` tuples:

- `"updates"` yields `{node_name: partial_state}` after each node, and the `__interrupt__`
  marker.
- `"custom"` yields whatever nodes pass to `get_stream_writer()`. The `@traced` decorator in
  `agents/tracing.py` uses it for `node_started`, `node_finished` and `token_usage`.

Other modes you may meet: `"values"` (the whole state after each step), `"messages"` (LLM
tokens as they stream), `"debug"`.

## State and reducers

`agents/state.py` is a `TypedDict`. A node returns a partial dict that is merged in. Fields
annotated with a reducer merge differently: `messages` uses `add_messages` (append),
`usage` uses our `merge_usage` (sum the token counts). Everything else is last-write-wins.

## Try it

`uv run pytest tests/test_agents.py -k reviewer -v` runs the interrupt and both resume
paths (approve, reject) against the in-memory checkpointer in under a second.
