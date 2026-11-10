# pgvector and HNSW

**In one line:** pgvector adds a `vector` column type and distance operators to Postgres;
HNSW is the index type that makes nearest-neighbour search fast enough to use.

## Why vectors

An embedding model turns text into a list of floats (128 for our stub, 384 for MiniLM, 1536
for OpenAI's small model) such that similar meanings land near each other. "Retrieval" means:
embed the query, find the stored vectors closest to it, hand the matching text to the LLM as
context. That is the whole of RAG, and the `researcher` agent does exactly this in
`agents/researcher.py` -> `memory/store.py`.

## The table

`PgVectorMemory.connect()` creates:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE agent_memories (
  id uuid PRIMARY KEY,
  namespace text NOT NULL,
  content text NOT NULL,
  metadata jsonb NOT NULL,
  embedding vector(128) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ... ON agent_memories USING hnsw (embedding vector_cosine_ops);
```

The dimension is part of the type: `vector(128)`. Change embedding model, change dimension,
new table. `namespace` separates corpora (the seed knowledge base uses `knowledge`).

## Distance operators

| Operator | Distance | Use when |
| --- | --- | --- |
| `<=>` | cosine | text embeddings (direction matters, length does not) |
| `<->` | L2 (Euclidean) | embeddings that are not normalised |
| `<#>` | negative inner product | normalised vectors, fastest |

The search query in `store.py`:

```sql
SELECT id, content, metadata, 1 - (embedding <=> %s) AS score
FROM agent_memories WHERE namespace = %s
ORDER BY embedding <=> %s LIMIT %s
```

`ORDER BY embedding <=> query LIMIT k` is the pattern the index accelerates. Cosine
*distance* is 0 for identical, 2 for opposite; we report `1 - distance` as similarity so
higher is better.

## Why an index at all

Without one, Postgres scans every row and computes every distance: fine for a thousand rows,
hopeless for a million. Approximate nearest-neighbour indexes trade a little recall (you
might miss the true closest vector occasionally) for orders of magnitude in speed.

## HNSW vs IVFFlat

pgvector offers two:

- **IVFFlat** clusters vectors into lists at build time; a query probes the nearest lists.
  Needs training data present when the index is built, degrades as you insert, is cheap to
  build and small in memory.
- **HNSW** (Hierarchical Navigable Small World) builds a layered graph; a query walks the
  graph greedily from the top layer down. No training step, handles inserts gracefully,
  better recall/latency trade-off, uses more memory and takes longer to build.

We chose HNSW (ADR-0004) because the corpus grows incrementally (agents keep writing
memories) and because the data is small enough that index memory is not a concern. The two
knobs, `m` (links per node, default 16) and `ef_construction` (build-time search width,
default 64), are left at defaults; raise `hnsw.ef_search` at query time for more recall.

## Filtering

`WHERE namespace = %s` combined with an ANN index is a classic trap: the index returns the
top-k *before* the filter, so a selective filter can return fewer than k rows. pgvector 0.8+
mitigates this with iterative scans; the clean fix for heavy filtering is partial indexes
per namespace or a dedicated engine with filtered search (Qdrant). For our few namespaces it
is fine.

## Fallbacks in this repo

- `InMemorySemanticMemory` does brute-force cosine in Python when `DATABASE_URL` is unset.
- `StubEmbeddings` is a hashing-trick bag-of-words: deterministic, no model, lexical overlap
  still ranks first, which is why `test_memory.py` can assert ordering.

## Try it

With compose running:

```bash
docker compose -f infra/docker-compose.yml exec postgres psql -U agentmesh -c \
 "EXPLAIN ANALYZE SELECT id FROM agent_memories ORDER BY embedding <=> (SELECT embedding FROM agent_memories LIMIT 1) LIMIT 3;"
```

Look for `Index Scan using agent_memories_embedding_hnsw`. Drop the index and run it again to
see `Seq Scan`.
