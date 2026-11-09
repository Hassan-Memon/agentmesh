"""Environment configuration for the runtime.

pydantic-settings maps each field to an environment variable of the same name in upper
case (``demo_mode`` <- ``DEMO_MODE``). A ``.env`` file in the working directory is read
too, which is how `uv run python -m agentmesh_runtime` picks up local settings. Nothing
here is secret by default; keys arrive only through the environment.
"""

from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

LLMProvider = Literal["auto", "stub", "openinfer", "ollama", "groq", "gemini", "openrouter"]
EmbeddingsProvider = Literal["stub", "openai-compatible", "sentence-transformers"]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # DEMO_MODE=1 means: stub LLM, stub embeddings, no outbound calls. CI and compose default.
    demo_mode: bool = True

    # LLM selection. "auto" tries Ollama, then Groq (if GROQ_API_KEY), then falls back to stub.
    llm_provider: LLMProvider = "auto"
    llm_model: str = "llama3.2"
    openinfer_base_url: str | None = None
    openinfer_api_key: str | None = None
    ollama_base_url: str = "http://localhost:11434/v1"
    groq_api_key: str | None = None
    gemini_api_key: str | None = None
    openrouter_api_key: str | None = None

    embeddings_provider: EmbeddingsProvider = "stub"
    embeddings_model: str = "text-embedding-3-small"

    # Postgres (pgvector image). Used for LangGraph checkpoints and semantic memory.
    database_url: str | None = None

    # Event bus URL: memory:// | amqp://... | kafka://host:port
    bus_url: str = "memory://"

    agent_runtime_grpc_port: int = Field(default=50051, ge=1, le=65535)

    # Context-window budget applied before every model call (see context.py).
    context_budget_tokens: int = 6000

    # Max events kept in the in-process run store per run (the gateway persists the full log).
    run_store_max_events: int = 500


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
