export const CRAWL_STATUSES = [
  "fetched",
  "robots_disallow",
  "refused",
  "login_wall",
  "paywall",
  "captcha",
  "oversize",
  "error",
  "circuit_open",
] as const;
export type CrawlerStatus = (typeof CRAWL_STATUSES)[number];

export type CrawledPage = {
  url: string;
  status: CrawlerStatus;
  contentType: string;
  contentHash: string;
  excerpt: string;
  html: string;
  text: string;
  reason: string;
};

export type CrawlRefused = {
  url: string;
  reason: string;
};

export type CrawlResult = {
  origin: string;
  userAgent: string;
  budgetUsed: number;
  budgetMax: number;
  robotsFetched: boolean;
  crawlDelayMs: number;
  sitemapUsed: boolean;
  pages: CrawledPage[];
  refused: CrawlRefused[];
  summary: string;
};

export type CrawlInput = {
  origin: string;
  homepageUrl: string;
  homepageHtml: string;
  maxHtml?: number;
  maxPdf?: number;
};
