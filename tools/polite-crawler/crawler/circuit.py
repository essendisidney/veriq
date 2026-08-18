"""Circuit breaker: pause after consecutive failures, then half-open."""

from __future__ import annotations

import logging
import time

from crawler.errors import CircuitOpen

logger = logging.getLogger("polite_crawler.circuit")


class CircuitBreaker:
    """Fail-closed breaker for a single collector instance.

    After ``failure_threshold`` consecutive failures the circuit opens for
    ``cooldown_seconds``. The next probe after cooldown is half-open: a
    success closes the circuit; a failure opens it again.
    """

    def __init__(self, failure_threshold: int = 5, cooldown_seconds: float = 60.0) -> None:
        if failure_threshold < 1:
            raise ValueError("failure_threshold must be >= 1")
        if cooldown_seconds < 0:
            raise ValueError("cooldown_seconds must be >= 0")
        self.failure_threshold = failure_threshold
        self.cooldown_seconds = cooldown_seconds
        self.failures = 0
        self.opened_at: float | None = None

    @property
    def is_open(self) -> bool:
        """True while the cooldown window is active."""
        if self.opened_at is None:
            return False
        return (time.monotonic() - self.opened_at) < self.cooldown_seconds

    def allow(self) -> None:
        """Raise CircuitOpen when calls must wait out the cooldown."""
        if self.opened_at is None:
            return
        elapsed = time.monotonic() - self.opened_at
        if elapsed < self.cooldown_seconds:
            remaining = self.cooldown_seconds - elapsed
            raise CircuitOpen(
                f"Circuit open for {remaining:.1f}s more after {self.failures} failures."
            )
        logger.info("Circuit breaker cooldown elapsed; half-open.")
        self.opened_at = None
        self.failures = 0

    def record_success(self) -> None:
        """Close the circuit after a healthy fetch."""
        self.failures = 0
        self.opened_at = None

    def record_failure(self) -> None:
        """Count a failure and open the circuit at the threshold."""
        self.failures += 1
        if self.failures >= self.failure_threshold:
            self.opened_at = time.monotonic()
            logger.warning("Circuit open after %s consecutive failures.", self.failures)
