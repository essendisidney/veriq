"""Fetch one public page with the async collector."""

from __future__ import annotations

import asyncio
import json
import logging
from pathlib import Path

from crawler import PoliteCrawler, load_config

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


async def main() -> None:
    root = Path(__file__).resolve().parent.parent
    config = load_config(root / "config.yaml", overrides={"max_pages": 1, "min_delay_seconds": 0.1, "max_delay_seconds": 0.2})
    async with PoliteCrawler(config) as crawler:
        start = "https://example.com/"
        health = await crawler.health(start)
        if health.status != "ok":
            raise SystemExit(f"Health check failed: {health.to_dict()}")
        page = await crawler.fetch(start)
        print(json.dumps(page.to_dict(), indent=2))


if __name__ == "__main__":
    asyncio.run(main())
