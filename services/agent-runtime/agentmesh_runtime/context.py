"""Context-window budgeting.

LLM context windows are finite and priced per token, so every call trims its message
list to a budget before it leaves the process. The policy is deliberately simple and
predictable:

1. System messages are always kept (they carry the instructions).
2. The newest messages are kept in preference to older ones.
3. If a single message is bigger than the remaining budget it is truncated from the
   front, with a marker, rather than dropped (the last user turn must survive).

Token counting uses tiktoken (cl100k_base) when available because it ships with
langchain-openai; otherwise a chars/4 heuristic that is within ~15% for English.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass

from langchain_core.messages import BaseMessage, SystemMessage

_TRUNCATION_MARK = "[... earlier content trimmed to fit the context budget ...]\n"

try:  # pragma: no cover - exercised implicitly
    import tiktoken

    _ENC = tiktoken.get_encoding("cl100k_base")

    def estimate_tokens(text: str) -> int:
        return len(_ENC.encode(text)) if text else 0

except Exception:  # pragma: no cover

    def estimate_tokens(text: str) -> int:
        return max(1, len(text) // 4) if text else 0


TokenCounter = Callable[[str], int]


def message_tokens(message: BaseMessage, counter: TokenCounter = estimate_tokens) -> int:
    # ~4 tokens of per-message framing is what OpenAI's own cookbook uses.
    return counter(_text_of(message)) + 4


def _text_of(message: BaseMessage) -> str:
    content = message.content
    if isinstance(content, str):
        return content
    # Multimodal content is a list of parts; count the text parts.
    return " ".join(str(p.get("text", "")) if isinstance(p, dict) else str(p) for p in content)


@dataclass(slots=True)
class BudgetReport:
    tokens_before: int
    tokens_after: int
    dropped: int
    truncated: int

    def as_dict(self) -> dict[str, int]:
        return {
            "tokens_before": self.tokens_before,
            "tokens_after": self.tokens_after,
            "dropped": self.dropped,
            "truncated": self.truncated,
        }


def trim_messages_to_budget(
    messages: list[BaseMessage],
    max_tokens: int,
    *,
    counter: TokenCounter = estimate_tokens,
) -> tuple[list[BaseMessage], BudgetReport]:
    """Return (trimmed_messages, report). Order of surviving messages is preserved."""
    before = sum(message_tokens(m, counter) for m in messages)
    system = [m for m in messages if isinstance(m, SystemMessage)]
    others = [m for m in messages if not isinstance(m, SystemMessage)]

    remaining = max_tokens - sum(message_tokens(m, counter) for m in system)
    kept: list[BaseMessage] = []
    dropped = 0
    truncated = 0

    # Walk newest -> oldest, keep while it fits.
    for msg in reversed(others):
        cost = message_tokens(msg, counter)
        if cost <= remaining:
            kept.append(msg)
            remaining -= cost
            continue
        if not kept and remaining > 8:
            # Nothing kept yet and this is the newest message: truncate instead of dropping.
            kept.append(_truncate(msg, remaining - 4, counter))
            truncated += 1
            remaining = 0
            continue
        dropped += 1

    kept.reverse()
    result = system + kept
    after = sum(message_tokens(m, counter) for m in result)
    return result, BudgetReport(before, after, dropped, truncated)


def _truncate(message: BaseMessage, budget_tokens: int, counter: TokenCounter) -> BaseMessage:
    text = _text_of(message)
    # Binary search the longest suffix that fits.
    lo, hi = 0, len(text)
    while lo < hi:
        mid = (lo + hi) // 2
        if counter(_TRUNCATION_MARK + text[len(text) - mid :]) <= budget_tokens:
            lo = mid + 1
        else:
            hi = mid
    keep = max(0, lo - 1)
    clone = message.model_copy()
    clone.content = _TRUNCATION_MARK + text[len(text) - keep :] if keep else _TRUNCATION_MARK.strip()
    return clone
