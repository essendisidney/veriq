"""In-process request metrics."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from crawler.types import utc_now


@dataclass
class Metrics:
    """Counters for fetches, retries, and latency."""

    requests: int = 0
    successes: int = 0
    failures: int = 0
    retries: int = 0
    total_latency_ms: float = 0.0
    started_at: str = field(default_factory=utc_now)

    def record(self, latency_ms: float, ok: bool) -> None:
        """Record one attempt (success or failure)."""
        self.requests += 1
        self.total_latency_ms += latency_ms
        if ok:
            self.successes += 1
        else:
            self.failures += 1

    def snapshot(self) -> dict[str, Any]:
        """JSON-serialisable metrics payload."""
        avg = self.total_latency_ms / self.requests if self.requests else 0.0
        return {
            "started_at": self.started_at,
            "requests": self.requests,
            "successes": self.successes,
            "failures": self.failures,
            "retries": self.retries,
            "avg_latency_ms": round(avg, 1),
        }
