"""Async Playwright browser lifecycle."""

from __future__ import annotations

import logging
from pathlib import Path
from types import TracebackType
from typing import Any, Self

from playwright.async_api import Browser, BrowserContext, Playwright, async_playwright

from crawler.config import CrawlerConfig
from crawler.errors import BrowserNotStarted

logger = logging.getLogger("polite_crawler.browser")


class BrowserManager:
    """Owns Playwright, Chromium, and a single identified browser context."""

    def __init__(self, config: CrawlerConfig) -> None:
        self.config = config
        self._manager: Any | None = None
        self._playwright: Playwright | None = None
        self._browser: Browser | None = None
        self._context: BrowserContext | None = None

    @property
    def ready(self) -> bool:
        """True when a context is available for new pages."""
        return self._context is not None

    @property
    def context(self) -> BrowserContext:
        """Active browser context, or raise if not started."""
        if self._context is None:
            raise BrowserNotStarted("Browser is not started. Use 'async with BrowserManager(...)'.")
        return self._context

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
        """Launch Chromium with a fixed, identifiable user-agent."""
        if self._browser:
            return
        launch_kwargs: dict[str, Any] = {"headless": self.config.headless}
        if self.config.proxy:
            launch_kwargs["proxy"] = {"server": self.config.proxy}
            logger.info("Using configured egress proxy.")
        self._manager = async_playwright()
        self._playwright = await self._manager.start()
        self._browser = await self._playwright.chromium.launch(**launch_kwargs)
        context_kwargs: dict[str, Any] = {
            "user_agent": self.config.user_agent,
            "locale": self.config.locale,
            "extra_http_headers": {"Accept-Language": "en-KE,en;q=0.8"},
        }
        if self.config.session_state_path:
            state_path = Path(self.config.session_state_path)
            if state_path.exists():
                context_kwargs["storage_state"] = str(state_path)
                logger.info("Loaded same-origin session state from %s", state_path)
        self._context = await self._browser.new_context(**context_kwargs)
        self._context.set_default_timeout(self.config.timeout_ms)
        logger.info("Browser started with identifiable UA %s", self.config.user_agent)

    async def save_session(self) -> None:
        """Persist public same-origin cookies for this identified crawler."""
        if not self.config.session_state_path or self._context is None:
            return
        path = Path(self.config.session_state_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        await self._context.storage_state(path=str(path))
        logger.info("Saved same-origin session state to %s", path)

    async def close(self) -> None:
        """Close context, browser, and Playwright in reverse order."""
        try:
            await self.save_session()
        except OSError as exc:
            logger.warning("Could not save session state: %s", exc)
        if self._context:
            await self._context.close()
            self._context = None
        if self._browser:
            await self._browser.close()
            self._browser = None
        if self._playwright:
            await self._playwright.stop()
            self._playwright = None
        self._manager = None
        logger.info("Browser closed.")
