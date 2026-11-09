from langchain_core.messages import HumanMessage, SystemMessage

from agentmesh_runtime.config import Settings
from agentmesh_runtime.llm import (
    PROVIDER_BASE_URLS,
    StubChatModel,
    build_chat_model,
    resolve_provider,
    usage_from_message,
)


def test_demo_mode_always_resolves_to_stub() -> None:
    s = Settings(demo_mode=True, llm_provider="groq", groq_api_key="x", _env_file=None)
    assert resolve_provider(s) == "stub"
    assert isinstance(build_chat_model(s), StubChatModel)


def test_explicit_provider_builds_chat_openai_with_expected_base_url() -> None:
    s = Settings(demo_mode=False, llm_provider="groq", groq_api_key="gsk_test", _env_file=None)
    model = build_chat_model(s)
    assert model.__class__.__name__ == "ChatOpenAI"
    assert model.openai_api_base == PROVIDER_BASE_URLS["groq"]  # type: ignore[attr-defined]


def test_missing_key_is_a_clear_error() -> None:
    s = Settings(demo_mode=False, llm_provider="openrouter", openrouter_api_key=None, _env_file=None)
    try:
        build_chat_model(s)
    except ValueError as exc:
        assert "OPENROUTER_API_KEY" in str(exc)
    else:
        raise AssertionError("expected ValueError")


def test_auto_without_anything_reachable_falls_back_to_stub() -> None:
    s = Settings(
        demo_mode=False,
        llm_provider="auto",
        ollama_base_url="http://127.0.0.1:1/v1",  # nothing listens here
        groq_api_key=None,
        _env_file=None,
    )
    assert resolve_provider(s) == "stub"


async def test_stub_reports_usage_and_reacts_to_system_prompt() -> None:
    model = StubChatModel()
    reply = await model.ainvoke(
        [SystemMessage(content="Produce a numbered outline"), HumanMessage(content="Topic")]
    )
    assert "1." in str(reply.content)
    usage = usage_from_message(reply)
    assert usage["prompt_tokens"] > 0 and usage["completion_tokens"] > 0
    assert usage["total_tokens"] == usage["prompt_tokens"] + usage["completion_tokens"]
