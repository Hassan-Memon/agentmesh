"""Embedding providers.

- StubEmbeddings: deterministic hashed bag-of-words. No model, no network, and documents
  that share vocabulary with the query still rank first, so demo RAG looks sane.
- OpenAI-compatible: any /v1/embeddings endpoint (OpenInfer, Ollama, OpenAI).
- sentence-transformers: fully local neural embeddings, optional extra (heavy).
"""

from __future__ import annotations

import hashlib
import logging
import math
import re

from langchain_core.embeddings import Embeddings

from ..config import Settings

log = logging.getLogger(__name__)

_TOKEN_RE = re.compile(r"[a-z0-9]+")


class StubEmbeddings(Embeddings):
    """Hashing-trick embeddings: each token is hashed to one of `dim` buckets."""

    def __init__(self, dim: int = 128) -> None:
        self.dim = dim

    def _embed(self, text: str) -> list[float]:
        vec = [0.0] * self.dim
        for tok in _TOKEN_RE.findall(text.lower()):
            digest = hashlib.blake2b(tok.encode(), digest_size=8).digest()
            idx = int.from_bytes(digest[:4], "little") % self.dim
            sign = 1.0 if digest[4] % 2 == 0 else -1.0
            vec[idx] += sign
        norm = math.sqrt(sum(v * v for v in vec)) or 1.0
        return [v / norm for v in vec]

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return [self._embed(t) for t in texts]

    def embed_query(self, text: str) -> list[float]:
        return self._embed(text)


def build_embeddings(settings: Settings) -> tuple[Embeddings, int]:
    """Return (embeddings, dimension). Falls back to the stub if the chosen provider is unusable."""
    provider = "stub" if settings.demo_mode else settings.embeddings_provider

    if provider == "openai-compatible":
        from langchain_openai import OpenAIEmbeddings

        base = settings.openinfer_base_url or settings.ollama_base_url
        emb = OpenAIEmbeddings(
            model=settings.embeddings_model,
            base_url=base,
            api_key=settings.openinfer_api_key or "not-needed",
            check_embedding_ctx_length=False,
        )
        # Probe once to learn the dimension; endpoints differ (768, 1024, 1536...).
        dim = len(emb.embed_query("dimension probe"))
        return emb, dim

    if provider == "sentence-transformers":
        try:
            from sentence_transformers import SentenceTransformer
        except ImportError:
            log.warning("sentence-transformers not installed; using stub embeddings")
            return StubEmbeddings(), 128

        class _ST(Embeddings):
            def __init__(self) -> None:
                self.model = SentenceTransformer("all-MiniLM-L6-v2")

            def embed_documents(self, texts: list[str]) -> list[list[float]]:
                return self.model.encode(texts, normalize_embeddings=True).tolist()

            def embed_query(self, text: str) -> list[float]:
                return self.model.encode([text], normalize_embeddings=True)[0].tolist()

        return _ST(), 384

    return StubEmbeddings(), 128
