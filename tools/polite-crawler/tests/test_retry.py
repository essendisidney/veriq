"""Retry / backoff tests."""

from __future__ import annotations

import pytest

from crawler.retry import backoff_delay, with_backoff


def test_backoff_doubles_and_caps() -> None:
    assert backoff_delay(1, 1.0, 30.0, jitter=False) == 1.0
    assert backoff_delay(2, 1.0, 30.0, jitter=False) == 2.0
    assert backoff_delay(3, 1.0, 30.0, jitter=False) == 4.0
    assert backoff_delay(10, 1.0, 8.0, jitter=False) == 8.0


def test_backoff_jitter_stays_in_range() -> None:
    for _ in range(20):
        delay = backoff_delay(3, 1.0, 30.0, jitter=True)
        assert 2.0 <= delay <= 4.0


@pytest.mark.asyncio
async def test_with_backoff_eventually_succeeds() -> None:
    calls = {"n": 0}

    async def flaky() -> str:
        calls["n"] += 1
        if calls["n"] < 3:
            raise TimeoutError("not yet")
        return "ok"

    result = await with_backoff(
        flaky,
        max_retries=3,
        base_seconds=0.01,
        max_seconds=0.02,
        retry_on=(TimeoutError,),
        jitter=False,
    )
    assert result == "ok"
    assert calls["n"] == 3


@pytest.mark.asyncio
async def test_with_backoff_raises_after_retries() -> None:
    async def always_fail() -> str:
        raise TimeoutError("down")

    with pytest.raises(TimeoutError):
        await with_backoff(
            always_fail,
            max_retries=1,
            base_seconds=0.01,
            max_seconds=0.02,
            retry_on=(TimeoutError,),
            jitter=False,
        )
