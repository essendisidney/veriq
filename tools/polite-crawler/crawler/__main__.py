"""CLI: python -m crawler"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import os
from pathlib import Path

from crawler.collector import PoliteCrawler
from crawler.config import load_config


async def _run(url: str, config_path: Path) -> None:
    config = load_config(config_path)
    async with PoliteCrawler(config) as crawler:
        health = await crawler.health(url)
        print(json.dumps(health.to_dict(), indent=2))
        page = await crawler.fetch(url)
        print(json.dumps(page.to_dict(), indent=2))


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    parser = argparse.ArgumentParser(description="Fetch one public HTML page with the polite collector.")
    parser.add_argument("url", nargs="?", default=os.environ.get("CRAWLER_URL", "https://example.com/"))
    parser.add_argument(
        "--config",
        default=os.environ.get("CRAWLER_CONFIG", str(Path(__file__).resolve().parent.parent / "config.yaml")),
    )
    args = parser.parse_args()
    asyncio.run(_run(args.url, Path(args.config)))


if __name__ == "__main__":
    main()
