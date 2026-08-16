import { safeFetch } from "@/lib/scan/safe-fetch";

export type StoryPage = {
  url: string;
  kind: string;
};

export type StoryCrawl = {
  pages: StoryPage[];
  html: string;
  text: string;
  privacyUrl: string | null;
  privacyExcerpt: string | null;
  teamPageUrl: string | null;
  teamFootprint: number;
};

const STORY_PATHS = [
  "/about",
  "/about-us",
  "/company",
  "/who-we-are",
  "/team",
  "/our-team",
  "/leadership",
  "/people",
  "/founders",
  "/careers",
  "/jobs",
  "/contact",
  "/contact-us",
  "/legal",
  "/terms",
  "/privacy",
  "/privacy-policy",
  "/investors",
  "/kenya",
  "/africa",
  "/locations",
  "/offices",
  "/compliance",
  "/security",
  "/trust",
  "/licensing",
  "/products",
  "/solutions",
  "/services",
];

const STORY_HREF =
  /about|team|people|leadership|founder|career|job|contact|legal|privacy|terms|investor|press|kenya|africa|licen[cs]e|compliance|trust|security|location|office|company|who-we-are|product|solution|service|faq|governance/i;

const SKIP_HREF =
  /\.(pdf|jpe?g|png|gif|svg|webp|css|js|zip|mp4|woff2?)(\?|$)|mailto:|tel:|javascript:|\/(login|signin|signup|cart|checkout|wp-admin|cdn-cgi)\b/i;

const MAX_PAGES = 8;
const PAGE_TIMEOUT_MS = 6000;
const PAGE_BYTES = 80_000;

export function stripToText(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

export function classifyStoryKind(pathname: string) {
  const path = pathname.toLowerCase();
  if (/privacy/.test(path)) return "privacy";
  if (/team|people|leadership|founder/.test(path)) return "team";
  if (/career|job/.test(path)) return "careers";
  if (/contact/.test(path)) return "contact";
  if (/legal|terms/.test(path)) return "legal";
  if (/investor/.test(path)) return "investors";
  if (/compliance|licen|trust|security/.test(path)) return "compliance";
  if (/kenya|africa|location|office/.test(path)) return "presence";
  if (/about|company|who-we-are/.test(path)) return "about";
  return "story";
}

function countTeamFootprint(html: string) {
  const linkedin = html.match(/linkedin\.com\/in\//gi)?.length ?? 0;
  return Math.min(linkedin, 80);
}

function sameOrigin(candidate: URL, origin: URL) {
  return candidate.hostname.replace(/^www\./, "") === origin.hostname.replace(/^www\./, "");
}

function collectCandidates(origin: string, homepageHtml: string) {
  const base = new URL(origin.endsWith("/") ? origin : `${origin}/`);
  const seen = new Set<string>();
  const out: string[] = [];

  function add(raw: string) {
    try {
      const url = new URL(raw, base);
      if (url.protocol !== "https:" && url.protocol !== "http:") return;
      if (!sameOrigin(url, base)) return;
      if (SKIP_HREF.test(url.pathname + url.search) || SKIP_HREF.test(raw)) return;
      url.hash = "";
      const key = url.toString().replace(/\/$/, "");
      if (seen.has(key)) return;
      seen.add(key);
      out.push(url.toString());
    } catch {
      // Ignore malformed hrefs.
    }
  }

  for (const match of homepageHtml.matchAll(/href=["']([^"']+)["']/gi)) {
    const href = match[1]!;
    if (STORY_HREF.test(href) || STORY_HREF.test((() => {
      try {
        return new URL(href, base).pathname;
      } catch {
        return href;
      }
    })())) {
      add(href);
    }
  }

  for (const path of STORY_PATHS) add(path);
  return out;
}

async function fetchPage(url: string) {
  const fetched = await safeFetch(url, { timeoutMs: PAGE_TIMEOUT_MS, maxBytes: PAGE_BYTES });
  if ("error" in fetched || !fetched.response.ok) return null;
  const contentType = fetched.response.headers.get("content-type") ?? "";
  if (contentType && !/html|text\/plain/i.test(contentType)) return null;
  const html = (await fetched.response.text().catch(() => "")).slice(0, PAGE_BYTES);
  if (!html || html.length < 80) return null;
  return { url: fetched.url || url, html };
}

async function mapPool<T, R>(items: T[], size: number, fn: (item: T) => Promise<R | null>) {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += size) {
    const batch = await Promise.all(items.slice(i, i + size).map(fn));
    for (const item of batch) {
      if (item) results.push(item);
    }
  }
  return results;
}

export async function crawlStory(origin: string, homepageHtml: string): Promise<StoryCrawl> {
  const homeUrl = origin.endsWith("/") ? origin.slice(0, -1) : origin;
  const candidates = collectCandidates(origin, homepageHtml)
    .filter((url) => url.replace(/\/$/, "") !== homeUrl)
    .slice(0, MAX_PAGES);

  const fetched = await mapPool(candidates, 4, fetchPage);

  const pages: StoryPage[] = [];
  const htmlParts: string[] = [];
  const textParts: string[] = [];
  let privacyUrl: string | null = null;
  let privacyExcerpt: string | null = null;
  let teamPageUrl: string | null = null;
  let teamFootprint = countTeamFootprint(homepageHtml);

  for (const page of fetched) {
    let kind = "story";
    try {
      kind = classifyStoryKind(new URL(page.url).pathname);
    } catch {
      // Keep generic kind.
    }
    pages.push({ url: page.url, kind });
    htmlParts.push(page.html);
    const text = stripToText(page.html).slice(0, 12_000);
    if (text) textParts.push(text);

    const linkedin = countTeamFootprint(page.html);
    if (linkedin > teamFootprint) {
      teamFootprint = linkedin;
      teamPageUrl = page.url;
    } else if (kind === "team" && !teamPageUrl) {
      teamPageUrl = page.url;
    }

    if (!privacyUrl && (kind === "privacy" || /privacy|personal data|data protection/i.test(text))) {
      privacyUrl = page.url;
      privacyExcerpt = text.slice(0, 4000);
    }
  }

  return {
    pages,
    html: htmlParts.join("\n").slice(0, 200_000),
    text: textParts.join("\n").slice(0, 60_000),
    privacyUrl,
    privacyExcerpt,
    teamPageUrl,
    teamFootprint,
  };
}
