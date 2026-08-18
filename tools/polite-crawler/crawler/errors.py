"""Collector exceptions."""

from __future__ import annotations


class CrawlerError(Exception):
    """Base error for the polite collector."""


class ConfigError(CrawlerError):
    """Invalid configuration."""


class RobotsDenied(CrawlerError):
    """robots.txt disallows this fetch."""


class UrlRefused(CrawlerError):
    """URL is a login wall, registry, or otherwise out of policy."""


class CircuitOpen(CrawlerError):
    """Too many consecutive failures; collector paused."""


class ResponseInvalid(CrawlerError):
    """Response was not a usable HTML document."""


class BrowserNotStarted(CrawlerError):
    """Browser lifecycle has not been started."""
