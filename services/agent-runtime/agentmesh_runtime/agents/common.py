"""Helpers shared by the agent graphs."""

from __future__ import annotations

import json
import re
from typing import Any

from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage

from ..context import trim_messages_to_budget
from ..llm import usage_from_message


async def ask(
    model: BaseChatModel,
    system: str,
    user: str,
    *,
    history: list[BaseMessage] | None = None,
    budget_tokens: int,
) -> tuple[str, dict[str, int], dict[str, int]]:
    """One model call with context budgeting applied.

    Returns (text, usage, budget_report). Every agent goes through here so the token
    budget and usage accounting are enforced in exactly one place.
    """
    messages: list[BaseMessage] = [
        SystemMessage(content=system),
        *(history or []),
        HumanMessage(content=user),
    ]
    trimmed, report = trim_messages_to_budget(messages, budget_tokens)
    reply = await model.ainvoke(trimmed)
    text = reply.content if isinstance(reply.content, str) else str(reply.content)
    return text, usage_from_message(reply), report.as_dict()


def parse_json_object(text: str) -> dict[str, Any] | None:
    """Pull the first JSON object out of a model reply; models love to wrap JSON in prose."""
    match = re.search(r"\{.*\}", text, flags=re.DOTALL)
    if not match:
        return None
    try:
        value = json.loads(match.group(0))
    except json.JSONDecodeError:
        return None
    return value if isinstance(value, dict) else None
