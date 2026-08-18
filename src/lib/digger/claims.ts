import { normalizeName } from "@/lib/acquire/entity";
import type { ClaimVerdict } from "@/lib/claims/catalog";
import type { DiggerClaim, DiggerClaimKind, SourceClass } from "./types";
import { SOURCE_CLASS_SCORE } from "./types";

export type EvidenceHit = {
  url: string;
  excerpt: string;
  sourceClass: SourceClass;
  text: string;
};

const PATTERNS: { kind: DiggerClaimKind; re: RegExp; label: (m: RegExpMatchArray) => string }[] = [
  {
    kind: "customers",
    re: /\b(\d[\d,]{2,}|[\d,]+)\+?\s*(customers|clients|merchants|users)\b/gi,
    label: (m) => `${m[1]} ${m[2]}`,
  },
  {
    kind: "employees",
    re: /\b(\d{1,5})\s*(?:\+|plus)?\s*(employees|staff|people|team members)\b/gi,
    label: (m) => `${m[1]} ${m[2]}`,
  },
  {
    kind: "revenue",
    re: /\b(annual revenue|turnover of|ksh|kes)\s*([\d,.]+(?:\s*(?:million|billion|m|bn))?)/gi,
    label: (m) => `${m[1]} ${m[2]}`.trim(),
  },
  {
    kind: "licence",
    re: /\b(licensed by|regulated by|cbk[- ]licensed|cma[- ]licensed|ira[- ]licensed|payment service provider|authorised dealer)\b/gi,
    label: (m) => m[0],
  },
  {
    kind: "locations",
    re: /\b(offices in|operating in|presence in|nairobi|mombasa|kisumu|kampala|dar es salaam|across africa|east africa)\b[^.!?]{0,80}/gi,
    label: (m) => m[0].trim(),
  },
  {
    kind: "partnerships",
    re: /\b(in partnership with|partnered with|powered by|backed by)\s+([A-Z][\w&.\- ]{2,40})/g,
    label: (m) => `${m[1]} ${m[2]}`.trim(),
  },
];

function excerptAround(text: string, match: string) {
  const i = text.toLowerCase().indexOf(match.toLowerCase());
  if (i < 0) return match.slice(0, 220);
  return text.slice(Math.max(0, i - 80), i + match.length + 80).replace(/\s+/g, " ").trim();
}

export function extractRawClaims(hits: EvidenceHit[]) {
  const found: {
    kind: DiggerClaimKind;
    value: string;
    url: string;
    excerpt: string;
    sourceClass: SourceClass;
  }[] = [];
  for (const hit of hits) {
    for (const pattern of PATTERNS) {
      const re = new RegExp(pattern.re.source, pattern.re.flags);
      let match: RegExpExecArray | null;
      while ((match = re.exec(hit.text))) {
        const value = pattern.label(match).replace(/\s+/g, " ").trim();
        if (value.length < 4) continue;
        found.push({
          kind: pattern.kind,
          value,
          url: hit.url,
          excerpt: excerptAround(hit.text, match[0]),
          sourceClass: hit.sourceClass,
        });
      }
    }
  }
  return found;
}

function numericCore(value: string) {
  const n = value.replace(/,/g, "").match(/(\d+(?:\.\d+)?)/);
  return n ? Number(n[1]) : null;
}

function sameKindConflict(a: string, b: string) {
  const left = numericCore(a);
  const right = numericCore(b);
  if (left == null || right == null || left === 0 || right === 0) {
    return normalizeName(a) !== normalizeName(b) && a.toLowerCase() !== b.toLowerCase();
  }
  const ratio = Math.max(left, right) / Math.min(left, right);
  return ratio >= 2;
}

export function adjudicateClaims(
  raw: ReturnType<typeof extractRawClaims>,
): DiggerClaim[] {
  const groups = new Map<string, typeof raw>();
  for (const row of raw) {
    const key = `${row.kind}:${normalizeName(row.value).slice(0, 40) || row.value.toLowerCase()}`;
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }

  const claims: DiggerClaim[] = [];
  for (const [key, rows] of groups) {
    const classes = new Set(rows.map((row) => row.sourceClass));
    const independent = [...classes].filter((item) => item !== "company_web" && item !== "unverified");
    const companyOnly = classes.size === 1 && classes.has("company_web");

    const peers = raw.filter((row) => row.kind === rows[0]!.kind && !rows.includes(row));
    const conflicts = peers.filter((row) => sameKindConflict(row.value, rows[0]!.value));
    const independentConflict = conflicts.some(
      (row) => row.sourceClass !== "company_web" && row.sourceClass !== rows[0]!.sourceClass,
    );

    let verdict: DiggerClaim["verdict"] = "unverified";
    if (independentConflict) verdict = "contradicted";
    else if (independent.length >= 1 && (classes.has("company_web") || classes.has("customer"))) {
      verdict = "corroborated";
    } else if (companyOnly) verdict = "unverified";

    const best = Math.max(...rows.map((row) => SOURCE_CLASS_SCORE[row.sourceClass]));
    const why =
      verdict === "contradicted"
        ? "An independent permitted source disagrees. Both observations are kept."
        : verdict === "corroborated"
          ? "More than one independent permitted source class supports this claim."
          : "This is a company claim from the public site or a single source class. It is not a fact.";

    claims.push({
      id: `dig:${key}`,
      kind: rows[0]!.kind,
      claim: rows[0]!.value,
      value: rows[0]!.value,
      verdict,
      confidence: verdict === "corroborated" ? Math.min(88, best + 12) : verdict === "contradicted" ? 72 : Math.min(best, 62),
      sources: rows.slice(0, 4).map((row) => ({
        url: row.url,
        excerpt: row.excerpt,
        sourceClass: row.sourceClass,
      })),
      supporting: rows.filter((row) => !conflicts.includes(row)).map((row) => row.url).slice(0, 4),
      contradicting: conflicts.map((row) => `${row.value} (${row.url})`).slice(0, 4),
      why,
    });
  }

  return claims.slice(0, 24);
}

export function claimToLedgerVerdict(verdict: DiggerClaim["verdict"]): ClaimVerdict {
  return verdict;
}
