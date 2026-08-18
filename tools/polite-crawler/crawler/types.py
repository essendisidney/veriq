"""Shared dataclasses for extracted pages and selector specs."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any


@dataclass(frozen=True)
class FieldSelector:
    """One named extract rule: CSS, XPath, or both (CSS first)."""

    name: str
    css: str | None = None
    xpath: str | None = None

    def __post_init__(self) -> None:
        if not self.css and not self.xpath:
            raise ValueError(f"Selector '{self.name}' needs css or xpath.")


@dataclass(frozen=True)
class ExtractedPage:
    """Structured result of one successful HTML fetch."""

    url: str
    final_url: str
    status: int
    title: str | None
    fields: dict[str, str | list[str]]
    json_ld: list[dict[str, Any]]
    fetched_at: str
    content_type: str | None
    latency_ms: float = 0.0
    metadata: dict[str, str] = field(default_factory=dict)
    microdata: list[dict[str, Any]] = field(default_factory=list)
    screenshot: bytes | None = None
    pdf: bytes | None = None

    def to_dict(self) -> dict[str, Any]:
        """JSON-serialisable snapshot. Binary captures are reported by size only."""
        return {
            "url": self.url,
            "final_url": self.final_url,
            "status": self.status,
            "title": self.title,
            "fields": self.fields,
            "json_ld": self.json_ld,
            "metadata": self.metadata,
            "microdata": self.microdata,
            "fetched_at": self.fetched_at,
            "content_type": self.content_type,
            "latency_ms": self.latency_ms,
            "screenshot_bytes": len(self.screenshot) if self.screenshot else 0,
            "pdf_bytes": len(self.pdf) if self.pdf else 0,
        }


def utc_now() -> str:
    """UTC timestamp in ISO-8601."""
    return datetime.now(timezone.utc).isoformat()


@dataclass
class HealthStatus:
    """Process and optional target health."""

    status: str
    browser_ready: bool
    circuit_open: bool
    pages_fetched: int
    metrics: dict[str, Any] = field(default_factory=dict)
    target: dict[str, Any] | None = None

    def to_dict(self) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "status": self.status,
            "browser_ready": self.browser_ready,
            "circuit_open": self.circuit_open,
            "pages_fetched": self.pages_fetched,
            "metrics": self.metrics,
        }
        if self.target is not None:
            payload["target"] = self.target
        return payload
