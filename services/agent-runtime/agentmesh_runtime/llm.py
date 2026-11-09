"""Provider abstraction for chat models.

Every provider we care about speaks the OpenAI chat-completions protocol, so one class
(`ChatOpenAI` with a custom `base_url`) covers OpenInfer, Ollama, Groq, Gemini and
OpenRouter. The only custom code is the stub model that makes tests and
`docker compose up` work without any key.
"""

from __future__ import annotations

import logging
import re
import urllib.request
from typing import Any

from langchain_core.callbacks import CallbackManagerForLLMRun
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage
from langchain_core.outputs import ChatGeneration, ChatResult

from .config import Settings
from .context import estimate_tokens

log = logging.getLogger(__name__)

PROVIDER_BASE_URLS = {
    "groq": "https://api.groq.com/openai/v1",
    "gemini": "https://generativelanguage.googleapis.com/v1beta/openai/",
    "openrouter": "https://openrouter.ai/api/v1",
}


class StubChatModel(BaseChatModel):
    """Deterministic offline model.

    It looks at the system prompt to decide what kind of answer the caller expects and
    produces plausible, stable text so the dashboard demo looks real. It also fills in
    `usage_metadata` so the token-usage plumbing is exercised end to end.
    """

    model_name: str = "agentmesh-stub"

    @property
    def _llm_type(self) -> str:
        return "agentmesh-stub"

    def _generate(
        self,
        messages: list[BaseMessage],
        stop: list[str] | None = None,
        run_manager: CallbackManagerForLLMRun | None = None,
        **kwargs: Any,
    ) -> ChatResult:
        system = " ".join(str(m.content) for m in messages if isinstance(m, SystemMessage)).lower()
        humans = [str(m.content) for m in messages if isinstance(m, HumanMessage)]
        user = humans[-1] if humans else ""
        text = self._answer_for(system, user)

        prompt_tokens = sum(estimate_tokens(str(m.content)) for m in messages)
        completion_tokens = estimate_tokens(text)
        message = AIMessage(
            content=text,
            usage_metadata={
                "input_tokens": prompt_tokens,
                "output_tokens": completion_tokens,
                "total_tokens": prompt_tokens + completion_tokens,
            },
            response_metadata={"model_name": self.model_name},
        )
        return ChatResult(generations=[ChatGeneration(message=message)])

    @staticmethod
    def _answer_for(system: str, user: str) -> str:
        topic = _first_sentence(user)
        if "return json" in system and "review" in system:
            return (
                '{"verdict": "approve", "score": 8, '
                '"notes": ["Clear structure", "Claims are supported by the provided context", '
                '"Tighten the introduction before publishing"]}'
            )
        if "outline" in system:
            return (
                f"1. Why {topic} matters\n2. How it works today\n"
                "3. Trade-offs and failure modes\n4. Recommendation"
            )
        if "draft" in system:
            return (
                f"{topic}\n\n"
                "This draft was produced by the AgentMesh stub model, which runs with no API keys so the "
                "platform can be demonstrated offline. It follows the outline: motivation, mechanism, "
                "trade-offs and a recommendation. Swap DEMO_MODE=0 and pick a provider to see real prose."
            )
        if "research" in system or "context" in system:
            return (
                f"Summary for: {topic}\n\n"
                "Based on the retrieved context, AgentMesh runs LangGraph agents behind a gRPC service, "
                "streams RunEvents over RabbitMQ and WebSockets, and pauses for human approval using "
                "LangGraph interrupts. Sources are listed below the answer."
            )
        return f"[stub] {topic}"


def _first_sentence(text: str, limit: int = 120) -> str:
    text = re.sub(r"\s+", " ", text).strip()
    if not text:
        return "the request"
    cut = re.split(r"(?<=[.!?])\s", text, maxsplit=1)[0]
    return cut if len(cut) <= limit else cut[: limit - 3] + "..."


def _ollama_reachable(base_url: str, timeout: float = 0.8) -> bool:
    try:
        root = base_url.rsplit("/v1", 1)[0]
        with urllib.request.urlopen(f"{root}/api/tags", timeout=timeout) as resp:  # noqa: S310
            return resp.status == 200
    except Exception:
        return False


def resolve_provider(settings: Settings) -> str:
    """Decide which provider to use. Explicit wins; 'auto' probes Ollama, then Groq, then stub."""
    if settings.demo_mode:
        return "stub"
    if settings.llm_provider != "auto":
        return settings.llm_provider
    if settings.openinfer_base_url:
        return "openinfer"
    if _ollama_reachable(settings.ollama_base_url):
        return "ollama"
    if settings.groq_api_key:
        return "groq"
    log.warning("no LLM provider reachable and no API key set; falling back to the stub model")
    return "stub"


def build_chat_model(settings: Settings, provider: str | None = None) -> BaseChatModel:
    provider = provider or resolve_provider(settings)
    if provider == "stub":
        return StubChatModel()

    # Imported here so the stub path never needs the openai client installed/configured.
    from langchain_openai import ChatOpenAI

    if provider == "openinfer":
        if not settings.openinfer_base_url:
            raise ValueError("LLM_PROVIDER=openinfer requires OPENINFER_BASE_URL")
        return ChatOpenAI(
            model=settings.llm_model,
            base_url=settings.openinfer_base_url,
            api_key=settings.openinfer_api_key or "not-needed",
            temperature=0.2,
        )
    if provider == "ollama":
        return ChatOpenAI(
            model=settings.llm_model, base_url=settings.ollama_base_url, api_key="ollama", temperature=0.2
        )
    if provider in PROVIDER_BASE_URLS:
        key = {
            "groq": settings.groq_api_key,
            "gemini": settings.gemini_api_key,
            "openrouter": settings.openrouter_api_key,
        }[provider]
        if not key:
            raise ValueError(f"LLM_PROVIDER={provider} requires {provider.upper()}_API_KEY")
        return ChatOpenAI(
            model=settings.llm_model, base_url=PROVIDER_BASE_URLS[provider], api_key=key, temperature=0.2
        )
    raise ValueError(f"unknown LLM provider {provider!r}")


def usage_from_message(message: BaseMessage) -> dict[str, int]:
    """Normalise LangChain usage_metadata into the proto TokenUsage shape."""
    meta = getattr(message, "usage_metadata", None) or {}
    prompt = int(meta.get("input_tokens", 0))
    completion = int(meta.get("output_tokens", 0))
    return {
        "prompt_tokens": prompt,
        "completion_tokens": completion,
        "total_tokens": int(meta.get("total_tokens", prompt + completion)),
    }
