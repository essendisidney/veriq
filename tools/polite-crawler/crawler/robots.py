"""robots.txt cache. Missing file allows crawl; fetch errors deny."""

from __future__ import annotations

import asyncio
import logging
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen
from urllib.robotparser import RobotFileParser

logger = logging.getLogger("polite_crawler.robots")


class RobotsCache:
    """Per-origin robots.txt, fetched off the event loop."""

    def __init__(self, user_agent: str, timeout_seconds: float = 10.0) -> None:
        self.user_agent = user_agent
        self.timeout_seconds = timeout_seconds
        self._parsers: dict[str, RobotFileParser] = {}
        self._lock = asyncio.Lock()

    async def allowed(self, url: str) -> bool:
        """True when robots.txt allows this user-agent to fetch ``url``."""
        parser = await self.parser_for(url)
        return parser.can_fetch(self.user_agent, url)

    async def crawl_delay(self, url: str) -> float | None:
        """Crawl-delay for this user-agent, if declared."""
        parser = await self.parser_for(url)
        delay = parser.crawl_delay(self.user_agent)
        return float(delay) if delay is not None else None

    async def parser_for(self, url: str) -> RobotFileParser:
        """Return a cached parser for the URL origin."""
        parsed = urlparse(url)
        origin = f"{parsed.scheme}://{parsed.netloc}"
        async with self._lock:
            cached = self._parsers.get(origin)
            if cached:
                return cached
            parser = await asyncio.to_thread(self._load, origin)
            self._parsers[origin] = parser
            return parser

    def _load(self, origin: str) -> RobotFileParser:
        robots_url = urljoin(origin + "/", "robots.txt")
        parser = RobotFileParser()
        parser.set_url(robots_url)
        request = Request(robots_url, headers={"User-Agent": self.user_agent})
        try:
            with urlopen(request, timeout=self.timeout_seconds) as response:
                body = response.read().decode("utf-8", errors="replace")
            parser.parse(body.splitlines())
        except HTTPError as exc:
            if exc.code in {404, 410}:
                parser.parse([])
            else:
                logger.warning("robots.txt HTTP %s at %s; denying crawl.", exc.code, robots_url)
                parser.parse("User-agent: *\nDisallow: /\n")
        except (URLError, OSError, ValueError, TimeoutError) as exc:
            logger.warning("Could not read robots.txt at %s (%s); denying crawl.", robots_url, exc)
            parser.parse("User-agent: *\nDisallow: /\n")
        return parser
