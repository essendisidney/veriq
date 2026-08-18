export const MONEY_METRICS = [
  "revenue",
  "inflows",
  "payroll",
  "profit",
  "assets",
  "expenses",
] as const;
export type MoneyMetric = (typeof MONEY_METRICS)[number];

export type ExtractedAmount = {
  metric: MoneyMetric;
  amountMinor: number;
  currency: "KES";
  excerpt: string;
  sourceKind: string;
  filename: string;
  periodStart?: string;
  periodEnd?: string;
};

const METRIC_PATTERNS: { metric: MoneyMetric; re: RegExp }[] = [
  { metric: "revenue", re: /(?:revenue|turnover|sales)\b/i },
  { metric: "inflows", re: /(?:bank\s+(?:inflows?|credits?|deposits?)|identifiable\s+operating\s+inflows?)\b/i },
  { metric: "payroll", re: /(?:payroll|staff\s+costs?|salaries)\b/i },
  { metric: "profit", re: /(?:net\s+profit|profit\s+after\s+tax|ebitda)\b/i },
  { metric: "assets", re: /(?:total\s+assets|fixed\s+assets)\b/i },
  { metric: "expenses", re: /(?:operating\s+expenses?|opex|expenditure)\b/i },
];

const AMOUNT_RE =
  /(?:KES|KSh|Ksh|Kenya\s+Shillings?)?\s*([\d]{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*(million|millions|mn|m|billion|bn|b)?/gi;

function kindDefault(kind: string): MoneyMetric | null {
  if (kind === "bank_statement") return "inflows";
  if (
    kind === "accounts" ||
    kind === "management_accounts" ||
    kind === "audited_accounts" ||
    kind === "tax_return"
  ) {
    return "revenue";
  }
  if (kind === "payroll") return "payroll";
  if (kind === "invoices") return "revenue";
  return null;
}

function extractPeriod(text: string, window: string): { start?: string; end?: string } {
  const hay = `${window} ${text.slice(0, 800)}`;
  const fy = hay.match(/FY\s*(20\d{2})/i);
  if (fy) return { start: `${fy[1]}-01-01`, end: `${fy[1]}-12-31` };
  const span = hay.match(/\b(20\d{2})\s*[-–\/]\s*(20\d{2})\b/);
  if (span) return { start: `${span[1]}-01-01`, end: `${span[2]}-12-31` };
  const year = hay.match(/\b(20\d{2})\b/);
  if (year) return { start: `${year[1]}-01-01`, end: `${year[1]}-12-31` };
  return {};
}

function toMinor(raw: string, suffix: string | undefined): number | null {
  const n = Number(raw.replace(/,/g, ""));
  if (!Number.isFinite(n) || n <= 0) return null;
  const s = (suffix ?? "").toLowerCase();
  let kes = n;
  if (s.startsWith("b")) kes = n * 1_000_000_000;
  else if (s.startsWith("m")) kes = n * 1_000_000;
  if (kes < 1_000) return null;
  return Math.round(kes * 100);
}

function metricNear(window: string, kind: string): MoneyMetric | null {
  for (const row of METRIC_PATTERNS) {
    if (row.re.test(window)) return row.metric;
  }
  return kindDefault(kind);
}

/** Pull labelled KES amounts from a text layer. Scanned PDFs yield nothing — not OCR. */
export function extractAmounts(
  text: string | null | undefined,
  kind: string,
  filename: string,
): ExtractedAmount[] {
  if (!text || text.length < 20) return [];
  const found: ExtractedAmount[] = [];
  const seen = new Set<string>();
  const re = new RegExp(AMOUNT_RE.source, "gi");
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    const index = match.index ?? 0;
    const window = text.slice(Math.max(0, index - 80), index + match[0].length + 40);
    const metric = metricNear(window, kind);
    if (!metric) continue;
    const amountMinor = toMinor(match[1], match[2]);
    if (amountMinor == null) continue;
    const key = `${metric}:${amountMinor}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const period = extractPeriod(text, window);
    found.push({
      metric,
      amountMinor,
      currency: "KES",
      excerpt: window.replace(/\s+/g, " ").trim().slice(0, 240),
      sourceKind: kind,
      filename,
      periodStart: period.start,
      periodEnd: period.end,
    });
  }
  return found.slice(0, 12);
}

export function formatKes(amountMinor: number) {
  const kes = amountMinor / 100;
  if (kes >= 1_000_000) return `KES ${(kes / 1_000_000).toFixed(1)}M`;
  if (kes >= 1_000) return `KES ${Math.round(kes).toLocaleString("en-KE")}`;
  return `KES ${kes.toFixed(2)}`;
}

export function variancePct(leftMinor: number, rightMinor: number) {
  const max = Math.max(leftMinor, rightMinor);
  if (max <= 0) return 0;
  return Math.round((Math.abs(leftMinor - rightMinor) / max) * 1000) / 10;
}
