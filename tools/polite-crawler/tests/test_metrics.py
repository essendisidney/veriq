"""Metrics snapshot tests."""

from __future__ import annotations

from crawler.metrics import Metrics


def test_snapshot_averages_latency() -> None:
    metrics = Metrics()
    metrics.record(100.0, ok=True)
    metrics.record(300.0, ok=False)
    metrics.retries = 1
    snap = metrics.snapshot()
    assert snap["requests"] == 2
    assert snap["successes"] == 1
    assert snap["failures"] == 1
    assert snap["retries"] == 1
    assert snap["avg_latency_ms"] == 200.0
