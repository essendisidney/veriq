from crawler.errors import UrlRefused
from crawler.policy import assert_url_allowed


def test_package_exports() -> None:
    from crawler import CrawlerConfig, PoliteCrawler, load_config

    assert CrawlerConfig().max_pages == 20
    assert PoliteCrawler is not None
    assert callable(load_config)
    assert issubclass(UrlRefused, Exception)
    assert_url_allowed("https://example.com/")
