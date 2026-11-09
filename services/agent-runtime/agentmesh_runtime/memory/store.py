"""Vector stores behind one small interface.

PgVectorMemory keeps semantic memory in the same Postgres that holds the LangGraph
checkpoints (one database to run, one free tier to sign up for). It uses an HNSW index
with cosine distance; see docs/learn/03-concepts/pgvector-and-hnsw.md for why HNSW over
IVFFlat at this scale. InMemorySemanticMemory is the zero-dependency fallback.
"""

from __future__ import annotations

import json
import logging
import math
import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any

from langchain_core.embeddings import Embeddings

from ..config import Settings

log = logging.getLogger(__name__)


@dataclass(slots=True)
class MemoryHit:
    id: str
    content: str
    score: float  # cosine similarity in [-1, 1]; higher is better
    metadata: dict[str, Any] = field(default_factory=dict)

    def as_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "content": self.content,
            "score": round(self.score, 4),
            "metadata": self.metadata,
        }


class SemanticMemory(ABC):
    def __init__(self, embeddings: Embeddings) -> None:
        self.embeddings = embeddings

    @abstractmethod
    async def add(
        self, texts: list[str], metadatas: list[dict[str, Any]] | None = None, namespace: str = "default"
    ) -> list[str]: ...

    @abstractmethod
    async def search(self, query: str, k: int = 4, namespace: str = "default") -> list[MemoryHit]: ...

    @abstractmethod
    async def count(self, namespace: str = "default") -> int: ...

    async def close(self) -> None:
        return None


class InMemorySemanticMemory(SemanticMemory):
    def __init__(self, embeddings: Embeddings) -> None:
        super().__init__(embeddings)
        self._rows: list[tuple[str, str, list[float], str, dict[str, Any]]] = []

    async def add(
        self, texts: list[str], metadatas: list[dict[str, Any]] | None = None, namespace: str = "default"
    ) -> list[str]:
        vectors = self.embeddings.embed_documents(texts)
        ids: list[str] = []
        for i, (text, vec) in enumerate(zip(texts, vectors, strict=True)):
            row_id = str(uuid.uuid4())
            meta = (metadatas or [{}] * len(texts))[i]
            self._rows.append((row_id, namespace, vec, text, meta))
            ids.append(row_id)
        return ids

    async def search(self, query: str, k: int = 4, namespace: str = "default") -> list[MemoryHit]:
        q = self.embeddings.embed_query(query)
        scored = [
            MemoryHit(id=rid, content=text, score=_cosine(q, vec), metadata=meta)
            for rid, ns, vec, text, meta in self._rows
            if ns == namespace
        ]
        scored.sort(key=lambda h: h.score, reverse=True)
        return scored[:k]

    async def count(self, namespace: str = "default") -> int:
        return sum(1 for r in self._rows if r[1] == namespace)


def _cosine(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b, strict=True))
    na = math.sqrt(sum(x * x for x in a)) or 1.0
    nb = math.sqrt(sum(y * y for y in b)) or 1.0
    return dot / (na * nb)


class PgVectorMemory(SemanticMemory):
    """pgvector-backed store using psycopg 3 (async)."""

    TABLE = "agent_memories"

    def __init__(self, embeddings: Embeddings, dim: int, conninfo: str) -> None:
        super().__init__(embeddings)
        self.dim = dim
        self._conninfo = conninfo
        self._conn: Any = None

    async def connect(self) -> None:
        import psycopg
        from pgvector.psycopg import register_vector_async

        self._conn = await psycopg.AsyncConnection.connect(self._conninfo, autocommit=True)
        await self._conn.execute("CREATE EXTENSION IF NOT EXISTS vector")
        await register_vector_async(self._conn)
        await self._conn.execute(
            f"""
            CREATE TABLE IF NOT EXISTS {self.TABLE} (
                id          uuid PRIMARY KEY,
                namespace   text NOT NULL DEFAULT 'default',
                content     text NOT NULL,
                metadata    jsonb NOT NULL DEFAULT '{{}}'::jsonb,
                embedding   vector({self.dim}) NOT NULL,
                created_at  timestamptz NOT NULL DEFAULT now()
            )
            """
        )
        # HNSW: graph index, good recall with no training step, fine for < ~10M rows.
        await self._conn.execute(
            f"CREATE INDEX IF NOT EXISTS {self.TABLE}_embedding_hnsw "
            f"ON {self.TABLE} USING hnsw (embedding vector_cosine_ops)"
        )
        await self._conn.execute(
            f"CREATE INDEX IF NOT EXISTS {self.TABLE}_namespace ON {self.TABLE} (namespace)"
        )

    async def add(
        self, texts: list[str], metadatas: list[dict[str, Any]] | None = None, namespace: str = "default"
    ) -> list[str]:
        from pgvector import Vector

        vectors = self.embeddings.embed_documents(texts)
        ids: list[str] = []
        async with self._conn.cursor() as cur:
            for i, (text, vec) in enumerate(zip(texts, vectors, strict=True)):
                row_id = str(uuid.uuid4())
                meta = (metadatas or [{}] * len(texts))[i]
                await cur.execute(
                    f"INSERT INTO {self.TABLE} (id, namespace, content, metadata, embedding) "
                    "VALUES (%s, %s, %s, %s::jsonb, %s)",
                    (row_id, namespace, text, json.dumps(meta), Vector(vec)),
                )
                ids.append(row_id)
        return ids

    async def search(self, query: str, k: int = 4, namespace: str = "default") -> list[MemoryHit]:
        from pgvector import Vector

        q = Vector(self.embeddings.embed_query(query))
        async with self._conn.cursor() as cur:
            # `<=>` is cosine distance; similarity = 1 - distance.
            await cur.execute(
                f"SELECT id, content, metadata, 1 - (embedding <=> %s) AS score "
                f"FROM {self.TABLE} WHERE namespace = %s ORDER BY embedding <=> %s LIMIT %s",
                (q, namespace, q, k),
            )
            rows = await cur.fetchall()
        return [MemoryHit(id=str(r[0]), content=r[1], score=float(r[3]), metadata=r[2] or {}) for r in rows]

    async def count(self, namespace: str = "default") -> int:
        async with self._conn.cursor() as cur:
            await cur.execute(f"SELECT count(*) FROM {self.TABLE} WHERE namespace = %s", (namespace,))
            row = await cur.fetchone()
        return int(row[0]) if row else 0

    async def close(self) -> None:
        if self._conn is not None:
            await self._conn.close()
            self._conn = None


async def build_memory(settings: Settings, embeddings: Embeddings, dim: int) -> SemanticMemory:
    """pgvector when DATABASE_URL is set and reachable, otherwise in-memory with a warning."""
    if settings.database_url:
        store = PgVectorMemory(embeddings, dim, settings.database_url)
        try:
            await store.connect()
            log.info("semantic memory: pgvector (dim=%d)", dim)
            return store
        except Exception as exc:  # noqa: BLE001 - any connection problem means fall back
            log.warning("pgvector unavailable (%s); using in-memory semantic memory", exc)
    else:
        log.info("semantic memory: in-memory (DATABASE_URL not set)")
    return InMemorySemanticMemory(embeddings)
