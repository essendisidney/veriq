"""HTML, CSS, XPath, and JSON-LD extraction tests."""

from __future__ import annotations

import pytest

from crawler.errors import ResponseInvalid
from crawler.extract import ContentExtractor, extract_page, parse_json_ld, validate_html
from crawler.types import FieldSelector
from bs4 import BeautifulSoup


def test_validate_rejects_non_html() -> None:
    with pytest.raises(ResponseInvalid):
        validate_html("<html></html>", "application/json")
    with pytest.raises(ResponseInvalid):
        validate_html("not html at all", "text/html")


def test_css_xpath_and_json_ld(sample_html: str) -> None:
    page = extract_page(
        url="https://acme.example/",
        final_url="https://acme.example/about",
        status=200,
        html=sample_html,
        content_type="text/html; charset=utf-8",
        selectors=(
            FieldSelector(name="heading", css="h1"),
            FieldSelector(name="city", css="p.city"),
            FieldSelector(name="canonical", xpath="//link[@rel='canonical']/@href"),
            FieldSelector(name="missing", css=".nope", xpath="//p[@id='missing']"),
        ),
    )
    assert page.title == "Acme Ltd"
    assert page.fields["heading"] == "About Acme"
    assert page.fields["city"] == "Nairobi"
    assert page.fields["canonical"] == "https://acme.example/about"
    assert "missing" not in page.fields
    types = {item.get("@type") for item in page.json_ld}
    assert types == {"Organization", "WebPage"}
    assert page.metadata["og:title"] == "Acme Ltd"
    assert page.metadata["twitter:card"] == "summary"
    assert page.metadata["canonical"] == "https://acme.example/about"
    assert page.microdata[0]["@type"] == "https://schema.org/Organization"
    assert page.microdata[0]["properties"]["name"] == "Acme Ltd"


def test_content_extractor_selectors_and_json_ld(sample_html: str) -> None:
    extractor = ContentExtractor()
    assert "Acme Ltd" in extractor.extract_html(sample_html)
    assert extractor.extract_metadata(sample_html)["og:type"] == "website"
    fields = extractor.extract_selectors(sample_html, {"heading": "h1", "city": "p.city"})
    assert fields["heading"] == "About Acme"
    assert extractor.extract_json_ld(sample_html)[0]["@type"] == "Organization"


def test_json_ld_list_payload() -> None:
    html = """<html><head>
    <script type="application/ld+json">[{"@type":"Person","name":"Ada"},{"@type":"Person","name":"Grace"}]</script>
    </head><body></body></html>"""
    soup = BeautifulSoup(html, "lxml")
    blocks = parse_json_ld(soup)
    assert [block["name"] for block in blocks] == ["Ada", "Grace"]
