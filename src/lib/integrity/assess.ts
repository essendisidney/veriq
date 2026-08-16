import type { TrustStatus } from "@/lib/database.types";
import type { AiAssessment } from "@/lib/ai/assess";
import type { FinanceAssessment } from "@/lib/finance/assess";
import type { RegulationAssessment } from "@/lib/regulations/assess";
import type { VendorMap } from "@/lib/vendors/assess";
import {
  INTEGRITY_CATALOG,
  INTEGRITY_KIND_LABELS,
  type IntegrityDef,
  type IntegrityKind,
  type IntegrityStatus,
} from "@/lib/integrity/catalog";
import { listContradictions } from "@/lib/integrity/contradictions";

export type IntegrityRecord = {
  id: string;
  title: string;
  kind: IntegrityKind;
  status: IntegrityStatus;
  summary: string;
  reason: string;
  source: string;
  sourceUrl: string | null;
  trustStatus: TrustStatus;
};

export type IntegrityAssessment = {
  records: IntegrityRecord[];
  contradictions: { fingerprint: string; title: string }[];
  observed: number;
  unknown: number;
  watch: number;
  summary: string;
};

export { INTEGRITY_KIND_LABELS };

function applies(def: IntegrityDef, country: string, industry: string) {
  const jurisdiction =
    def.jurisdictions === "*" || def.jurisdictions.includes(country);
  const industries =
    def.industries === "*" || def.industries.includes(industry);
  return jurisdiction && industries;
}

export function assessIntegrity(input: {
  country: string;
  industry: string;
  privacyPolicyUrl: string | null;
  privacyPolicyExcerpt: string | null;
  githubConnected: boolean;
  relatedOrgs: string[];
  vendors: VendorMap | null;
  ai: AiAssessment | null;
  finance: FinanceAssessment | null;
  assessments: RegulationAssessment[];
}): IntegrityAssessment {
  const contradictions = listContradictions({
    privacyPolicyUrl: input.privacyPolicyUrl,
    privacyPolicyExcerpt: input.privacyPolicyExcerpt,
    vendors: input.vendors,
    ai: input.ai,
    finance: input.finance,
  });

  const records: IntegrityRecord[] = [];
  for (const def of INTEGRITY_CATALOG) {
    if (!applies(def, input.country, input.industry)) continue;
    records.push(recordFor(def, input));
  }

  const observed = records.filter((item) => item.status === "observed").length;
  const unknown = records.filter((item) => item.status === "unknown").length;
  const watch = records.filter((item) => item.status === "watch").length;
  const contradictionCount = contradictions.length;

  const summary = contradictionCount
    ? `${contradictionCount} contradiction${contradictionCount === 1 ? "" : "s"} between what was said and what was observed. Public registers that VERIQ cannot fetch stay UNKNOWN — not invented.`
    : observed
      ? `${observed} public fact${observed === 1 ? "" : "s"} observed on the company surface. ${unknown} register${unknown === 1 ? "" : "s"} remain UNKNOWN because they are not a public API VERIQ can query.`
      : `${unknown} public-record check${unknown === 1 ? "" : "s"} UNKNOWN. ${watch} standing integrity regime${watch === 1 ? "" : "s"} on watch. VERIQ will not invent a shell company, an unlicensed rail, or corruption.`;

  return {
    records,
    contradictions: contradictions.map((item) => ({
      fingerprint: item.fingerprint,
      title: item.title,
    })),
    observed,
    unknown,
    watch,
    summary,
  };
}

function recordFor(
  def: IntegrityDef,
  input: {
    privacyPolicyUrl: string | null;
    githubConnected: boolean;
    relatedOrgs: string[];
    assessments: RegulationAssessment[];
  },
): IntegrityRecord {
  if (def.observe === "privacyNotice") {
    if (input.privacyPolicyUrl) {
      return {
        id: def.id,
        title: def.title,
        kind: def.kind,
        status: "observed",
        summary: def.summary,
        reason: `Privacy notice observed at ${input.privacyPolicyUrl}.`,
        source: def.source,
        sourceUrl: input.privacyPolicyUrl,
        trustStatus: "observed",
      };
    }
    return {
      id: def.id,
      title: def.title,
      kind: def.kind,
      status: "unknown",
      summary: def.summary,
      reason: "No privacy notice was observed on the company domain.",
      source: def.source,
      sourceUrl: def.sourceUrl,
      trustStatus: "unknown",
    };
  }

  if (def.observe === "githubConnected") {
    if (input.githubConnected) {
      const orgs = input.relatedOrgs;
      return {
        id: def.id,
        title: def.title,
        kind: def.kind,
        status: "observed",
        summary: def.summary,
        reason: orgs.length
          ? `Connected identity belongs to: ${orgs.join(", ")}.`
          : "GitHub was connected. No sibling organisations were returned for this identity.",
        source: def.source,
        sourceUrl: def.sourceUrl,
        trustStatus: "observed",
      };
    }
    return {
      id: def.id,
      title: def.title,
      kind: def.kind,
      status: "unknown",
      summary: def.summary,
      reason:
        "GitHub is not connected. Private repositories and org membership were not observed. A public username is a demo.",
      source: def.source,
      sourceUrl: def.sourceUrl,
      trustStatus: "unknown",
    };
  }

  if (def.id === "ke-aceca-standing") {
    const mapped = input.assessments.some((item) => item.code === "KE-ACECA");
    return {
      id: def.id,
      title: def.title,
      kind: def.kind,
      status: "watch",
      summary: def.summary,
      reason: mapped
        ? "ACECA is mapped. Conflict, gifts and procurement artefacts stay UNKNOWN until attested. This is not an allegation."
        : "ACECA is a standing public condition in Kenya. VERIQ will not invent that this company or any person is implicated.",
      source: def.source,
      sourceUrl: def.sourceUrl,
      trustStatus: "inferred",
    };
  }

  return {
    id: def.id,
    title: def.title,
    kind: def.kind,
    status: "unknown",
    summary: def.summary,
    reason: `${def.source} is not a public API VERIQ can query. Status stays UNKNOWN. Attestation is for what is not public.`,
    source: def.source,
    sourceUrl: def.sourceUrl,
    trustStatus: "unknown",
  };
}
