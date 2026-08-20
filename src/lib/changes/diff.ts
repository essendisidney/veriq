import type { AssetCriticality, Severity } from "@/lib/database.types";
import type { AiAssessment } from "@/lib/ai/assess";
import type { RegulationAssessment } from "@/lib/regulations/assess";
import type { Exposure } from "@/lib/scan/exposure";
import type { VendorMap } from "@/lib/vendors/assess";

export type ChangePolarity = "added" | "removed" | "changed";

export type ChangeKind =
  | "vendor"
  | "repository"
  | "domain"
  | "dependency"
  | "finding"
  | "regulation"
  | "ai"
  | "exposure"
  | "score"
  | "conflict"
  | "people"
  | "ownership";

export type ChangeItem = {
  id: string;
  kind: ChangeKind;
  polarity: ChangePolarity;
  title: string;
  detail: string;
  href?: string;
  severity?: Severity;
  notify: boolean;
};

export type ChangeSet = {
  previousScanId: string | null;
  summary: string;
  added: number;
  removed: number;
  changed: number;
  items: ChangeItem[];
};

export type SnapshotFinding = {
  fingerprint: string;
  title: string;
  severity: Severity;
};

export type ScanSnapshot = {
  website: string | null;
  github: string | null;
  overall: number | null;
  hostnames: string[];
  repos: string[];
  packages: string[];
  vendors: string[];
  regulations: string[];
  ai: string[];
  findings: SnapshotFinding[];
  exposure: {
    httpsRedirect: boolean | null;
    spf: boolean;
    dmarc: boolean;
    tlsDays: number | null;
  } | null;
  conflictClaims?: string[];
  people?: string[];
  ownershipPresent?: boolean;
  relatedPartyCount?: number;
  partial?: boolean;
};

export type ScanSummarySlice = {
  website?: string | null;
  github?: string | null;
  overall?: number;
  vendors?: VendorMap;
  regulatory?: RegulationAssessment[];
  ai?: AiAssessment;
  exposure?: Exposure | null;
  snapshot?: ScanSnapshot;
  changes?: ChangeSet;
};

const KIND_HREF: Record<ChangeKind, string> = {
  vendor: "/vendors",
  repository: "/repositories",
  domain: "/technology",
  dependency: "/repositories",
  finding: "/findings",
  regulation: "/regulations",
  ai: "/ai",
  exposure: "/technology",
  score: "/dashboard",
  conflict: "/coverage",
  people: "/graph",
  ownership: "/truth",
};

export function emptySnapshot(): ScanSnapshot {
  return {
    website: null,
    github: null,
    overall: null,
    hostnames: [],
    repos: [],
    packages: [],
    vendors: [],
    regulations: [],
    ai: [],
    findings: [],
    exposure: null,
    conflictClaims: [],
    people: [],
    ownershipPresent: false,
    relatedPartyCount: 0,
  };
}

export function buildSnapshot(input: {
  website: string | null;
  github: string | null;
  overall: number | null;
  repos: string[];
  packages: string[];
  vendors: VendorMap | null;
  regulations: RegulationAssessment[];
  ai: AiAssessment | null;
  exposure: Exposure | null;
  findings: SnapshotFinding[];
  conflictClaims?: string[];
  people?: string[];
  ownershipPresent?: boolean;
  relatedPartyCount?: number;
}): ScanSnapshot {
  return {
    website: input.website,
    github: input.github,
    overall: input.overall,
    hostnames: unique(input.exposure?.hostnames ?? (input.website ? [input.website] : [])),
    repos: unique(input.repos),
    packages: unique(input.packages),
    vendors: unique((input.vendors?.vendors ?? []).map((item) => item.name)),
    regulations: unique(input.regulations.map((item) => item.code)),
    ai: unique((input.ai?.systems ?? []).map((item) => item.name)),
    findings: input.findings,
    exposure: input.exposure
      ? {
          httpsRedirect: input.exposure.httpsRedirect,
          spf: input.exposure.spf,
          dmarc: input.exposure.dmarc,
          tlsDays: input.exposure.tls?.daysRemaining ?? null,
        }
      : null,
    conflictClaims: unique(input.conflictClaims ?? []),
    people: unique(input.people ?? []),
    ownershipPresent: Boolean(input.ownershipPresent),
    relatedPartyCount: input.relatedPartyCount ?? 0,
  };
}

export function snapshotFromSummary(
  summary: ScanSummarySlice | null | undefined,
  findings: SnapshotFinding[] = [],
): ScanSnapshot {
  if (summary?.snapshot) {
    return {
      ...summary.snapshot,
      findings: summary.snapshot.findings.length ? summary.snapshot.findings : findings,
    };
  }
  if (!summary) {
    return { ...emptySnapshot(), findings };
  }
  return {
    ...buildSnapshot({
      website: summary.website ?? null,
      github: summary.github ?? null,
      overall: summary.overall ?? null,
      repos: [],
      packages: [],
      vendors: summary.vendors ?? null,
      regulations: summary.regulatory ?? [],
      ai: summary.ai ?? null,
      exposure: summary.exposure ?? null,
      findings,
    }),
    partial: true,
  };
}

export function diffSnapshots(input: {
  previousScanId: string | null;
  previous: ScanSnapshot | null;
  current: ScanSnapshot;
}): ChangeSet {
  if (!input.previous) {
    return {
      previousScanId: null,
      summary: "Baseline snapshot. A second scan will show what changed.",
      added: 0,
      removed: 0,
      changed: 0,
      items: [],
    };
  }

  const items: ChangeItem[] = [];
  pushSet(items, "vendor", input.previous.vendors, input.current.vendors, "vendor");
  pushSet(items, "domain", input.previous.hostnames, input.current.hostnames, "hostname");
  pushSet(items, "regulation", input.previous.regulations, input.current.regulations, "regulation");
  pushSet(items, "ai", input.previous.ai, input.current.ai, "AI system");
  if (!input.previous.partial) {
    pushSet(items, "repository", input.previous.repos, input.current.repos, "repository");
  }

  const prevPkgs = new Set(input.previous.packages);
  const newPkgs = input.previous.partial
    ? []
    : input.current.packages.filter((item) => !prevPkgs.has(item));
  const gonePkgs = input.previous.partial
    ? []
    : input.previous.packages.filter((item) => !input.current.packages.includes(item));
  if (newPkgs.length) {
    items.push(
      item({
        kind: "dependency",
        polarity: "added",
        title: `${newPkgs.length} new dependenc${newPkgs.length === 1 ? "y" : "ies"}`,
        detail: newPkgs.slice(0, 8).join(", "),
        notify: newPkgs.length >= 3,
      }),
    );
  }
  if (gonePkgs.length) {
    items.push(
      item({
        kind: "dependency",
        polarity: "removed",
        title: `${gonePkgs.length} dependenc${gonePkgs.length === 1 ? "y" : "ies"} no longer observed`,
        detail: gonePkgs.slice(0, 8).join(", "),
        notify: false,
      }),
    );
  }

  const prevFindings = new Map(input.previous.findings.map((row) => [row.fingerprint, row]));
  const nextFindings = new Map(input.current.findings.map((row) => [row.fingerprint, row]));
  for (const finding of input.current.findings) {
    if (prevFindings.has(finding.fingerprint)) continue;
    const severe = finding.severity === "critical" || finding.severity === "high";
    items.push(
      item({
        kind: "finding",
        polarity: "added",
        title: `New finding: ${finding.title}`,
        detail: finding.severity,
        href: "/findings",
        severity: finding.severity,
        notify: severe,
      }),
    );
  }
  for (const finding of input.previous.findings) {
    if (nextFindings.has(finding.fingerprint)) continue;
    items.push(
      item({
        kind: "finding",
        polarity: "removed",
        title: `Resolved: ${finding.title}`,
        detail: "No longer observed on this scan",
        href: "/findings",
        severity: finding.severity,
        notify: true,
      }),
    );
  }

  if (input.previous.website !== input.current.website && (input.previous.website || input.current.website)) {
    items.push(
      item({
        kind: "domain",
        polarity: input.current.website ? "changed" : "removed",
        title: input.current.website
          ? `Primary website is now ${input.current.website}`
          : "Primary website is no longer observed",
        detail: input.previous.website
          ? `Was ${input.previous.website}`
          : "No previous hostname",
        notify: true,
      }),
    );
  }

  pushSet(
    items,
    "conflict",
    input.previous.conflictClaims ?? [],
    input.current.conflictClaims ?? [],
    "contradiction",
  );
  pushSet(items, "people", input.previous.people ?? [], input.current.people ?? [], "named person");

  const prevOwn = Boolean(input.previous.ownershipPresent);
  const nextOwn = Boolean(input.current.ownershipPresent);
  if (prevOwn !== nextOwn) {
    items.push(
      item({
        kind: "ownership",
        polarity: nextOwn ? "added" : "removed",
        title: nextOwn
          ? "Ownership extract now on file"
          : "Ownership extract no longer on file",
        detail: "CR12 / company extract presence changed between scans",
        notify: true,
      }),
    );
  }
  const prevRp = input.previous.relatedPartyCount ?? 0;
  const nextRp = input.current.relatedPartyCount ?? 0;
  if (nextRp > prevRp) {
    items.push(
      item({
        kind: "people",
        polarity: "added",
        title: `${nextRp - prevRp} new related-party edge${nextRp - prevRp === 1 ? "" : "s"}`,
        detail: "Requires human validation — not an accusation",
        notify: true,
        severity: "medium",
      }),
    );
  }

  const prevExp = input.previous.exposure;
  const nextExp = input.current.exposure;
  if (prevExp && nextExp) {
    if (prevExp.httpsRedirect === true && nextExp.httpsRedirect === false) {
      items.push(
        item({
          kind: "exposure",
          polarity: "changed",
          title: "HTTP no longer redirects to HTTPS",
          detail: "Transport protection on the public site weakened",
          notify: true,
          severity: "high",
        }),
      );
    }
    if (prevExp.spf && !nextExp.spf) {
      items.push(
        item({
          kind: "exposure",
          polarity: "removed",
          title: "SPF record no longer observed",
          detail: "Email authentication weakened",
          notify: true,
          severity: "medium",
        }),
      );
    }
    if (prevExp.dmarc && !nextExp.dmarc) {
      items.push(
        item({
          kind: "exposure",
          polarity: "removed",
          title: "DMARC record no longer observed",
          detail: "Email authentication weakened",
          notify: true,
          severity: "medium",
        }),
      );
    }
    if (
      prevExp.tlsDays != null &&
      nextExp.tlsDays != null &&
      nextExp.tlsDays <= 21 &&
      nextExp.tlsDays < prevExp.tlsDays
    ) {
      items.push(
        item({
          kind: "exposure",
          polarity: "changed",
          title: `TLS certificate has ${nextExp.tlsDays} days remaining`,
          detail: `Was ${prevExp.tlsDays} days`,
          notify: true,
          severity: nextExp.tlsDays <= 7 ? "high" : "medium",
        }),
      );
    }
  }

  if (input.previous.overall != null && input.current.overall != null) {
    const delta = input.current.overall - input.previous.overall;
    if (delta !== 0) {
      items.push(
        item({
          kind: "score",
          polarity: "changed",
          title: `VERIQ Score ${delta > 0 ? "up" : "down"} ${Math.abs(delta)}`,
          detail: `${input.previous.overall} → ${input.current.overall}`,
          notify: delta <= -5,
          severity: delta <= -10 ? "high" : delta < 0 ? "medium" : "low",
        }),
      );
    }
  }

  const added = items.filter((row) => row.polarity === "added").length;
  const removed = items.filter((row) => row.polarity === "removed").length;
  const changed = items.filter((row) => row.polarity === "changed").length;
  const summary = items.length
    ? `${added} added, ${removed} removed, ${changed} changed since the previous scan.`
    : "No material change versus the previous scan.";

  return {
    previousScanId: input.previousScanId,
    summary,
    added,
    removed,
    changed,
    items,
  };
}

export function significantChanges(changes: ChangeSet, limit = 8): ChangeItem[] {
  return changes.items.filter((row) => row.notify).slice(0, limit);
}

export function criticalityFor(item: ChangeItem): AssetCriticality {
  if (item.severity === "critical") return "critical";
  if (item.severity === "high" || item.kind === "vendor" || item.kind === "ai") return "high";
  if (item.kind === "conflict" || item.kind === "ownership") return "high";
  if (item.severity === "medium" || item.kind === "finding" || item.kind === "people") return "medium";
  return "low";
}

function pushSet(
  items: ChangeItem[],
  kind: ChangeKind,
  previous: string[],
  current: string[],
  noun: string,
) {
  const prev = new Set(previous);
  const next = new Set(current);
  for (const value of current) {
    if (prev.has(value)) continue;
    items.push(
      item({
        kind,
        polarity: "added",
        title: `New ${noun}: ${value}`,
        detail: "Observed on this scan, not on the previous snapshot",
        notify: kind !== "domain" || current.length - previous.length <= 6,
      }),
    );
  }
  for (const value of previous) {
    if (next.has(value)) continue;
    items.push(
      item({
        kind,
        polarity: "removed",
        title: `${noun[0]!.toUpperCase()}${noun.slice(1)} no longer observed: ${value}`,
        detail: "Present on the previous snapshot, absent now",
        notify: kind === "vendor" || kind === "repository" || kind === "ai",
      }),
    );
  }
}

function item(input: Omit<ChangeItem, "id" | "href"> & { href?: string }): ChangeItem {
  return {
    ...input,
    href: input.href ?? KIND_HREF[input.kind],
    id: `${input.kind}:${input.polarity}:${slug(input.title)}`,
  };
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}
