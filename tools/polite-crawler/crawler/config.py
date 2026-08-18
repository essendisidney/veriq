"""YAML configuration with environment and runtime overrides."""

from __future__ import annotations

import os
from dataclasses import dataclass, field, replace
from pathlib import Path
from typing import Any, Mapping

import yaml

from crawler.errors import ConfigError
from crawler.types import FieldSelector

_TRUE = {"1", "true", "yes", "on"}


def _coerce_env(raw: str, current: Any) -> Any:
    if isinstance(current, bool):
        return raw.lower() in _TRUE
    if isinstance(current, (int, float)) and not isinstance(current, bool):
        if isinstance(current, float) or "." in raw:
            return float(raw)
        return int(raw)
    return raw


def _parse_selectors(raw: Any) -> tuple[FieldSelector, ...]:
    if not raw:
        return ()
    if not isinstance(raw, dict):
        raise ConfigError("selectors must be a mapping of name -> css|xpath spec.")
    selectors: list[FieldSelector] = []
    for name, spec in raw.items():
        if isinstance(spec, str):
            if spec.startswith("/") or spec.startswith("("):
                selectors.append(FieldSelector(name=str(name), xpath=spec))
            else:
                selectors.append(FieldSelector(name=str(name), css=spec))
            continue
        if not isinstance(spec, dict):
            raise ConfigError(f"Selector '{name}' must be a string or mapping.")
        selectors.append(
            FieldSelector(
                name=str(name),
                css=spec.get("css"),
                xpath=spec.get("xpath"),
            )
        )
    return tuple(selectors)


@dataclass(frozen=True)
class CrawlerConfig:
    """Immutable collector settings."""

    user_agent: str = "VERIQ-Scan/1.0 (+https://veriq.ke/bot; contact@example.com)"
    timeout_seconds: float = 20.0
    max_retries: int = 3
    backoff_base_seconds: float = 1.0
    backoff_max_seconds: float = 30.0
    min_delay_seconds: float = 1.0
    max_delay_seconds: float = 3.0
    max_pages: int = 20
    same_origin_only: bool = True
    headless: bool = True
    locale: str = "en-KE"
    proxy: str | None = None
    failure_threshold: int = 5
    cooldown_seconds: float = 60.0
    health_host: str = "127.0.0.1"
    health_port: int = -1
    concurrency: int = 2
    backoff_jitter: bool = True
    session_state_path: str | None = None
    wait_until: str = "load"
    capture_screenshot: bool = False
    capture_pdf: bool = False
    selectors: tuple[FieldSelector, ...] = field(default_factory=tuple)

    @property
    def timeout_ms(self) -> int:
        """Playwright timeout in milliseconds."""
        return int(self.timeout_seconds * 1000)

    def with_overrides(self, **changes: Any) -> CrawlerConfig:
        """Return a copy with runtime field updates."""
        return replace(self, **changes)


_ENV_MAP: dict[str, str] = {
    "user_agent": "CRAWLER_USER_AGENT",
    "timeout_seconds": "CRAWLER_TIMEOUT_SECONDS",
    "max_retries": "CRAWLER_MAX_RETRIES",
    "backoff_base_seconds": "CRAWLER_BACKOFF_BASE_SECONDS",
    "backoff_max_seconds": "CRAWLER_BACKOFF_MAX_SECONDS",
    "min_delay_seconds": "CRAWLER_MIN_DELAY_SECONDS",
    "max_delay_seconds": "CRAWLER_MAX_DELAY_SECONDS",
    "max_pages": "CRAWLER_MAX_PAGES",
    "same_origin_only": "CRAWLER_SAME_ORIGIN_ONLY",
    "headless": "CRAWLER_HEADLESS",
    "locale": "CRAWLER_LOCALE",
    "failure_threshold": "CRAWLER_FAILURE_THRESHOLD",
    "cooldown_seconds": "CRAWLER_COOLDOWN_SECONDS",
    "health_host": "CRAWLER_HEALTH_HOST",
    "health_port": "CRAWLER_HEALTH_PORT",
    "concurrency": "CRAWLER_CONCURRENCY",
    "backoff_jitter": "CRAWLER_BACKOFF_JITTER",
    "session_state_path": "CRAWLER_SESSION_STATE_PATH",
    "wait_until": "CRAWLER_WAIT_UNTIL",
    "capture_screenshot": "CRAWLER_CAPTURE_SCREENSHOT",
    "capture_pdf": "CRAWLER_CAPTURE_PDF",
}


def load_config(
    path: str | Path | None = None,
    overrides: Mapping[str, Any] | None = None,
    environ: Mapping[str, str] | None = None,
) -> CrawlerConfig:
    """Load YAML, apply env vars, then runtime overrides.

    Environment:
        CRAWLER_USER_AGENT, CRAWLER_TIMEOUT_SECONDS, CRAWLER_MAX_RETRIES,
        CRAWLER_MIN_DELAY_SECONDS, CRAWLER_MAX_DELAY_SECONDS, CRAWLER_MAX_PAGES,
        HTTP_PROXY / HTTPS_PROXY, CRAWLER_HEALTH_HOST, CRAWLER_HEALTH_PORT
    """
    env = dict(os.environ if environ is None else environ)
    data: dict[str, Any] = {}
    if path is not None:
        with Path(path).open(encoding="utf-8") as handle:
            loaded = yaml.safe_load(handle) or {}
        if not isinstance(loaded, dict):
            raise ConfigError("config.yaml must be a mapping.")
        data = loaded

    breaker = dict(data.get("circuit_breaker") or {})
    health = dict(data.get("health") or {})
    requests = dict(data.get("requests") or {})
    extract_cfg = dict(data.get("extract") or {})
    selectors = _parse_selectors(data.get("selectors"))

    values: dict[str, Any] = {
        "user_agent": data.get("user_agent", CrawlerConfig.user_agent),
        "timeout_seconds": data.get("timeout_seconds", 20.0),
        "max_retries": data.get("max_retries", 3),
        "backoff_base_seconds": data.get("backoff_base_seconds", 1.0),
        "backoff_max_seconds": data.get("backoff_max_seconds", 30.0),
        "min_delay_seconds": data.get("min_delay_seconds", 1.0),
        "max_delay_seconds": data.get("max_delay_seconds", 3.0),
        "max_pages": data.get("max_pages", 20),
        "same_origin_only": data.get("same_origin_only", True),
        "headless": data.get("headless", True),
        "locale": data.get("locale", "en-KE"),
        "proxy": data.get("proxy"),
        "failure_threshold": breaker.get("failure_threshold", 5),
        "cooldown_seconds": breaker.get("cooldown_seconds", 60.0),
        "health_host": health.get("host", "127.0.0.1"),
        "health_port": health.get("port", -1),
        "concurrency": requests.get("concurrency", 2),
        "backoff_jitter": requests.get("backoff_jitter", True),
        "session_state_path": requests.get("session_state_path"),
        "wait_until": extract_cfg.get("wait_until", "load"),
        "capture_screenshot": extract_cfg.get("capture_screenshot", False),
        "capture_pdf": extract_cfg.get("capture_pdf", False),
        "selectors": selectors,
    }

    for field_name, env_key in _ENV_MAP.items():
        raw = env.get(env_key)
        if raw:
            values[field_name] = _coerce_env(raw, values[field_name])

    proxy = env.get("HTTPS_PROXY") or env.get("HTTP_PROXY") or values.get("proxy")
    if isinstance(proxy, dict):
        raise ConfigError("A single egress proxy URL is supported, not a rotating pool.")
    values["proxy"] = proxy or None

    if overrides:
        extra = dict(overrides)
        if "selectors" in extra and not isinstance(extra["selectors"], tuple):
            extra["selectors"] = _parse_selectors(extra["selectors"])
        if "circuit_breaker" in extra:
            nested = dict(extra.pop("circuit_breaker") or {})
            extra.setdefault("failure_threshold", nested.get("failure_threshold", values["failure_threshold"]))
            extra.setdefault("cooldown_seconds", nested.get("cooldown_seconds", values["cooldown_seconds"]))
        if "requests" in extra:
            nested = dict(extra.pop("requests") or {})
            extra.setdefault("concurrency", nested.get("concurrency", values["concurrency"]))
            extra.setdefault("backoff_jitter", nested.get("backoff_jitter", values["backoff_jitter"]))
            extra.setdefault("session_state_path", nested.get("session_state_path", values["session_state_path"]))
        if "extract" in extra:
            nested = dict(extra.pop("extract") or {})
            extra.setdefault("wait_until", nested.get("wait_until", values["wait_until"]))
            extra.setdefault("capture_screenshot", nested.get("capture_screenshot", values["capture_screenshot"]))
            extra.setdefault("capture_pdf", nested.get("capture_pdf", values["capture_pdf"]))
        values.update(extra)

    values["timeout_seconds"] = float(values["timeout_seconds"])
    values["backoff_base_seconds"] = float(values["backoff_base_seconds"])
    values["backoff_max_seconds"] = float(values["backoff_max_seconds"])
    values["min_delay_seconds"] = float(values["min_delay_seconds"])
    values["max_delay_seconds"] = float(values["max_delay_seconds"])
    values["cooldown_seconds"] = float(values["cooldown_seconds"])
    values["max_retries"] = int(values["max_retries"])
    values["max_pages"] = int(values["max_pages"])
    values["failure_threshold"] = int(values["failure_threshold"])
    values["health_port"] = int(values["health_port"])
    values["concurrency"] = int(values["concurrency"])
    values["same_origin_only"] = bool(values["same_origin_only"])
    values["headless"] = bool(values["headless"])
    values["backoff_jitter"] = bool(values["backoff_jitter"])
    values["capture_screenshot"] = bool(values["capture_screenshot"])
    values["capture_pdf"] = bool(values["capture_pdf"])
    wait_until = str(values["wait_until"]).lower()
    if wait_until not in {"load", "domcontentloaded"}:
        raise ConfigError("extract.wait_until must be 'load' or 'domcontentloaded'.")
    values["wait_until"] = wait_until
    if not values.get("session_state_path"):
        values["session_state_path"] = None

    try:
        return CrawlerConfig(**values)
    except (TypeError, ValueError) as exc:
        raise ConfigError(str(exc)) from exc
