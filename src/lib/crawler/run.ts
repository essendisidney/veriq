import { extractPdfText } from "@/lib/acquire/extract";
import { bodyLooksGated, urlRefused } from "@/lib/digger/policy";
import { stripToText } from "./text";
import { safeFetch } from "@/lib/scan/safe-fetch";
import {
  canonicalize,
  hrefsFromHtml,
  locsFromSitemap,
  pathScore,
  pdfHrefs,
  sameSite,
  seedUrls,
} from "./discover";
import { loadRobots, robotsAllows } from "./robots";
import type { CrawlInput, CrawlRefused, CrawledPage, CrawlResult, CrawlerStatus } from "./types";

export const CRAWLER_UA = "VERIQ/2.0 (+https://veriq-peach.vercel.app; identified company-site collector)";

const DEFAULT_HTML = 10;
const DEFAULT_PDF = 3;
const HTML_TIMEOUT_MS = 2800;
const PDF_TIMEOUT_MS = 3500;
const HTML_BYTES = 80_000;
const PDF_BYTES = 80_000;
const CONCURRENCY = 2;

function hashText(text: string) {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) hash = (hash * 31 + text.charCodeAt(i)) | 0;
  return Math.abs(hash).toString(16).padStart(8, "0");
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function page(
  input: Pick<CrawledPage, "url" | "status" | "contentType" | "reason"> & Partial<CrawledPage>,
): CrawledPage {
  const html = input.html ?? "";
  const text = input.text ?? (html ? stripToText(html).slice(0, 12_000) : "");
  const excerpt = input.excerpt ?? text.slice(0, 1800);
  return {
    url: input.url,
    status: input.status,
    contentType: input.contentType,
    contentHash: input.contentHash || hashText(excerpt || input.url),
    excerpt,
    html: html.slice(0, HTML_BYTES),
    text,
    reason: input.reason,
  };
}

export async function crawlOrigin(input: CrawlInput): Promise<CrawlResult> {
  const origin = input.origin.replace(/\/$/, "");
  const homepageUrl = canonicalize(input.homepageUrl, origin) ?? input.homepageUrl;
  const homeDeny = urlRefused(homepageUrl);
  if (homeDeny) {
    return {
      origin,
      userAgent: CRAWLER_UA,
      budgetUsed: 0,
      budgetMax: input.maxHtml ?? DEFAULT_HTML,
      robotsFetched: false,
      crawlDelayMs: 350,
      sitemapUsed: false,
      pages: [],
      refused: [{ url: homepageUrl, reason: homeDeny }],
      summary: homeDeny,
    };
  }
  const maxHtml = input.maxHtml ?? DEFAULT_HTML;
  const maxPdf = input.maxPdf ?? DEFAULT_PDF;
  const budgetMax = maxHtml + maxPdf + 2;
  const pages: CrawledPage[] = [];
  const refused: CrawlRefused[] = [];
  const seen = new Set<string>();
  const htmlQueue: string[] = [];
  const pdfQueue: string[] = [];
  let budgetUsed = 0;
  let sitemapUsed = false;
  let hardFails = 0;

  const robots = await loadRobots(origin);
  budgetUsed += 1;

  function allow(url: string): string | null {
    const deny = urlRefused(url);
    if (deny) return deny;
    if (!sameSite(url, origin)) return "Off-origin. VERIQ stays on the company site.";
    try {
      const path = new URL(url).pathname;
      if (robots.fetched && !robotsAllows(robots, path)) return "robots.txt disallows this path.";
    } catch {
      return "URL is not valid.";
    }
    return null;
  }

  function enqueueHtml(url: string | null) {
    if (!url || seen.has(url)) return;
    seen.add(url);
    const deny = allow(url);
    if (deny) {
      if (deny.startsWith("robots.txt")) {
        pages.push(
          page({
            url,
            status: "robots_disallow",
            contentType: "text/html",
            contentHash: "",
            reason: deny,
          }),
        );
        return;
      }
      refused.push({ url, reason: deny });
      return;
    }
    htmlQueue.push(url);
    htmlQueue.sort((a, b) => pathScore(b) - pathScore(a));
  }

  function enqueuePdf(url: string | null) {
    if (!url || seen.has(`pdf:${url}`)) return;
    seen.add(`pdf:${url}`);
    const deny = allow(url);
    if (deny) {
      refused.push({ url, reason: deny });
      return;
    }
    pdfQueue.push(url);
  }

  enqueueHtml(homepageUrl);
  for (const seed of seedUrls(origin)) enqueueHtml(seed);
  for (const href of hrefsFromHtml(input.homepageHtml, homepageUrl)) {
    if (/\.pdf(\?|$)/i.test(href)) enqueuePdf(href);
    else enqueueHtml(href);
  }
  for (const href of pdfHrefs(input.homepageHtml, homepageUrl)) enqueuePdf(href);

  const sitemapCandidates = [
    ...robots.sitemaps,
    new URL("/sitemap.xml", `${origin}/`).toString(),
  ];
  for (const sitemap of sitemapCandidates.slice(0, 2)) {
    if (budgetUsed >= budgetMax) break;
    if (!sameSite(sitemap, origin)) continue;
    budgetUsed += 1;
    const fetched = await safeFetch(sitemap, { timeoutMs: 2500, maxBytes: 60_000 });
    if ("error" in fetched || !fetched.response.ok) continue;
    const type = fetched.response.headers.get("content-type") ?? "";
    if (type && !/xml|text/i.test(type)) continue;
    const xml = await fetched.response.text().catch(() => "");
    if (!xml.includes("<loc")) continue;
    sitemapUsed = true;
    for (const loc of locsFromSitemap(xml, origin)) {
      if (/\.pdf(\?|$)/i.test(loc)) enqueuePdf(loc);
      else enqueueHtml(loc);
    }
    break;
  }

  pages.push(
    page({
      url: homepageUrl,
      status: "fetched",
      contentType: "text/html",
      contentHash: hashText(stripToText(input.homepageHtml).slice(0, 1800)),
      html: input.homepageHtml,
      reason: "Homepage already fetched by the scan. Identified collector. Not a registry extract.",
    }),
  );

  async function fetchHtml(url: string): Promise<CrawledPage> {
    if (url === homepageUrl) {
      return pages[0]!;
    }
    const fetched = await safeFetch(url, { timeoutMs: HTML_TIMEOUT_MS, maxBytes: HTML_BYTES });
    budgetUsed += 1;
    if ("error" in fetched) {
      hardFails += 1;
      return page({
        url,
        status: fetched.error.includes("larger") ? "oversize" : "error",
        contentType: "text/html",
        contentHash: "",
        reason: fetched.error,
      });
    }
    const status = fetched.response.status;
    if (status === 429 || status === 403) {
      hardFails += 1;
      return page({
        url,
        status: status === 403 ? "login_wall" : "error",
        contentType: "text/html",
        contentHash: "",
        reason:
          status === 429
            ? "Host rate-limited the identified collector. Stopped. No identity rotation."
            : "403. Not bypassed.",
      });
    }
    if (status === 401 || status === 402) {
      return page({
        url,
        status: "login_wall",
        contentType: "text/html",
        contentHash: "",
        reason: "Login or payment wall. Not bypassed.",
      });
    }
    if (!fetched.response.ok) {
      hardFails += 1;
      return page({
        url,
        status: "error",
        contentType: fetched.response.headers.get("content-type") ?? "text/html",
        contentHash: "",
        reason: `HTTP ${status}`,
      });
    }
    const contentType = fetched.response.headers.get("content-type") ?? "text/html";
    if (contentType && !/html|text\/plain/i.test(contentType)) {
      return page({
        url,
        status: "error",
        contentType,
        contentHash: "",
        reason: "Not an HTML page.",
      });
    }
    const html = (await fetched.response.text().catch(() => "")).slice(0, HTML_BYTES);
    const gated = bodyLooksGated(html, status);
    if (gated) {
      return page({
        url,
        status: gated,
        contentType,
        contentHash: "",
        reason: "Login, CAPTCHA or paywall detected. Not bypassed.",
      });
    }
    hardFails = 0;
    const next = page({
      url: fetched.url || url,
      status: "fetched",
      contentType,
      html,
      reason: "Same-origin public page. Identified VERIQ collector. Company copy is a claim, not a fact.",
    });
    for (const href of hrefsFromHtml(html, next.url)) {
      if (/\.pdf(\?|$)/i.test(href)) enqueuePdf(href);
      else enqueueHtml(href);
    }
    for (const href of pdfHrefs(html, next.url)) enqueuePdf(href);
    return next;
  }

  const pendingFetched = new Set<string>([homepageUrl]);
  let htmlCount = 1;
  while (htmlCount < maxHtml && hardFails < 3 && budgetUsed < budgetMax) {
    const batch: string[] = [];
    while (batch.length < CONCURRENCY && htmlQueue.length) {
      const url = htmlQueue.shift();
      if (!url || pendingFetched.has(url)) continue;
      pendingFetched.add(url);
      batch.push(url);
    }
    if (!batch.length) break;
    await sleep(robots.crawlDelayMs);
    const fetched = await Promise.all(batch.map((url) => fetchHtml(url)));
    for (const row of fetched) {
      pages.push(row);
      if (row.status === "fetched") htmlCount += 1;
    }
    if (hardFails >= 3) {
      pages.push(
        page({
          url: origin,
          status: "circuit_open",
          contentType: "text/html",
          contentHash: "",
          reason: "Repeated 403/429/errors. Collector stopped. No proxy pool, no fingerprint rotation.",
        }),
      );
      break;
    }
  }

  async function fetchPdf(url: string): Promise<CrawledPage> {
    const fetched = await safeFetch(url, { timeoutMs: PDF_TIMEOUT_MS, maxBytes: PDF_BYTES });
    budgetUsed += 1;
    if ("error" in fetched) {
      return page({
        url,
        status: fetched.error.includes("larger") ? "oversize" : "error",
        contentType: "application/pdf",
        contentHash: "",
        reason: fetched.error,
      });
    }
    const type = fetched.response.headers.get("content-type") ?? "";
    if (!/pdf/i.test(type) && !url.toLowerCase().includes(".pdf")) {
      return page({
        url,
        status: "error",
        contentType: type,
        contentHash: "",
        reason: "Not a PDF.",
      });
    }
    const bytes = new Uint8Array(await fetched.response.arrayBuffer().catch(() => new ArrayBuffer(0)));
    const text = extractPdfText(bytes);
    return page({
      url: fetched.url || url,
      status: "fetched",
      contentType: "application/pdf",
      text,
      excerpt: text.slice(0, 1800),
      reason: text
        ? "Public same-origin PDF. Still a company claim until an independent source agrees."
        : "PDF had no searchable text layer. Not OCR-invented.",
    });
  }

  const pdfs = pdfQueue.slice(0, maxPdf);
  if (pdfs.length) {
    await sleep(robots.crawlDelayMs);
    const fetched = await Promise.all(pdfs.map((url) => fetchPdf(url)));
    pages.push(...fetched);
  }

  const fetched = pages.filter((row) => row.status === "fetched").length;
  const summary = sitemapUsed
    ? `Identified crawl of ${new URL(origin).hostname}: ${fetched} document(s), robots.txt honoured, sitemap used. Login walls and registries were not bypassed.`
    : `Identified crawl of ${new URL(origin).hostname}: ${fetched} document(s), robots.txt honoured. Login walls and registries were not bypassed.`;

  return {
    origin,
    userAgent: CRAWLER_UA,
    budgetUsed: Math.min(budgetUsed, budgetMax),
    budgetMax,
    robotsFetched: robots.fetched,
    crawlDelayMs: robots.crawlDelayMs,
    sitemapUsed,
    pages,
    refused,
    summary,
  };
}
