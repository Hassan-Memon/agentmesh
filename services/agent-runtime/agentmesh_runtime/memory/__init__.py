"""Semantic memory: embeddings plus a vector store (pgvector, in-memory fallback)."""

from .embeddings import StubEmbeddings, build_embeddings
from .store import InMemorySemanticMemory, MemoryHit, PgVectorMemory, SemanticMemory, build_memory

__all__ = [
    "InMemorySemanticMemory",
    "MemoryHit",
    "PgVectorMemory",
    "SemanticMemory",
    "StubEmbeddings",
    "build_embeddings",
    "build_memory",
]
