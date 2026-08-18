"""Collector policy and budget tests (no live browser)."""

from __future__ import annotations

import pytest

from crawler.collector import PoliteCrawler
from crawler.config import CrawlerConfig
from crawler.errors import CrawlerError, RobotsDenied, UrlRefused


@pytest.mark.asyncio
async def test_fetch_refuses_login_without_browser() -> None:
    crawler = PoliteCrawler(CrawlerConfig(health_port=-1))
    with pytest.raises(UrlRefused):
        await crawler.fetch("https://example.com/login")


@pytest.mark.asyncio
async def test_page_budget() -> None:
    crawler = PoliteCrawler(CrawlerConfig(max_pages=0, health_port=-1))
    with pytest.raises(CrawlerError, match="budget"):
        await crawler.fetch("https://example.com/")


@pytest.mark.asyncio
async def test_same_origin_only() -> None:
    crawler = PoliteCrawler(CrawlerConfig(health_port=-1, same_origin_only=True))
    crawler._origin = "https://acme.example"
    with pytest.raises(UrlRefused, match="Cross-origin"):
        await crawler.fetch("https://other.example/about")


@pytest.mark.asyncio
async def test_robots_denied(monkeypatch: pytest.MonkeyPatch) -> None:
    crawler = PoliteCrawler(CrawlerConfig(health_port=-1))

    async def deny(_url: str) -> bool:
        return False

    monkeypatch.setattr(crawler.robots, "allowed", deny)
    with pytest.raises(RobotsDenied):
        await crawler.fetch("https://example.com/")
