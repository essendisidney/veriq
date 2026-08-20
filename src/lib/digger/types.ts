export const SOURCE_CLASSES = [
  "authoritative",
  "licensed",
  "customer",
  "company_web",
  "public_web",
  "unverified",
] as const;
export type SourceClass = (typeof SOURCE_CLASSES)[number];

export const SOURCE_CLASS_SCORE: Record<SourceClass, number> = {
  authoritative: 96,
  licensed: 90,
  customer: 88,
  company_web: 58,
  public_web: 52,
  unverified: 28,
};

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
export type CrawlStatus = (typeof CRAWL_STATUSES)[number];

export type CrawlRecord = {
  url: string;
  status: CrawlStatus;
  contentType: string;
  contentHash: string;
  excerpt: string;
  sourceClass: SourceClass;
  reason: string;
  changed: boolean | null;
};

export type DiggerClaimKind =
  | "customers"
  | "employees"
  | "revenue"
  | "licence"
  | "locations"
  | "partnerships"
  | "people";

export type DiggerClaim = {
  id: string;
  kind: DiggerClaimKind;
  claim: string;
  value: string;
  verdict: "unverified" | "corroborated" | "contradicted";
  confidence: number;
  sources: { url: string; excerpt: string; sourceClass: SourceClass }[];
  supporting: string[];
  contradicting: string[];
  why: string;
};

export type DiggerPerson = {
  name: string;
  role: string;
  url: string;
  verdict: "unverified";
  why: string;
};

export type DiggerReport = {
  origin: string | null;
  budgetUsed: number;
  budgetMax: number;
  pages: CrawlRecord[];
  refused: { url: string; reason: string }[];
  claims: DiggerClaim[];
  people: DiggerPerson[];
  aliases: string[];
  changes: { url: string; previousHash: string; currentHash: string }[];
  summary: string;
};

export const EMPTY_DIGGER: DiggerReport = {
  origin: null,
  budgetUsed: 0,
  budgetMax: 0,
  pages: [],
  refused: [],
  claims: [],
  people: [],
  aliases: [],
  changes: [],
  summary: "No permitted crawl ran.",
};
