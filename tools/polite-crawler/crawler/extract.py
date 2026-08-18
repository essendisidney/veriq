"""HTML validation, CSS/XPath fields, and JSON-LD extraction."""

from __future__ import annotations

import json
import logging
import re
from typing import TYPE_CHECKING, Any

from bs4 import BeautifulSoup, Tag
from lxml import html as lxml_html
from lxml.etree import XPathError

from crawler.errors import ResponseInvalid
from crawler.types import ExtractedPage, FieldSelector, utc_now

if TYPE_CHECKING:
    from playwright.async_api import Page

logger = logging.getLogger("polite_crawler.extract")

_DOCTYPE_OR_HTML = re.compile(r"<!doctype\s+html|<html[\s>]", re.IGNORECASE)


def is_html_content_type(content_type: str | None) -> bool:
    """True for text/html or XHTML responses."""
    if not content_type:
        return False
    lowered = content_type.lower()
    return "text/html" in lowered or "application/xhtml" in lowered


def validate_html(html: str, content_type: str | None) -> None:
    """Raise ResponseInvalid when the body is not a usable HTML document."""
    if not is_html_content_type(content_type):
        raise ResponseInvalid(f"Unsupported content-type: {content_type or 'unknown'}")
    if not html or not html.strip():
        raise ResponseInvalid("Empty HTML body.")
    if not _DOCTYPE_OR_HTML.search(html[:4000]):
        raise ResponseInvalid("Body is not an HTML document.")


def _node_value(node: Tag) -> str | None:
    if node.name == "meta":
        content = node.get("content")
        return str(content).strip() if content else None
    text = node.get_text(" ", strip=True)
    return text or None


def extract_css(soup: BeautifulSoup, selector: str) -> str | list[str] | None:
    """Extract text or meta content for a CSS selector."""
    nodes = soup.select(selector)
    values = [value for node in nodes if (value := _node_value(node))]
    if not values:
        return None
    if len(values) == 1:
        return values[0]
    return values


def extract_xpath(document: lxml_html.HtmlElement, xpath: str) -> str | list[str] | None:
    """Extract text or attributes for an XPath expression."""
    try:
        results = document.xpath(xpath)
    except XPathError as exc:
        logger.debug("Invalid XPath %s: %s", xpath, exc)
        return None
    values: list[str] = []
    for item in results:
        if isinstance(item, str):
            text = item.strip()
        elif hasattr(item, "text_content"):
            text = str(item.text_content()).strip()
        else:
            text = str(item).strip()
        if text:
            values.append(text)
    if not values:
        return None
    if len(values) == 1:
        return values[0]
    return values


def parse_json_ld(soup: BeautifulSoup) -> list[dict[str, Any]]:
    """Parse application/ld+json blocks, including @graph lists."""
    blocks: list[dict[str, Any]] = []
    for tag in soup.find_all("script", attrs={"type": "application/ld+json"}):
        text = (tag.string or tag.get_text() or "").strip()
        if not text:
            continue
        try:
            payload = json.loads(text)
        except json.JSONDecodeError:
            logger.debug("Skipping invalid JSON-LD on page.")
            continue
        blocks.extend(_flatten_json_ld(payload))
    return blocks


def _flatten_json_ld(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, list):
        nested: list[dict[str, Any]] = []
        for item in payload:
            nested.extend(_flatten_json_ld(item))
        return nested
    if not isinstance(payload, dict):
        return []
    graph = payload.get("@graph")
    if isinstance(graph, list):
        return [item for item in graph if isinstance(item, dict)]
    return [payload]


def extract_metadata(soup: BeautifulSoup) -> dict[str, str]:
    """Open Graph, Twitter card, description, canonical, and keywords."""
    meta: dict[str, str] = {}
    for tag in soup.find_all("meta"):
        key = tag.get("property") or tag.get("name")
        content = tag.get("content")
        if not key or content is None:
            continue
        name = str(key).strip().lower()
        value = str(content).strip()
        if not value:
            continue
        if name.startswith("og:") or name.startswith("twitter:") or name in {
            "description",
            "keywords",
            "author",
            "robots",
        }:
            meta[name] = value
    canonical = soup.find("link", rel=lambda value: value and "canonical" in value)
    if canonical and canonical.get("href"):
        meta["canonical"] = str(canonical.get("href")).strip()
    return meta


def _microdata_value(node: Tag) -> str | None:
    for attr in ("content", "datetime", "href", "src", "data"):
        if node.has_attr(attr):
            value = str(node.get(attr) or "").strip()
            if value:
                return value
    text = node.get_text(" ", strip=True)
    return text or None


def _microdata_item(node: Tag) -> dict[str, Any]:
    item: dict[str, Any] = {}
    item_type = node.get("itemtype")
    if item_type:
        item["@type"] = str(item_type).strip()
    item_id = node.get("itemid")
    if item_id:
        item["@id"] = str(item_id).strip()
    props: dict[str, Any] = {}
    for child in node.find_all(attrs={"itemprop": True}):
        parent_scope = child.find_parent(attrs={"itemscope": True})
        if parent_scope is not node:
            continue
        name = str(child.get("itemprop") or "").strip()
        if not name:
            continue
        value: Any
        if child.has_attr("itemscope"):
            value = _microdata_item(child)
        else:
            value = _microdata_value(child)
        if not value:
            continue
        if name in props:
            existing = props[name]
            props[name] = existing + [value] if isinstance(existing, list) else [existing, value]
        else:
            props[name] = value
    item["properties"] = props
    return item


def extract_microdata(soup: BeautifulSoup) -> list[dict[str, Any]]:
    """Schema.org microdata itemscope/itemprop trees."""
    items: list[dict[str, Any]] = []
    for node in soup.find_all(attrs={"itemscope": True}):
        if node.find_parent(attrs={"itemscope": True}):
            continue
        items.append(_microdata_item(node))
    return items


def extract_fields(
    html: str,
    selectors: tuple[FieldSelector, ...],
) -> dict[str, str | list[str]]:
    """Run configured CSS/XPath selectors against HTML."""
    soup = BeautifulSoup(html, "lxml")
    document = lxml_html.fromstring(html)
    fields: dict[str, str | list[str]] = {}
    for spec in selectors:
        value: str | list[str] | None = None
        if spec.css:
            value = extract_css(soup, spec.css)
        if value is None and spec.xpath:
            value = extract_xpath(document, spec.xpath)
        if value is not None:
            fields[spec.name] = value
    return fields


def extract_page(
    *,
    url: str,
    final_url: str,
    status: int,
    html: str,
    content_type: str | None,
    selectors: tuple[FieldSelector, ...],
    latency_ms: float = 0.0,
    screenshot: bytes | None = None,
    pdf: bytes | None = None,
) -> ExtractedPage:
    """Validate HTML and return structured fields, JSON-LD, OG, and microdata."""
    validate_html(html, content_type)
    soup = BeautifulSoup(html, "lxml")
    fields = extract_fields(html, selectors)
    title_node = soup.title
    title = title_node.string.strip() if title_node and title_node.string else None
    if "title" not in fields and title:
        fields["title"] = title
    return ExtractedPage(
        url=url,
        final_url=final_url,
        status=status,
        title=title,
        fields=fields,
        json_ld=parse_json_ld(soup),
        fetched_at=utc_now(),
        content_type=content_type,
        latency_ms=latency_ms,
        metadata=extract_metadata(soup),
        microdata=extract_microdata(soup),
        screenshot=screenshot,
        pdf=pdf,
    )


class ContentExtractor:
    """HTML, JSON-LD, Open Graph, microdata, and optional page captures.

    Screenshot and PDF are of the already-fetched public page after JS has
    run. They are not used to bypass login or challenge walls.
    """

    def __init__(self, selectors: tuple[FieldSelector, ...] = ()) -> None:
        self.selectors = selectors

    def extract_html(self, html: str) -> str:
        """Return the HTML document as-is after a successful fetch."""
        return html

    def extract_json_ld(self, html: str) -> list[dict[str, Any]]:
        """Parse JSON-LD script blocks."""
        return parse_json_ld(BeautifulSoup(html, "lxml"))

    def extract_metadata(self, html: str) -> dict[str, str]:
        """Open Graph, Twitter, and standard meta tags."""
        return extract_metadata(BeautifulSoup(html, "lxml"))

    def extract_microdata(self, html: str) -> list[dict[str, Any]]:
        """Microdata itemscope trees."""
        return extract_microdata(BeautifulSoup(html, "lxml"))

    def extract_selectors(
        self,
        html: str,
        selectors: dict[str, str] | tuple[FieldSelector, ...] | None = None,
    ) -> dict[str, str | list[str]]:
        """Custom CSS/XPath fields. Dict values are CSS, or XPath if they start with ``/``."""
        if selectors is None:
            specs = self.selectors
        elif isinstance(selectors, tuple):
            specs = selectors
        else:
            specs = tuple(
                FieldSelector(name=name, xpath=spec) if spec.startswith("/") or spec.startswith("(")
                else FieldSelector(name=name, css=spec)
                for name, spec in selectors.items()
            )
        return extract_fields(html, specs)

    async def extract_screenshot(self, page: Page) -> bytes:
        """PNG of the current public page viewport after JS execution."""
        return await page.screenshot(type="png", full_page=False)

    async def extract_pdf(self, page: Page) -> bytes:
        """PDF of the current public page after JS execution."""
        return await page.pdf(print_background=False)
