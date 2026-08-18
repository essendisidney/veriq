"""Queued, concurrency-limited fetches for the identified collector.

Retries timeouts and 5xx only. Does not retry 401/403/429, rotate
identity, or continue past login / robots denials.
"""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Iterable
from dataclasses import dataclass
from typing import TYPE_CHECKING

from crawler.errors import CrawlerError
from crawler.policy import assert_url_allowed
from crawler.retry import is_transient
from crawler.types import ExtractedPage

if TYPE_CHECKING:
    from crawler.collector import PoliteCrawler

logger = logging.getLogger("polite_crawler.requests")


@dataclass(frozen=True)
class FetchOutcome:
    """One batch item: a page, or a classified failure."""

    url: str
    page: ExtractedPage | None
    error: str | None
    retryable: bool

    def to_dict(self) -> dict[str, object]:
        return {
            "url": self.url,
            "ok": self.page is not None,
            "error": self.error,
            "retryable": self.retryable,
            "page": self.page.to_dict() if self.page else None,
        }


class RequestQueue:
    """FIFO URL queue. Policy checks happen on enqueue."""

    def __init__(self, maxsize: int = 0) -> None:
        self._queue: asyncio.Queue[str] = asyncio.Queue(maxsize=maxsize)

    def qsize(self) -> int:
        return self._queue.qsize()

    async def put(self, url: str) -> None:
        """Enqueue a public URL. Login and refused hosts are rejected here."""
        assert_url_allowed(url)
        await self._queue.put(url)

    async def put_many(self, urls: Iterable[str]) -> int:
        """Enqueue unique URLs in order. Returns how many were accepted."""
        seen: set[str] = set()
        accepted = 0
        for url in urls:
            if url in seen:
                continue
            seen.add(url)
            await self.put(url)
            accepted += 1
        return accepted

    async def get(self) -> str:
        return await self._queue.get()

    def task_done(self) -> None:
        self._queue.task_done()

    async def join(self) -> None:
        await self._queue.join()


class RequestHandler:
    """Fetch and fetch_batch with a semaphore and shared browser session.

    Session cookies live on the Playwright context for this run (and on
    disk when ``session_state_path`` is set). That is same-origin public
    state, not login-wall bypass.
    """

    def __init__(self, crawler: PoliteCrawler) -> None:
        self.crawler = crawler
        self.queue = RequestQueue()
        self._semaphore = asyncio.Semaphore(max(1, crawler.config.concurrency))

    async def fetch(self, url: str, retries: int | None = None) -> ExtractedPage:
        """Fetch one URL. ``retries`` is accepted for compatibility; config owns retry count."""
        if retries is not None and retries != self.crawler.config.max_retries:
            logger.debug("Per-call retries ignored; using config max_retries=%s", self.crawler.config.max_retries)
        return await self.crawler.fetch(url)

    async def fetch_batch(self, urls: list[str], concurrency: int | None = None) -> list[FetchOutcome]:
        """Fetch URLs with a concurrency cap. Order of results matches input order."""
        limit = max(1, concurrency if concurrency is not None else self.crawler.config.concurrency)
        semaphore = asyncio.Semaphore(limit)
        indexed = list(enumerate(urls))
        results: list[FetchOutcome | None] = [None] * len(urls)

        async def worker(index: int, url: str) -> None:
            async with semaphore:
                results[index] = await self._one(url)

        await asyncio.gather(*(worker(i, url) for i, url in indexed))
        return [item if item is not None else FetchOutcome(url=urls[i], page=None, error="missing", retryable=False) for i, item in enumerate(results)]

    async def drain_queue(self, concurrency: int | None = None) -> list[FetchOutcome]:
        """Process everything currently in the queue."""
        urls: list[str] = []
        while self.queue.qsize():
            urls.append(await self.queue.get())
            self.queue.task_done()
        return await self.fetch_batch(urls, concurrency=concurrency)

    def handle_failure(self, error: Exception, url: str) -> FetchOutcome:
        """Classify a failure. Access denials are not retried."""
        retryable = is_transient(error)
        logger.info("Failure for %s retryable=%s: %s", url, retryable, error)
        return FetchOutcome(url=url, page=None, error=str(error), retryable=retryable)

    async def _one(self, url: str) -> FetchOutcome:
        try:
            page = await self.crawler.fetch(url)
            return FetchOutcome(url=url, page=page, error=None, retryable=False)
        except CrawlerError as exc:
            return self.handle_failure(exc, url)
