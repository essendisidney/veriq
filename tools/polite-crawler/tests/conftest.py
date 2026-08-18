"""Shared pytest fixtures."""

from __future__ import annotations

from pathlib import Path

import pytest

from crawler.config import CrawlerConfig


@pytest.fixture
def config() -> CrawlerConfig:
    return CrawlerConfig(
        min_delay_seconds=0.0,
        max_delay_seconds=0.0,
        health_port=-1,
        max_retries=1,
        backoff_base_seconds=0.01,
        backoff_max_seconds=0.02,
    )


@pytest.fixture
def sample_html() -> str:
    return """<!DOCTYPE html>
<html>
  <head>
    <title>Acme Ltd</title>
    <meta name="description" content="Kenya company site" />
    <meta property="og:title" content="Acme Ltd" />
    <meta property="og:type" content="website" />
    <meta name="twitter:card" content="summary" />
    <link rel="canonical" href="https://acme.example/about" />
    <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@graph": [
          {"@type": "Organization", "name": "Acme Ltd"},
          {"@type": "WebPage", "name": "About"}
        ]
      }
    </script>
  </head>
  <body>
    <h1>About Acme</h1>
    <p class="city">Nairobi</p>
    <div itemscope itemtype="https://schema.org/Organization">
      <span itemprop="name">Acme Ltd</span>
      <span itemprop="address">Nairobi</span>
    </div>
  </body>
</html>
"""


@pytest.fixture
def yaml_path(tmp_path: Path) -> Path:
    path = tmp_path / "config.yaml"
    path.write_text(
        "\n".join(
            [
                "user_agent: TestBot/1.0",
                "timeout_seconds: 9",
                "max_retries: 2",
                "selectors:",
                "  heading: h1",
                "circuit_breaker:",
                "  failure_threshold: 3",
                "health:",
                "  port: 0",
            ]
        ),
        encoding="utf-8",
    )
    return path
