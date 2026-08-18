"""Config loading tests."""

from __future__ import annotations

from pathlib import Path

import pytest

from crawler.config import load_config
from crawler.errors import ConfigError


def test_yaml_and_defaults(yaml_path: Path) -> None:
    config = load_config(yaml_path, environ={})
    assert config.user_agent == "TestBot/1.0"
    assert config.timeout_seconds == 9.0
    assert config.max_retries == 2
    assert config.failure_threshold == 3
    assert config.health_port == 0
    assert config.selectors[0].name == "heading"
    assert config.selectors[0].css == "h1"


def test_env_overrides_yaml(yaml_path: Path) -> None:
    config = load_config(
        yaml_path,
        environ={
            "CRAWLER_USER_AGENT": "EnvBot/2.0",
            "CRAWLER_TIMEOUT_SECONDS": "12.5",
            "HTTPS_PROXY": "http://proxy.internal:8080",
        },
    )
    assert config.user_agent == "EnvBot/2.0"
    assert config.timeout_seconds == 12.5
    assert config.proxy == "http://proxy.internal:8080"


def test_runtime_overrides_win(yaml_path: Path) -> None:
    config = load_config(yaml_path, overrides={"max_pages": 4, "user_agent": "Runtime/1"}, environ={})
    assert config.max_pages == 4
    assert config.user_agent == "Runtime/1"


def test_xpath_selector_from_string() -> None:
    config = load_config(
        overrides={"selectors": {"canon": "//link[@rel='canonical']/@href"}},
        environ={},
    )
    assert config.selectors[0].xpath is not None
    assert config.selectors[0].css is None


def test_invalid_yaml_mapping(tmp_path: Path) -> None:
    path = tmp_path / "bad.yaml"
    path.write_text("- just a list\n", encoding="utf-8")
    with pytest.raises(ConfigError):
        load_config(path)


def test_requests_section_and_single_proxy(yaml_path: Path) -> None:
    config = load_config(
        yaml_path,
        overrides={"requests": {"concurrency": 3, "backoff_jitter": False}},
        environ={},
    )
    assert config.concurrency == 3
    assert config.backoff_jitter is False


def test_invalid_wait_until() -> None:
    with pytest.raises(ConfigError, match="wait_until"):
        load_config(overrides={"wait_until": "networkidle"}, environ={})


def test_proxy_pool_rejected(tmp_path: Path) -> None:
    path = tmp_path / "pool.yaml"
    path.write_text("proxy:\n  pool:\n    - socks5://proxy:1080\n", encoding="utf-8")
    with pytest.raises(ConfigError, match="single egress proxy"):
        load_config(path, environ={})
