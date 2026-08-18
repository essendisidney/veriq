"""Exponential backoff helper for transient fetch failures."""

from __future__ import annotations

import asyncio
import logging
import random
from collections.abc import Awaitable, Callable
from typing import TypeVar

logger = logging.getLogger("polite_crawler.retry")

T = TypeVar("T")


def backoff_delay(attempt: int, base: float, cap: float, jitter: bool = True) -> float:
    """Return seconds to wait after a failed attempt (1-based).

    With jitter, the wait is equal-jitter: ``[0.5, 1.0] * min(cap, base * 2^(n-1))``.
    Access-denied responses must not use this helper.
    """
    if attempt < 1:
        raise ValueError("attempt must be >= 1")
    raw = min(cap, base * (2 ** (attempt - 1)))
    if not jitter:
        return raw
    return raw * random.uniform(0.5, 1.0)


def is_transient(error: BaseException) -> bool:
    """True for timeouts, 5xx, and network errors. False for policy / access denials."""
    from crawler.errors import CircuitOpen, ResponseInvalid, RobotsDenied, UrlRefused

    if isinstance(error, (UrlRefused, RobotsDenied, CircuitOpen)):
        return False
    if isinstance(error, ResponseInvalid):
        message = str(error)
        return "HTTP 5" in message or "Server error" in message or "no response" in message.lower()
    return isinstance(error, (TimeoutError, OSError, ConnectionError, asyncio.TimeoutError))


async def with_backoff(
    operation: Callable[[], Awaitable[T]],
    *,
    max_retries: int,
    base_seconds: float,
    max_seconds: float,
    retry_on: tuple[type[BaseException], ...],
    on_retry: Callable[[int, BaseException, float], None] | None = None,
    jitter: bool = True,
) -> T:
    """Run ``operation`` with exponential backoff on ``retry_on`` errors.

    ``max_retries`` is the number of *retries* after the first attempt.
    Access-denied errors should not be passed in ``retry_on``.
    """
    attempts = max_retries + 1
    last_error: BaseException | None = None
    for attempt in range(1, attempts + 1):
        try:
            return await operation()
        except retry_on as exc:
            last_error = exc
            if attempt >= attempts:
                break
            delay = backoff_delay(attempt, base_seconds, max_seconds, jitter=jitter)
            if on_retry:
                on_retry(attempt, exc, delay)
            else:
                logger.warning("Attempt %s/%s failed: %s. Backing off %.1fs.", attempt, attempts, exc, delay)
            await asyncio.sleep(delay)
    assert last_error is not None
    raise last_error
