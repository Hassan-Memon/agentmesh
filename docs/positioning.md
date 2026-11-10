# Positioning

## One sentence

AgentMesh is the open, self-hostable control plane for LangGraph agents: run them as
services, watch every step live, and keep a human in the loop, on any model and any cloud.

## Who it is for

- **Platform and backend teams** that already have agents in notebooks or single scripts and
  now need them to run as reliable services with observability and approval gates.
- **Regulated or privacy-sensitive organisations** (healthcare, legal, finance, public
  sector) that cannot send prompts and data to a hosted agent platform and need a stack that
  runs inside their own network, with their own model (Ollama, OpenInfer, or a licensed
  endpoint).
- **Solo builders and small teams** who want the convenience of a managed agent platform
  without a per-seat or per-run bill, and who are fine running `docker compose up`.

## The problem

Agent frameworks are good at defining a graph. They are thin on everything around it:
starting runs from a UI, seeing which node is executing, pausing for a human, resuming
after a crash, and letting several agents and several teams share one event stream. Hosted
platforms solve this, but they tie you to one model vendor and move your data to their
servers.

## Alternatives and how AgentMesh compares

| Alternative | What it is good at | Where AgentMesh wins |
| --- | --- | --- |
| OpenAI Agents platform / Assistants | Zero setup, great tooling, deeply integrated with OpenAI models | Vendor neutral (any OpenAI-compatible or local model), self-hosted, your data stays put, free to run |
| LangGraph Platform (hosted) | First-party LangGraph hosting, assistants API, Studio | Open source end to end, runs on free tiers, pluggable brokers, no per-node pricing |
| Temporal / Prefect + custom code | Rock-solid durable execution | Purpose-built for agents: token usage, interrupts, RAG memory and a dashboard out of the box; far smaller surface to learn |
| n8n / Flowise style builders | Visual, non-developer friendly | Code-first graphs with real tests, typed gRPC contract, multi-language services |
| Roll your own | Total control | Already done here: the boring 80% (gateway, events, HITL, memory) with ADRs explaining why |

## Why this wins

1. **No lock-in, by construction.** Model, broker, vector store and database each sit behind
   a small interface with an env-selected adapter. The stub adapters also mean the entire
   platform runs with zero API keys.
2. **Observability is the default.** Every node start and finish, token count, interrupt and
   completion is an event on a topic exchange and on a WebSocket. You do not add tracing
   later; you cannot turn it off.
3. **Humans are first-class.** An approval is a single `interrupt()` call; the dashboard,
   gateway and event log already know what to do with it.
4. **Honest about scale.** `docs/learn/02-system-design-tradeoffs.md` says what breaks at 10x
   and what to do about it; the ADRs name the triggers to revisit each decision.
5. **Free to try, free to run small.** Vercel + Render + Neon + CloudAMQP free tiers host the
   whole thing. Scaling up is a config change, not a rewrite.

## What it is not (yet)

- Not multi-tenant and not authenticated. Put it behind your SSO proxy.
- Not a visual graph builder. Agents are Python files.
- Not a replacement for a workflow engine at millions of runs per day. See the trade-offs doc
  for the path there.
