import type { ClaimsAssessment } from "@/lib/claims/assess";
import { normalizeVerdict } from "@/lib/claims/catalog";
import type { IntegrityAssessment } from "@/lib/integrity/assess";

export type DecisionPosture =
  | "evidence_supports_decision"
  | "proceed_with_review"
  | "edd_required"
  | "insufficient_evidence";

export const DECISION_POSTURE_LABELS: Record<DecisionPosture, string> = {
  evidence_supports_decision: "Evidence supports a decision",
  proceed_with_review: "Proceed only with review",
  edd_required: "Do not proceed without EDD",
  insufficient_evidence: "Insufficient evidence to decide",
};

export type TrustMaterial = {
  title: string;
  why: string;
  href: string;
};

export type MissingEvidence = {
  title: string;
  need: string;
};

export type TrustProfile = {
  risk: number;
  evidence: number;
  confidence: number;
  posture: DecisionPosture;
  claimsTested: number;
  verified: number;
  corroborated: number;
  contradicted: number;
  unverified: number;
  unknown: number;
  inferences: number;
  requiresReview: number;
  material: TrustMaterial[];
  missing: MissingEvidence[];
  summary: string;
  disclaimer: string;
};

export function listMissingEvidence(claims?: ClaimsAssessment | null): MissingEvidence[] {
  return (claims?.claims ?? [])
    .filter((item) => {
      const verdict = normalizeVerdict(item.verdict);
      return (verdict === "unknown" || verdict === "unverified") && item.requiredDocument;
    })
    .map((item) => ({
      title: item.title,
      need: item.requiredDocument as string,
    }));
}

type RiskLike = {
  title: string;
  severity: string;
  fingerprint?: string;
  why_it_matters?: string | null;
  validation_status?: string | null;
  intelligence_stage?: string | null;
};

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function buildTrustProfile(input: {
  risk: number;
  claims?: ClaimsAssessment | null;
  integrity?: IntegrityAssessment | null;
  risks?: RiskLike[];
}): TrustProfile {
  const claims = input.claims?.claims ?? [];
  const verified = claims.filter((item) => normalizeVerdict(item.verdict) === "verified").length;
  const corroborated = claims.filter((item) => normalizeVerdict(item.verdict) === "corroborated").length;
  const contradicted = claims.filter((item) => normalizeVerdict(item.verdict) === "contradicted").length;
  const unverified = claims.filter((item) => normalizeVerdict(item.verdict) === "unverified").length;
  const unknown = claims.filter((item) => normalizeVerdict(item.verdict) === "unknown").length;
  const inferences = claims.filter((item) => item.inference).length;

  const pendingMaterial = (input.risks ?? []).filter(
    (item) =>
      (item.severity === "critical" || item.severity === "high") &&
      (item.validation_status ?? "pending") !== "disproved" &&
      (item.intelligence_stage ?? "finding") !== "signal",
  );
  const unknownRegisters = input.integrity?.unknown ?? 0;

  let evidence = 48;
  if (!claims.length) evidence = 22;
  evidence += corroborated * 14;
  evidence += verified * 8;
  evidence -= unverified * 7;
  evidence -= contradicted * 16;
  evidence -= unknown * 8;
  evidence -= inferences * 4;
  evidence -= Math.min(16, unknownRegisters * 2);
  evidence -= Math.min(20, pendingMaterial.length * 5);
  evidence = clamp(evidence);

  const contradictionPenalty = Math.min(80, contradicted * 28 + pendingMaterial.length * 8);
  let confidence = clamp(evidence * 0.72 + (100 - contradictionPenalty) * 0.28);
  if (evidence < 40) confidence = Math.min(confidence, 34);
  if (contradicted > 0) confidence = Math.min(confidence, 48);

  const requiresReview =
    contradicted +
    claims.filter((item) => item.validationRequired).length +
    pendingMaterial.length;

  let posture: DecisionPosture = "evidence_supports_decision";
  if (evidence < 40 || unknown === claims.length) posture = "insufficient_evidence";
  else if (contradicted > 0) posture = "edd_required";
  else if (evidence < 55 || pendingMaterial.length > 0) posture = "proceed_with_review";
  else if (unverified > 2) posture = "proceed_with_review";

  const material: TrustMaterial[] = [
    ...claims
      .filter((item) => {
        const verdict = normalizeVerdict(item.verdict);
        return verdict === "contradicted" || item.validationRequired;
      })
      .slice(0, 5)
      .map((item) => ({
        title: item.title,
        why: item.why,
        href: "/truth",
      })),
    ...pendingMaterial.slice(0, 4).map((item) => ({
      title: item.title,
      why: item.why_it_matters ?? "Open material finding.",
      href: "/findings",
    })),
  ].slice(0, 5);

  const missing = listMissingEvidence(input.claims);

  const summary =
    missing.length >= 3
      ? `The public story was read. ${missing.length} decision facts are still UNKNOWN — a website is not a CR12, a licence, directors, or cash. Missing evidence is the finding.`
      : evidence < 40
        ? `Risk ${input.risk}/100 does not mean the company is safe. Evidence quality is ${evidence}/100 — VERIQ does not have enough to say it is not risky.`
        : contradicted
          ? `The story and the evidence do not fully agree. Decision confidence ${confidence}%. This is not a finding of fraud.`
          : `Evidence quality ${evidence}/100 · decision confidence ${confidence}%. Every number is traceable to a claim, a finding, or an unknown.`;

  return {
    risk: input.risk,
    evidence,
    confidence,
    posture,
    claimsTested: claims.length,
    verified,
    corroborated,
    contradicted,
    unverified,
    unknown,
    inferences,
    requiresReview,
    material,
    missing,
    summary,
    disclaimer:
      "This is not a KYB clearance, credit rating, legal opinion or instruction to lend, invest, insure or award. No evidence = no conclusion.",
  };
}
