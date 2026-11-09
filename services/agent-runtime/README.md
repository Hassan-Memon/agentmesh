# agent-runtime

Python gRPC server that hosts LangGraph agents for AgentMesh.

```bash
uv sync                                  # creates .venv, installs agentmesh-bus from ../../packages/bus
DEMO_MODE=1 uv run pytest                # offline tests: stub LLM, in-memory bus and checkpointer
uv run python -m agentmesh_runtime       # gRPC server on :50051
uv run python -m scripts.gen_proto       # regenerate stubs after editing proto/agentmesh/v1/agent.proto
```

Layout:

```
agentmesh_runtime/
  config.py          env settings (pydantic-settings)
  llm.py             provider abstraction: stub | openinfer | ollama | groq | gemini | openrouter
  context.py         context-window budgeting (trim messages by token count)
  agents/            registry + researcher / writer / reviewer graphs, traced nodes
  memory/            embeddings (stub, OpenAI-compatible, sentence-transformers) + pgvector store
  runs/              run engine (streams RunEvents from a graph), run store, checkpointer factory
  server.py          grpc.aio AgentService implementation
  proto_gen/         generated stubs (committed)
```
