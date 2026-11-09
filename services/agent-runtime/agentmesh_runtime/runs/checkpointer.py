"""Checkpointer selection: Postgres when available, in-memory otherwise.

A checkpointer is what makes interrupt/resume possible: after every node LangGraph writes
the full state under (thread_id, checkpoint_id). ResumeRun only carries a run_id, so the
runtime must be able to load that state later, possibly from a different process. The
Postgres saver gives that durability; InMemorySaver is for tests and laptops without Postgres.
"""

from __future__ import annotations

import logging
from collections.abc import Awaitable, Callable
from typing import Any

from langgraph.checkpoint.base import BaseCheckpointSaver
from langgraph.checkpoint.memory import InMemorySaver

from ..config import Settings

log = logging.getLogger(__name__)

Closer = Callable[[], Awaitable[None]]


async def build_checkpointer(settings: Settings) -> tuple[BaseCheckpointSaver[Any], Closer]:
    async def _noop() -> None:
        return None

    if not settings.database_url:
        log.info("checkpointer: in-memory (DATABASE_URL not set)")
        return InMemorySaver(), _noop

    try:
        from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

        cm = AsyncPostgresSaver.from_conn_string(settings.database_url)
        saver = await cm.__aenter__()
        await saver.setup()  # creates checkpoint tables if missing (idempotent)
        log.info("checkpointer: postgres")

        async def _close() -> None:
            await cm.__aexit__(None, None, None)

        return saver, _close
    except Exception as exc:  # noqa: BLE001
        log.warning("postgres checkpointer unavailable (%s); using in-memory saver", exc)
        return InMemorySaver(), _noop
