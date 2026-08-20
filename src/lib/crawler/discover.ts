import { sameRegistrable, urlRefused } from "@/lib/digger/policy";

const SKIP =
  /\.(jpe?g|png|gif|svg|webp|css|js|zip|mp4|woff2?|ico)(\?|$)|mailto:|tel:|javascript:|#/i;

const PRIORITY: { re: RegExp; score: number }[] = [
  { re: /privacy/, score: 100 },
  { re: /about|who-we-are|\/company\/?$/i, score: 92 },
  { re: /team|leadership|people|founder/, score: 90 },
  { re: /investor/, score: 84 },
  { re: /licen|compliance|governance|trust|security/, score: 82 },
  { re: /kenya|africa|location|office/, score: 74 },
  { re: /product|solution|service/, score: 70 },
  { re: /contact|legal|terms/, score: 64 },
  { re: /career|job/, score: 50 },
];

export const STORY_SEEDS = [
  "/about",
  "/about-us",
  "/company",
  "/who-we-are",
  "/team",
  "/leadership",
  "/people",
  "/investors",
  "/privacy",
  "/privacy-policy",
  "/legal",
  "/compliance",
  "/trust",
  "/licensing",
  "/contact",
  "/kenya",
  "/products",
  "/services",
];

export function canonicalize(raw: string, base: string): string | null {
  try {
    const url = new URL(raw, base);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (urlRefused(url.toString())) return null;
    url.hash = "";
    url.pathname = url.pathname.replace(/\/+$/, "") || "/";
    return url.toString();
  } catch {
    return null;
  }
}

export function sameSite(candidate: string, origin: string) {
  try {
    return sameRegistrable(new URL(candidate).hostname, new URL(origin).hostname);
  } catch {
    return false;
  }
}

export function pathScore(url: string) {
  try {
    const path = new URL(url).pathname.toLowerCase();
    for (const row of PRIORITY) {
      if (row.re.test(path)) return row.score;
    }
  } catch {
    // Keep default.
  }
  return 20;
}

export function hrefsFromHtml(html: string, base: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const match of html.matchAll(/href=["']([^"']+)["']/gi)) {
    const href = match[1] ?? "";
    if (SKIP.test(href)) continue;
    const url = canonicalize(href, base);
    if (!url || !sameSite(url, base) || seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out;
}

export function pdfHrefs(html: string, base: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const match of html.matchAll(/href=["']([^"']+\.pdf[^"']*)["']/gi)) {
    const url = canonicalize(match[1] ?? "", base);
    if (!url || !sameSite(url, base) || seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out;
}

export function locsFromSitemap(xml: string, origin: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const match of xml.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)) {
    const url = canonicalize(match[1]!.trim(), origin);
    if (!url || !sameSite(url, origin) || seen.has(url)) continue;
    if (SKIP.test(url) && !/\.pdf(\?|$)/i.test(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out.slice(0, 40);
}

export function seedUrls(origin: string): string[] {
  const base = origin.endsWith("/") ? origin : `${origin}/`;
  return STORY_SEEDS.map((path) => canonicalize(path, base)).filter(Boolean) as string[];
}
