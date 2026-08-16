import type { GithubScan, WebsiteScan } from "@/lib/scan/engine";
import type { Exposure } from "@/lib/scan/exposure";
import {
  controlName,
  regulationsFor,
  type ControlId,
  type EvidenceNeed,
  type RegulationDef,
} from "@/lib/regulations/ontology";
import type { RegulationAttestations } from "@/lib/regulations/attest";

export type EvidenceStatus = {
  key: string;
  label: string;
  control: ControlId;
  kind: EvidenceNeed["kind"];
  status: "present" | "gap" | "unknown";
  source?: string;
};

export type ControlStatus = {
  id: ControlId;
  name: string;
  status: "covered" | "gap" | "unknown";
};

export type RegulationAssessment = {
  code: string;
  name: string;
  jurisdiction: string;
  category: string;
  summary: string;
  impact: string;
  coverage: number;
  controls: ControlStatus[];
  evidence: EvidenceStatus[];
};

export type ObservedSignals = {
  https: boolean;
  tlsValid: boolean;
  hsts: boolean;
  securityHeaders: boolean;
  securityTxt: boolean;
  noPublicSecrets: boolean;
  githubConnected: boolean;
  websiteReachable: boolean;
};

export function collectSignals(input: {
  website: WebsiteScan | null;
  github: GithubScan | null;
  exposure: Exposure | null;
}): ObservedSignals {
  const headers = input.website?.securityHeaders ?? {};
  const missingHeaders = [
    "strict-transport-security",
    "content-security-policy",
    "x-frame-options",
    "x-content-type-options",
  ].filter((key) => !headers[key]);
  const publicSecrets = input.github?.repos.some((repo) => repo.sensitiveFiles.length) ?? false;

  return {
    https: Boolean(input.website?.https),
    tlsValid: (input.exposure?.tls?.daysRemaining ?? -1) > 14,
    hsts: Boolean(headers["strict-transport-security"]),
    securityHeaders: missingHeaders.length < 3,
    securityTxt: Boolean(input.exposure?.securityTxt),
    noPublicSecrets: input.github ? !publicSecrets : false,
    githubConnected: Boolean(input.github && !input.github.error),
    websiteReachable: Boolean(input.website?.reachable),
  };
}

function evaluateNeed(
  need: EvidenceNeed,
  signals: ObservedSignals,
  attested: Record<string, "unknown" | "yes" | "no"> | undefined,
): EvidenceStatus {
  if (need.kind === "attested") {
    const band = attested?.[need.key] ?? "unknown";
    if (band === "yes") {
      return { ...need, status: "present", source: "attested" };
    }
    if (band === "no") {
      return { ...need, status: "gap", source: "attested" };
    }
    return { ...need, status: "unknown" };
  }

  const map: Record<string, { ok: boolean; source: string }> = {
    https: { ok: signals.https, source: "website" },
    tls_valid: { ok: signals.tlsValid, source: "tls" },
    hsts: { ok: signals.hsts, source: "website" },
    security_headers: { ok: signals.securityHeaders, source: "website" },
    security_txt: { ok: signals.securityTxt, source: "website" },
    no_public_secrets: { ok: signals.noPublicSecrets, source: "github" },
  };

  const observed = map[need.key];
  if (!observed) return { ...need, status: "unknown" };
  return {
    ...need,
    status: observed.ok ? "present" : "gap",
    source: observed.source,
  };
}

function assessOne(
  def: RegulationDef,
  signals: ObservedSignals,
  attestations: RegulationAttestations,
): RegulationAssessment {
  const attested = attestations[def.code];
  const evidence = def.evidence.map((need) => evaluateNeed(need, signals, attested));
  const observable = evidence.filter((item) => item.kind === "observable");
  const declared = evidence.filter((item) => item.kind === "attested");
  const presentObs = observable.filter((item) => item.status === "present").length;
  const presentAtt = declared.filter((item) => item.status === "present").length;
  const coverage = observable.length
    ? Math.round((presentObs / observable.length) * 100)
    : declared.length
      ? Math.round((presentAtt / declared.length) * 100)
      : 0;

  const controls: ControlStatus[] = def.controls.map((id) => {
    const related = evidence.filter((item) => item.control === id);
    if (!related.length) return { id, name: controlName(id), status: "unknown" };
    if (related.some((item) => item.status === "gap")) {
      return { id, name: controlName(id), status: "gap" };
    }
    if (related.every((item) => item.status === "unknown")) {
      return { id, name: controlName(id), status: "unknown" };
    }
    return { id, name: controlName(id), status: "covered" };
  });

  return {
    code: def.code,
    name: def.name,
    jurisdiction: def.jurisdiction,
    category: def.category,
    summary: def.summary,
    impact: def.impact,
    coverage,
    controls,
    evidence,
  };
}

export function assessRegulations(input: {
  country: string;
  industry: string;
  website: WebsiteScan | null;
  github: GithubScan | null;
  exposure: Exposure | null;
  attestations?: RegulationAttestations;
}): RegulationAssessment[] {
  const signals = collectSignals(input);
  const attestations = input.attestations ?? {};
  return regulationsFor(input.country, input.industry).map((def) =>
    assessOne(def, signals, attestations),
  );
}
