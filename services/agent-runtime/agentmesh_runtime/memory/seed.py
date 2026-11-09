"""Seed documents for the researcher agent's knowledge namespace.

A RAG demo with an empty index is a sad demo. At startup the runtime inserts these
(idempotently, only when the namespace is empty) so `researcher` has something to cite.
"""

from __future__ import annotations

from .store import SemanticMemory

KNOWLEDGE_NAMESPACE = "knowledge"

SEED_DOCUMENTS: list[tuple[str, dict[str, str]]] = [
    (
        "AgentMesh runs each LangGraph agent inside a Python runtime that exposes a gRPC AgentService. "
        "The TypeScript gateway calls StartRun and receives a server stream of RunEvent messages.",
        {"title": "Architecture: gRPC between gateway and runtime", "source": "docs/adr/0001"},
    ),
    (
        "Every node start, node finish, token usage report, interrupt and completion is published to a "
        "RabbitMQ topic exchange named agentmesh.events with routing key run.<run_id>.<type>. "
        "Kafka or Redpanda can replace RabbitMQ behind the same bus interface.",
        {"title": "Event bus and routing keys", "source": "docs/adr/0002"},
    ),
    (
        "Human-in-the-loop approval uses LangGraph interrupt(). The reviewer agent pauses, the gateway "
        "marks the run waiting_approval, and POST /runs/:id/approve resumes the graph from its "
        "Postgres checkpoint with Command(resume=...).",
        {"title": "Human in the loop", "source": "docs/adr/0005"},
    ),
    (
        "Memory strategy: short-term memory is LangGraph state, episodic memory is the checkpoint history "
        "in Postgres, and semantic memory is a pgvector table with an HNSW cosine index. A context "
        "budgeter trims messages by token count before every model call.",
        {"title": "Memory and context strategy", "source": "docs/adr/0004"},
    ),
    (
        "The dashboard is a Next.js 15 App Router application. Lists are server components that fetch "
        "from the gateway REST API; the run detail page is a client component that joins a Socket.IO "
        "room and renders RunEvents as a live timeline.",
        {"title": "Dashboard", "source": "apps/dashboard"},
    ),
    (
        "LLM access goes through a provider abstraction. With DEMO_MODE=1 a deterministic stub model "
        "answers; otherwise ChatOpenAI with a base_url targets OpenInfer, Ollama, Groq, Gemini or "
        "OpenRouter.",
        {"title": "LLM providers", "source": "services/agent-runtime/agentmesh_runtime/llm.py"},
    ),
]


async def seed_knowledge(memory: SemanticMemory) -> int:
    """Insert the seed documents if the namespace is empty. Returns the number inserted."""
    if await memory.count(KNOWLEDGE_NAMESPACE) > 0:
        return 0
    texts = [t for t, _ in SEED_DOCUMENTS]
    metas = [m for _, m in SEED_DOCUMENTS]
    await memory.add(texts, metas, namespace=KNOWLEDGE_NAMESPACE)
    return len(texts)
