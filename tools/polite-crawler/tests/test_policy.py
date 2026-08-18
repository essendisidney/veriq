"""URL policy tests."""

from __future__ import annotations

import pytest

from crawler.errors import UrlRefused
from crawler.policy import assert_url_allowed, looks_like_login_wall


@pytest.mark.parametrize(
    "url",
    [
        "ftp://example.com/",
        "https://user:pass@example.com/",
        "https://brs.go.ke/search",
        "https://www.linkedin.com/company/acme",
        "https://example.com/login",
        "https://example.com/wp-admin/index.php",
        "https://example.com/checkout/pay",
    ],
)
def test_refused_urls(url: str) -> None:
    with pytest.raises(UrlRefused):
        assert_url_allowed(url)


def test_public_url_allowed() -> None:
    assert_url_allowed("https://acme.example/about")


def test_login_wall_markers() -> None:
    assert looks_like_login_wall("<html>please sign in to continue</html>")
    assert looks_like_login_wall("<div class='g-recaptcha'></div>")
    assert not looks_like_login_wall("<html><h1>About us</h1></html>")
