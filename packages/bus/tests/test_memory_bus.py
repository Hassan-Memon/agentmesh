import pytest

from agentmesh_bus import InMemoryBus, build_bus, topic_matches


@pytest.mark.parametrize(
    ("pattern", "key", "expected"),
    [
        ("run.#", "run.abc.done", True),
        ("run.#", "run", True),
        ("run.*.done", "run.abc.done", True),
        ("run.*.done", "run.abc.node_started", False),
        ("run.*", "run.abc.done", False),
        ("#", "anything.at.all", True),
        ("run.abc.*", "run.abc.done", True),
    ],
)
def test_topic_matches(pattern: str, key: str, expected: bool) -> None:
    assert topic_matches(pattern, key) is expected


async def test_publish_reaches_matching_subscribers_only() -> None:
    bus = InMemoryBus()
    await bus.connect()
    async with bus.subscribe("run.#") as all_runs, bus.subscribe("run.*.done") as done_only:
        await bus.publish("run.1.node_started", {"seq": 1})
        await bus.publish("run.1.done", {"seq": 2})
        assert (await all_runs.get()).payload["seq"] == 1
        assert (await all_runs.get()).payload["seq"] == 2
        assert (await done_only.get()).payload["seq"] == 2
    assert len(bus.published) == 2


def test_factory_defaults_to_memory() -> None:
    assert isinstance(build_bus(None), InMemoryBus)
    assert isinstance(build_bus("memory://"), InMemoryBus)
    with pytest.raises(ValueError):
        build_bus("redis://nope")
