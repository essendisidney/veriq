import { crawlOrigin, peopleFromJsonLd, type CrawledPage } from "@/lib/crawler";
import { companyAliases } from "./aliases";
import { adjudicateClaims, extractRawClaims, type EvidenceHit } from "./claims";
import { extractPeople } from "./people";
import type { CrawlRecord, CrawlStatus, DiggerReport, SourceClass } from "./types";
import { EMPTY_DIGGER } from "./types";

function asStatus(status: CrawledPage["status"]): CrawlStatus {
  return status;
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

export type DiggerInput = {
  origin: string | null;
  homepageUrl: string | null;
  homepageHtml: string;
  storyHtml: string;
  storyText: string;
  storyPages: { url: string; kind: string }[];
  crawled?: CrawledPage[];
  crawlMeta?: {
    budgetUsed: number;
    budgetMax: number;
    summary: string;
    refused: { url: string; reason: string }[];
  };
  companyName: string;
  vault: { filename: string; kind: string; text: string | null }[];
  previousHashes: { url: string; content_hash: string }[];
};

export async function runDigger(input: DiggerInput): Promise<DiggerReport> {
  if (!input.origin || !input.homepageUrl) {
    return { ...EMPTY_DIGGER, summary: "No public origin to crawl under robots and budget." };
  }

  const originHost = new URL(input.origin).hostname;
  const prev = new Map(input.previousHashes.map((row) => [row.url, row.content_hash]));

  const crawl =
    input.crawled && input.crawled.length
      ? {
          pages: input.crawled,
          refused: input.crawlMeta?.refused ?? [],
          budgetUsed: input.crawlMeta?.budgetUsed ?? input.crawled.length,
          budgetMax: input.crawlMeta?.budgetMax ?? input.crawled.length,
          summary: input.crawlMeta?.summary ?? `Identified crawl of ${originHost}.`,
        }
      : await crawlOrigin({
          origin: input.origin,
          homepageUrl: input.homepageUrl,
          homepageHtml: input.homepageHtml,
        });

  const pages = crawl.pages.map((row) =>
    record({
      url: row.url,
      status: asStatus(row.status),
      contentType: row.contentType,
      contentHash: row.contentHash,
      excerpt: row.excerpt,
      sourceClass: "company_web",
      reason: row.reason,
      previous: prev.get(row.url) ?? null,
    }),
  );

  const hits: EvidenceHit[] = [];
  for (const row of crawl.pages) {
    if (row.status !== "fetched" || !row.text) continue;
    hits.push({
      url: row.url,
      excerpt: row.excerpt,
      sourceClass: "company_web",
      text: row.text,
    });
  }
  for (const doc of input.vault) {
    if (!doc.text) continue;
    hits.push({
      url: `vault:${doc.kind}:${doc.filename}`,
      excerpt: doc.text.slice(0, 800),
      sourceClass: "customer",
      text: doc.text,
    });
  }

  const people = [
    ...crawl.pages.flatMap((row) =>
      row.status === "fetched" && row.html
        ? [
            ...extractPeople(row.url, row.html),
            ...peopleFromJsonLd(row.html).map((person) => ({
              name: person.name,
              role: person.role,
              url: row.url,
              verdict: "unverified" as const,
              why: "Named in the company's JSON-LD. Not a CR12 director. LinkedIn is not scraped.",
            })),
          ]
        : [],
    ),
  ]
    .filter((row, i, all) => all.findIndex((item) => item.name === row.name) === i)
    .slice(0, 12);

  const claims = adjudicateClaims(extractRawClaims(hits));
  const changes = pages
    .filter((page) => page.changed)
    .map((page) => ({
      url: page.url,
      previousHash: prev.get(page.url) ?? "",
      currentHash: page.contentHash,
    }));

  const fetched = pages.filter((page) => page.status === "fetched").length;
  const unverified = claims.filter((item) => item.verdict === "unverified").length;
  const summary =
    unverified >= 1
      ? `${crawl.summary} ${fetched} fetched, ${claims.length} claim(s). Company copy is a claim, not a fact.`
      : `${crawl.summary} ${fetched} fetched. No marketing claims extracted. Missing evidence stays UNKNOWN.`;

  return {
    origin: input.origin,
    budgetUsed: crawl.budgetUsed,
    budgetMax: crawl.budgetMax,
    pages,
    refused: crawl.refused,
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
