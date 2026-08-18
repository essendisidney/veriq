"""Request queue, batch fetch, and failure classification tests."""

from __future__ import annotations

import asyncio

import pytest

from crawler.collector import PoliteCrawler
from crawler.config import CrawlerConfig
from crawler.errors import ResponseInvalid, UrlRefused
from crawler.requests import RequestHandler, RequestQueue
from crawler.retry import is_transient
from crawler.types import ExtractedPage


def _page(url: str) -> ExtractedPage:
    return ExtractedPage(
        url=url,
        final_url=url,
        status=200,
        title="ok",
        fields={},
        json_ld=[],
        fetched_at="2026-01-01T00:00:00+00:00",
        content_type="text/html",
    )


def test_access_denied_is_not_transient() -> None:
    assert not is_transient(UrlRefused("Access denied HTTP 403"))
    assert is_transient(ResponseInvalid("Server error HTTP 503"))
    assert is_transient(TimeoutError("timed out"))


@pytest.mark.asyncio
async def test_queue_rejects_login() -> None:
    queue = RequestQueue()
    with pytest.raises(UrlRefused):
        await queue.put("https://example.com/login")


@pytest.mark.asyncio
async def test_handle_failure_does_not_retry_403() -> None:
    crawler = PoliteCrawler(CrawlerConfig(health_port=-1))
    handler = RequestHandler(crawler)
    outcome = handler.handle_failure(UrlRefused("Access denied HTTP 403"), "https://example.com/")
    assert outcome.page is None
    assert outcome.retryable is False


@pytest.mark.asyncio
async def test_fetch_batch_preserves_order(monkeypatch: pytest.MonkeyPatch) -> None:
    crawler = PoliteCrawler(CrawlerConfig(health_port=-1, concurrency=2, max_pages=10))
    handler = RequestHandler(crawler)

    async def fake_fetch(url: str) -> ExtractedPage:
        await asyncio.sleep(0.01)
        if "denied" in url:
            raise UrlRefused("Access denied HTTP 403")
        return _page(url)

    monkeypatch.setattr(crawler, "fetch", fake_fetch)
    outcomes = await handler.fetch_batch(
        ["https://example.com/a", "https://example.com/denied", "https://example.com/c"],
        concurrency=2,
    )
    assert [item.url.split("/")[-1] for item in outcomes] == ["a", "denied", "c"]
    assert outcomes[0].page is not None
    assert outcomes[1].retryable is False
    assert outcomes[2].page is not None


@pytest.mark.asyncio
async def test_fetch_batch_respects_concurrency(monkeypatch: pytest.MonkeyPatch) -> None:
    crawler = PoliteCrawler(CrawlerConfig(health_port=-1, concurrency=2))
    handler = RequestHandler(crawler)
    current = 0
    peak = 0

    async def fake_fetch(url: str) -> ExtractedPage:
        nonlocal current, peak
        current += 1
        peak = max(peak, current)
        await asyncio.sleep(0.05)
        current -= 1
        return _page(url)

    monkeypatch.setattr(crawler, "fetch", fake_fetch)
    await handler.fetch_batch(
        [f"https://example.com/{i}" for i in range(6)],
        concurrency=2,
    )
    assert peak <= 2
