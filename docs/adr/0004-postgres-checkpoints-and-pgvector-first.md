# ADR-0004: Postgres for checkpoints and pgvector for semantic memory first; dedicated vector DB later

- Status: accepted
- Date: 2026-11-09
- Deciders: Hassan Memon

## Context and problem statement

Agents need three kinds of memory:

1. Short-term: the state of the current run (messages, retrieved context, drafts).
2. Episodic: what happened in previous steps and previous runs, enough to resume after an
   interrupt or a crash.
3. Semantic: knowledge retrievable by meaning (RAG), which needs vector similarity search.

Where should each live, and should we introduce a dedicated vector database now?

## Decision drivers

- One database to run locally and one free tier to sign up for (Neon has pgvector).
- Transactional consistency between a checkpoint and the memories written in the same step.
- The MVP's corpus is thousands of documents, not billions of vectors.
- Keep an upgrade path open without rewriting agents.

## Considered options

1. Postgres for checkpoints + pgvector for vectors (one database).
2. Postgres for checkpoints + Qdrant/Weaviate/Pinecone for vectors.
3. Redis for everything (RedisJSON + RediSearch).

## Decision outcome

Chosen option: **option 1**, with `SemanticMemory` as an interface so option 2 is a new
adapter rather than a rewrite.

- Short-term memory is the LangGraph `AgentState` TypedDict
  (`services/agent-runtime/agentmesh_runtime/agents/state.py`).
- Episodic memory is the checkpoint history written by `langgraph-checkpoint-postgres` after
  every node, keyed by `thread_id == run_id`. This is also what makes `ResumeRun` work from any
  runtime process.
- Semantic memory is the `agent_memories` table with a `vector(dim)` column and an HNSW index
  using cosine distance (`memory/store.py`). An in-memory implementation is the fallback when
  `DATABASE_URL` is not set, and stub embeddings keep it working with no model.
- A context-window budgeter (`context.py`) trims messages by token count before every call so
  memory growth never silently overflows the model's window.

### Consequences

Good:

- `docker compose up` needs one database. Neon's free tier covers remote deploys.
- Checkpoint and memory writes can share a transaction later if needed.
- HNSW gives good recall with no training step and handles inserts well; fine to tens of
  millions of rows on one node.

Bad:

- pgvector indexes live in Postgres memory and compete with the OLTP workload; at very large
  scale or with heavy filtering a dedicated engine (Qdrant has a 1 GB free cloud tier) is
  better. The `SemanticMemory` interface and `build_memory()` factory are the seam.
- Embedding dimension is fixed per table; switching embedding models means a new table or a
  migration.

## Trigger to revisit

Revisit when any of these is true: more than ~20M vectors, p95 search latency above 100 ms
under load, or a need for hybrid (BM25 + vector) ranking that pgvector alone handles poorly.
