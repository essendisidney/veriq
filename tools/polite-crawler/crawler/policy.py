"""URL policy: public pages only. No login, registry, or social walls."""

from __future__ import annotations

from urllib.parse import urlparse

from crawler.errors import UrlRefused

REFUSED_HOST_SUFFIXES: tuple[str, ...] = (
    "ecitizen.go.ke",
    "brs.go.ke",
    "itax.kra.go.ke",
    "odpc.go.ke",
    "linkedin.com",
    "facebook.com",
    "instagram.com",
    "x.com",
    "twitter.com",
)

LOGIN_PATHS: tuple[str, ...] = (
    "/login",
    "/signin",
    "/sign-in",
    "/signup",
    "/register",
    "/account",
    "/wp-admin",
    "/checkout",
    "/cart",
    "/paywall",
    "/captcha",
)

LOGIN_BODY_MARKERS: tuple[str, ...] = (
    "recaptcha",
    "hcaptcha",
    "cf-turnstile",
    "please log in",
    "please sign in",
    "this content is for subscribers",
    "paywall",
)


def origin_of(url: str) -> str:
    """Return scheme://host[:port] for a URL."""
    parsed = urlparse(url)
    return f"{parsed.scheme}://{parsed.netloc}"


def host_refused(hostname: str) -> bool:
    """True if the host is a login, registry, or social wall."""
    host = hostname.lower().removeprefix("www.")
    return any(host == suffix or host.endswith(f".{suffix}") for suffix in REFUSED_HOST_SUFFIXES)


def looks_like_login_wall(html: str) -> bool:
    """True if the HTML looks like a login, CAPTCHA, or paywall."""
    sample = html[:8000].lower()
    return any(marker in sample for marker in LOGIN_BODY_MARKERS)


def assert_url_allowed(url: str) -> None:
    """Raise UrlRefused when the URL is out of policy."""
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"}:
        raise UrlRefused("Only http(s) URLs are allowed.")
    if parsed.username or parsed.password:
        raise UrlRefused("Credentials in the URL are refused.")
    if host_refused(parsed.hostname or ""):
        raise UrlRefused("That host is a login, registry, or social wall. This collector does not fetch it.")
    path = (parsed.path or "/").lower()
    if any(path == prefix or path.startswith(prefix + "/") for prefix in LOGIN_PATHS):
        raise UrlRefused("Login, checkout, and admin paths are not crawled.")
