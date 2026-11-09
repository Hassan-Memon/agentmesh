from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

from agentmesh_runtime.context import estimate_tokens, message_tokens, trim_messages_to_budget


def words(n: int) -> str:
    return " ".join(f"word{i}" for i in range(n))


def test_estimate_tokens_is_monotonic_and_zero_for_empty() -> None:
    assert estimate_tokens("") == 0
    assert estimate_tokens(words(10)) < estimate_tokens(words(100))


def test_everything_fits_when_under_budget() -> None:
    msgs = [SystemMessage(content="sys"), HumanMessage(content="hi"), AIMessage(content="hello")]
    trimmed, report = trim_messages_to_budget(msgs, 10_000)
    assert trimmed == msgs
    assert report.dropped == 0 and report.truncated == 0
    assert report.tokens_before == report.tokens_after


def test_oldest_non_system_messages_are_dropped_first() -> None:
    msgs = [
        SystemMessage(content="keep me"),
        HumanMessage(content=words(200)),
        AIMessage(content=words(200)),
        HumanMessage(content="latest question"),
    ]
    budget = message_tokens(msgs[0]) + message_tokens(msgs[3]) + message_tokens(msgs[2]) + 2
    trimmed, report = trim_messages_to_budget(msgs, budget)
    assert trimmed[0] is msgs[0]
    assert trimmed[-1] is msgs[3]
    assert msgs[1] not in trimmed
    assert report.dropped == 1
    assert report.tokens_after <= budget


def test_single_oversized_message_is_truncated_not_dropped() -> None:
    msgs = [SystemMessage(content="sys"), HumanMessage(content=words(2000))]
    trimmed, report = trim_messages_to_budget(msgs, 120)
    assert len(trimmed) == 2
    assert report.truncated == 1
    assert "trimmed to fit" in str(trimmed[1].content)
    assert report.tokens_after <= 120
