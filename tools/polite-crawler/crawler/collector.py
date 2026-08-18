"""Identified async Playwright collector."""

from __future__ import annotations

import asyncio
import logging
import random
import time
from dataclasses import dataclass
from pathlib import Path
from types import TracebackType
from typing import Any, Mapping, Self

from playwright.async_api import Error as PlaywrightError
from playwright.async_api import Page
from playwright.async_api import TimeoutError as PlaywrightTimeout

from crawler.browser import BrowserManager
from crawler.circuit import CircuitBreaker
from crawler.config import CrawlerConfig, load_config
from crawler.errors import CrawlerError, ResponseInvalid, RobotsDenied, UrlRefused
from crawler.extract import ContentExtractor, extract_page, is_html_content_type
from crawler.health import HealthServer
from crawler.metrics import Metrics
from crawler.policy import assert_url_allowed, looks_like_login_wall, origin_of
from crawler.requests import FetchOutcome, RequestHandler
from crawler.retry import backoff_delay
from crawler.robots import RobotsCache
from crawler.types import ExtractedPage, HealthStatus

logger = logging.getLogger("polite_crawler")

_NO_RETRY_STATUSES = {401, 403, 407, 429}


@dataclass
class _FetchedDocument:
    page: Page
    status: int
    content_type: str
    latency_ms: float


class PoliteCrawler:
    """Fetch public HTML with retries, robots.txt, and structured extract.

    Identifies itself with a fixed User-Agent. Does not hide automation,
    spoof fingerprints, rotate identities, solve CAPTCHAs, or bypass
    login / WAF / paywalls.
    """

    def __init__(self, config: CrawlerConfig) -> None:
        self.config = config
        self.circuit = CircuitBreaker(config.failure_threshold, config.cooldown_seconds)
        self.metrics = Metrics()
        self.browser = BrowserManager(config)
        self.robots = RobotsCache(config.user_agent, timeout_seconds=min(10.0, config.timeout_seconds))
        self._origin: str | None = None
        self._pages_fetched = 0
        self._in_flight = 0
        self._state_lock = asyncio.Lock()
        self._health: HealthServer | None = None
        self.requests = RequestHandler(self)
        self.extractor = ContentExtractor(config.selectors)

    @classmethod
    def from_yaml(
        cls,
        path: str | Path,
        overrides: Mapping[str, Any] | None = None,
    ) -> PoliteCrawler:
        """Build a collector from a YAML file plus optional runtime overrides."""
        return cls(load_config(path, overrides=overrides))

    async def __aenter__(self) -> Self:
        await self.start()
        return self

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        tb: TracebackType | None,
    ) -> None:
        await self.close()

    async def start(self) -> None:
        """Start the browser and optional health HTTP listener."""
        await self.browser.start()
        if self.config.health_port >= 0:
            self._health = HealthServer(
                self.health_payload,
                host=self.config.health_host,
                port=self.config.health_port,
            )
            await self._health.start()

    async def close(self) -> None:
        """Stop health endpoints and close the browser."""
        if self._health:
            await self._health.close()
            self._health = None
        await self.browser.close()
        logger.info("Collector closed. metrics=%s", self.metrics.snapshot())

    @property
    def health_url(self) -> str | None:
        """Base URL of the in-process health server, if started."""
        return self._health.url if self._health else None

    async def health_payload(self) -> dict[str, Any]:
        """JSON body for /health and /metrics."""
        return (await self.health()).to_dict()

    async def health(self, url: str | None = None) -> HealthStatus:
        """Process health, optionally probing robots.txt for a start URL."""
        target: dict[str, Any] | None = None
        status = "ok"
        if not self.browser.ready:
            status = "starting"
        if self.circuit.is_open:
            status = "degraded"
        if url:
            try:
                assert_url_allowed(url)
                allowed = await self.robots.allowed(url)
                target = {
                    "url": url,
                    "robots_allows": allowed,
                    "robots_url": origin_of(url) + "/robots.txt",
                }
                if not allowed:
                    status = "degraded"
            except UrlRefused as exc:
                target = {"url": url, "error": str(exc)}
                status = "degraded"
        return HealthStatus(
            status=status,
            browser_ready=self.browser.ready,
            circuit_open=self.circuit.is_open,
            pages_fetched=self._pages_fetched,
            metrics=self.metrics.snapshot(),
            target=target,
        )

    async def fetch(self, url: str) -> ExtractedPage:
        """Fetch one allowed URL and return structured fields."""
        async with self._state_lock:
            self.circuit.allow()
            if self._pages_fetched + self._in_flight >= self.config.max_pages:
                raise CrawlerError(f"Page budget exhausted ({self.config.max_pages}).")
            assert_url_allowed(url)
            origin = origin_of(url)
            if self._origin is None:
                self._origin = origin
            elif self.config.same_origin_only and origin != self._origin:
                raise UrlRefused("Cross-origin URLs are disabled for this run.")
            self._in_flight += 1
        try:
            if not await self.robots.allowed(url):
                raise RobotsDenied(f"robots.txt disallows {url}")
            await self._polite_wait(url)
            fetched = await self._goto_with_retry(url)
            try:
                html = await fetched.page.content()
                screenshot = (
                    await self.extractor.extract_screenshot(fetched.page)
                    if self.config.capture_screenshot
                    else None
                )
                pdf = (
                    await self.extractor.extract_pdf(fetched.page)
                    if self.config.capture_pdf
                    else None
                )
                extracted = extract_page(
                    url=url,
                    final_url=fetched.page.url,
                    status=fetched.status,
                    html=html,
                    content_type=fetched.content_type,
                    selectors=self.config.selectors,
                    latency_ms=fetched.latency_ms,
                    screenshot=screenshot,
                    pdf=pdf,
                )
                self.circuit.record_success()
                async with self._state_lock:
                    self._pages_fetched += 1
                return extracted
            finally:
                await fetched.page.close()
        finally:
            async with self._state_lock:
                self._in_flight -= 1

    async def fetch_batch(self, urls: list[str], concurrency: int | None = None) -> list[FetchOutcome]:
        """Fetch many URLs with the configured concurrency cap."""
        return await self.requests.fetch_batch(urls, concurrency=concurrency)

    async def _goto_with_retry(self, url: str) -> _FetchedDocument:
        last_error: Exception | None = None
        attempts = self.config.max_retries + 1
        for attempt in range(1, attempts + 1):
            page = await self.browser.context.new_page()
            started = time.monotonic()
            try:
                response = await page.goto(
                    url,
                    wait_until=self.config.wait_until,  # type: ignore[arg-type]
                    timeout=self.config.timeout_ms,
                )
                latency_ms = (time.monotonic() - started) * 1000
                if response is None:
                    raise ResponseInvalid("Navigation returned no response.")
                status = response.status
                content_type = (response.headers.get("content-type") or "").lower()
                if status >= 500:
                    raise ResponseInvalid(f"Server error HTTP {status}")
                if status in _NO_RETRY_STATUSES:
                    raise UrlRefused(f"Access denied HTTP {status}; collector will not retry around this.")
                if status >= 400:
                    raise ResponseInvalid(f"HTTP {status}")
                if not is_html_content_type(content_type):
                    raise ResponseInvalid(f"Unsupported content-type: {content_type or 'unknown'}")
                body = await page.content()
                if looks_like_login_wall(body):
                    raise UrlRefused("Page looks like a login, CAPTCHA, or paywall. Collector stops.")
                self.metrics.record(latency_ms, ok=True)
                return _FetchedDocument(
                    page=page,
                    status=status,
                    content_type=content_type or "text/html",
                    latency_ms=latency_ms,
                )
            except UrlRefused:
                await page.close()
                self.metrics.record((time.monotonic() - started) * 1000, ok=False)
                self.circuit.record_failure()
                raise
            except (PlaywrightTimeout, PlaywrightError, ResponseInvalid, OSError) as exc:
                await page.close()
                last_error = exc
                self.metrics.record((time.monotonic() - started) * 1000, ok=False)
                if attempt >= attempts:
                    break
                delay = backoff_delay(
                    attempt,
                    self.config.backoff_base_seconds,
                    self.config.backoff_max_seconds,
                    jitter=self.config.backoff_jitter,
                )
                self.metrics.retries += 1
                logger.warning(
                    "Attempt %s/%s failed for %s: %s. Backing off %.1fs.",
                    attempt,
                    attempts,
                    url,
                    exc,
                    delay,
                )
                await asyncio.sleep(delay)
        self.circuit.record_failure()
        raise CrawlerError(f"Failed to fetch {url}: {last_error}") from last_error

    async def _polite_wait(self, url: str) -> None:
        crawl_delay = await self.robots.crawl_delay(url)
        floor = crawl_delay if crawl_delay is not None else self.config.min_delay_seconds
        high = max(floor, self.config.max_delay_seconds)
        wait = random.uniform(floor, high)
        logger.debug("Waiting %.2fs before %s", wait, url)
        await asyncio.sleep(wait)
