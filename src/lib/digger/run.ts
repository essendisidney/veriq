import { extractPdfText } from "@/lib/acquire/extract";
import { safeFetch } from "@/lib/scan/safe-fetch";
import { stripToText } from "@/lib/scan/story";
import { companyAliases } from "./aliases";
import { adjudicateClaims, extractRawClaims, type EvidenceHit } from "./claims";
import { extractPeople } from "./people";
import { bodyLooksGated, sameRegistrable, urlRefused } from "./policy";
import { loadRobots, robotsAllows } from "./robots";
import type { CrawlRecord, DiggerReport, SourceClass } from "./types";
import { EMPTY_DIGGER } from "./types";

const BUDGET_MAX = 8;
const PDF_MAX = 2;
const PDF_TIMEOUT_MS = 3500;
const PDF_BYTES = 80_000;

function hashText(text: string) {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) hash = (hash * 31 + text.charCodeAt(i)) | 0;
  return Math.abs(hash).toString(16).padStart(8, "0");
}

function record(input: Omit<CrawlRecord, "changed"> & { previous?: string | null }): CrawlRecord {
  const changed =
    input.status === "fetched" && input.previous
      ? input.previous !== input.contentHash
      : input.status === "fetched" && !input.previous
        ? null
        : false;
  return {
    url: input.url,
    status: input.status,
    contentType: input.contentType,
    contentHash: input.contentHash,
    excerpt: input.excerpt,
    sourceClass: input.sourceClass,
    reason: input.reason,
    changed,
  };
}

function pdfHrefs(origin: string, html: string) {
  const base = new URL(origin.endsWith("/") ? origin : `${origin}/`);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const match of html.matchAll(/href=["']([^"']+\.pdf[^"']*)["']/gi)) {
    try {
      const url = new URL(match[1]!, base);
      if (!sameRegistrable(url.hostname, base.hostname)) continue;
      const key = url.toString().split("#")[0]!;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(key);
    } catch {
      // Ignore.
    }
  }
  return out;
}

export type DiggerInput = {
  origin: string | null;
  homepageUrl: string | null;
  homepageHtml: string;
  storyHtml: string;
  storyText: string;
  storyPages: { url: string; kind: string }[];
  companyName: string;
  vault: { filename: string; kind: string; text: string | null }[];
  previousHashes: { url: string; content_hash: string }[];
};

export async function runDigger(input: DiggerInput): Promise<DiggerReport> {
  if (!input.origin || !input.homepageUrl) {
    return { ...EMPTY_DIGGER, summary: "No public origin to crawl under robots and budget." };
  }

  const originHost = new URL(input.origin).hostname;
  const refused: { url: string; reason: string }[] = [];
  const pages: CrawlRecord[] = [];
  const prev = new Map(input.previousHashes.map((row) => [row.url, row.content_hash]));
  let budgetUsed = 0;

  const blockedHome = urlRefused(input.homepageUrl);
  if (blockedHome) {
    refused.push({ url: input.homepageUrl, reason: blockedHome });
    return {
      ...EMPTY_DIGGER,
      origin: input.origin,
      refused,
      summary: blockedHome,
    };
  }

  const robots = await loadRobots(input.origin);
  budgetUsed += 1;

  const htmlPages = [
    { url: input.homepageUrl, html: input.homepageHtml, kind: "home" },
    ...input.storyPages.map((page) => ({
      url: page.url,
      html: "",
      kind: page.kind,
    })),
  ];

  const homeText = stripToText(input.homepageHtml);
  const combinedHtml = `${input.homepageHtml}\n${input.storyHtml}`;

  for (const page of htmlPages) {
    const deny = urlRefused(page.url);
    if (deny) {
      refused.push({ url: page.url, reason: deny });
      continue;
    }
    try {
      const path = new URL(page.url).pathname;
      if (robots.fetched && !robotsAllows(robots, path)) {
        pages.push(
          record({
            url: page.url,
            status: "robots_disallow",
            contentType: "text/html",
            contentHash: "",
            excerpt: "",
            sourceClass: "company_web",
            reason: "robots.txt disallows this path.",
            previous: prev.get(page.url) ?? null,
          }),
        );
        continue;
      }
    } catch {
      // Keep.
    }
    const html = page.html || (page.kind === "home" ? input.homepageHtml : "");
    const text =
      page.kind === "home" ? homeText : input.storyText.slice(0, 12_000);
    const gated = html ? bodyLooksGated(html, 200) : null;
    if (gated) {
      pages.push(
        record({
          url: page.url,
          status: gated,
          contentType: "text/html",
          contentHash: "",
          excerpt: "",
          sourceClass: "company_web",
          reason: "Login, CAPTCHA or paywall detected. Not bypassed.",
          previous: prev.get(page.url) ?? null,
        }),
      );
      continue;
    }
    const excerpt = (html ? stripToText(html) : text).slice(0, 1800);
    const contentHash = hashText(excerpt);
    pages.push(
      record({
        url: page.url,
        status: "fetched",
        contentType: "text/html",
        contentHash,
        excerpt,
        sourceClass: "company_web",
        reason: "Same-origin public page. Company-provided, not a registry extract.",
        previous: prev.get(page.url) ?? null,
      }),
    );
  }

  const pdfs = pdfHrefs(input.origin, combinedHtml).slice(0, PDF_MAX);
  await Promise.all(
    pdfs.map(async (url) => {
      const deny = urlRefused(url);
      if (deny) {
        refused.push({ url, reason: deny });
        return;
      }
      try {
        if (robots.fetched && !robotsAllows(robots, new URL(url).pathname)) {
          pages.push(
            record({
              url,
              status: "robots_disallow",
              contentType: "application/pdf",
              contentHash: "",
              excerpt: "",
              sourceClass: "company_web",
              reason: "robots.txt disallows this PDF.",
              previous: prev.get(url) ?? null,
            }),
          );
          return;
        }
      } catch {
        return;
      }
      budgetUsed += 1;
      const fetched = await safeFetch(url, { timeoutMs: PDF_TIMEOUT_MS, maxBytes: PDF_BYTES });
      if ("error" in fetched) {
        pages.push(
          record({
            url,
            status: fetched.error.includes("larger") ? "oversize" : "error",
            contentType: "application/pdf",
            contentHash: "",
            excerpt: "",
            sourceClass: "company_web",
            reason: fetched.error,
            previous: prev.get(url) ?? null,
          }),
        );
        return;
      }
      const type = fetched.response.headers.get("content-type") ?? "";
      if (!/pdf/i.test(type) && !url.toLowerCase().includes(".pdf")) {
        pages.push(
          record({
            url,
            status: "error",
            contentType: type,
            contentHash: "",
            excerpt: "",
            sourceClass: "company_web",
            reason: "Not a PDF.",
            previous: prev.get(url) ?? null,
          }),
        );
        return;
      }
      const bytes = new Uint8Array(await fetched.response.arrayBuffer().catch(() => new ArrayBuffer(0)));
      const text = extractPdfText(bytes);
      const excerpt = text.slice(0, 1800);
      pages.push(
        record({
          url: fetched.url || url,
          status: "fetched",
          contentType: "application/pdf",
          contentHash: hashText(excerpt || url),
          excerpt,
          sourceClass: "company_web",
          reason: excerpt
            ? "Public same-origin PDF. Still a company claim until an independent source agrees."
            : "PDF had no searchable text layer. Not OCR-invented.",
          previous: prev.get(url) ?? null,
        }),
      );
    }),
  );

  const hits: EvidenceHit[] = [];
  for (const page of pages) {
    if (page.status !== "fetched" || !page.excerpt) continue;
    hits.push({
      url: page.url,
      excerpt: page.excerpt,
      sourceClass: page.sourceClass,
      text: page.excerpt,
    });
  }
  hits.push({
    url: input.homepageUrl,
    excerpt: homeText.slice(0, 4000),
    sourceClass: "company_web",
    text: `${homeText}\n${input.storyText}`.slice(0, 40_000),
  });
  for (const doc of input.vault) {
    if (!doc.text) continue;
    hits.push({
      url: `vault:${doc.kind}:${doc.filename}`,
      excerpt: doc.text.slice(0, 800),
      sourceClass: "customer",
      text: doc.text,
    });
  }

  const claims = adjudicateClaims(extractRawClaims(hits));
  const people = [
    ...extractPeople(input.homepageUrl, input.homepageHtml),
    ...extractPeople(input.origin, input.storyHtml),
  ]
    .filter((row, i, all) => all.findIndex((item) => item.name === row.name) === i)
    .slice(0, 12);

  const changes = pages
    .filter((page) => page.changed)
    .map((page) => ({
      url: page.url,
      previousHash: prev.get(page.url) ?? "",
      currentHash: page.contentHash,
    }));

  const fetched = pages.filter((page) => page.status === "fetched").length;
  const summary =
    claims.filter((item) => item.verdict === "unverified").length >= 1
      ? `Permitted crawl of ${originHost}: ${fetched} page(s), ${claims.length} claim(s). Company copy is a claim, not a fact. Registry, bureau and login walls were not bypassed.`
      : `Permitted crawl of ${originHost}: ${fetched} page(s). No marketing claims were extracted. Missing evidence stays UNKNOWN.`;

  return {
    origin: input.origin,
    budgetUsed: Math.min(budgetUsed, BUDGET_MAX),
    budgetMax: BUDGET_MAX,
    pages,
    refused,
    claims,
    people,
    aliases: companyAliases(input.companyName),
    changes,
    summary,
  };
}

export function sourceClassLabel(value: SourceClass) {
  return {
    authoritative: "Authoritative",
    licensed: "Licensed",
    customer: "Customer-authorised",
    company_web: "Company website",
    public_web: "Public web",
    unverified: "Unverified signal",
  }[value];
}
