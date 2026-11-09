from agentmesh_runtime.memory import InMemorySemanticMemory, StubEmbeddings
from agentmesh_runtime.memory.seed import KNOWLEDGE_NAMESPACE, SEED_DOCUMENTS, seed_knowledge


def test_stub_embeddings_are_deterministic_and_normalised() -> None:
    emb = StubEmbeddings(dim=64)
    a = emb.embed_query("rabbitmq topic exchange")
    b = emb.embed_query("rabbitmq topic exchange")
    assert a == b
    assert abs(sum(x * x for x in a) - 1.0) < 1e-6
    assert len(a) == 64


async def test_search_ranks_lexically_similar_documents_first() -> None:
    memory = InMemorySemanticMemory(StubEmbeddings())
    await memory.add(
        ["RabbitMQ topic exchange routing keys", "Next.js server components", "pgvector HNSW index"],
        [{"t": "mq"}, {"t": "next"}, {"t": "pg"}],
        namespace="k",
    )
    hits = await memory.search("how do routing keys work in RabbitMQ", k=2, namespace="k")
    assert hits[0].metadata["t"] == "mq"
    assert hits[0].score > hits[1].score
    assert await memory.count("k") == 3
    assert await memory.search("anything", namespace="other") == []


async def test_seed_is_idempotent() -> None:
    memory = InMemorySemanticMemory(StubEmbeddings())
    assert await seed_knowledge(memory) == len(SEED_DOCUMENTS)
    assert await seed_knowledge(memory) == 0
    assert await memory.count(KNOWLEDGE_NAMESPACE) == len(SEED_DOCUMENTS)
