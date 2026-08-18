"""Circuit breaker tests."""

from __future__ import annotations

import time

import pytest

from crawler.circuit import CircuitBreaker
from crawler.errors import CircuitOpen


def test_opens_after_threshold() -> None:
    breaker = CircuitBreaker(failure_threshold=2, cooldown_seconds=30)
    breaker.record_failure()
    breaker.allow()
    breaker.record_failure()
    with pytest.raises(CircuitOpen):
        breaker.allow()
    assert breaker.is_open


def test_success_resets_failures() -> None:
    breaker = CircuitBreaker(failure_threshold=2, cooldown_seconds=30)
    breaker.record_failure()
    breaker.record_success()
    breaker.record_failure()
    breaker.allow()
    assert breaker.failures == 1
    assert not breaker.is_open


def test_half_open_after_cooldown() -> None:
    breaker = CircuitBreaker(failure_threshold=1, cooldown_seconds=0.05)
    breaker.record_failure()
    with pytest.raises(CircuitOpen):
        breaker.allow()
    time.sleep(0.06)
    breaker.allow()
    assert breaker.failures == 0
    assert not breaker.is_open
