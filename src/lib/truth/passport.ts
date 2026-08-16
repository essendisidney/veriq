import { normalizeVerdict, type ClaimRow } from "@/lib/claims/catalog";
import type { ClaimsAssessment } from "@/lib/claims/assess";
import type { IntegrityAssessment } from "@/lib/integrity/assess";
import type { TrustProfile } from "@/lib/truth/profile";
import { callFromPosture, type TrustCall } from "@/lib/truth/call";

export type PassportBand = "verified" | "partial" | "unknown" | "attention";

export type PassportDimension = {
  id: string;
  label: string;
  band: PassportBand;
  note: string;
};

export type CompanyPassport = {
  call: TrustCall;
  risk: number;
  evidence: number;
  confidence: number;
  dimensions: PassportDimension[];
  lastVerified: string | null;
  disclaimer: string;
};

function fromClaim(claims: ClaimRow[] | undefined, id: string): ClaimRow | undefined {
  return claims?.find((item) => item.id === id);
}

function bandFromClaim(row: ClaimRow | undefined): PassportDimension["band"] {
  if (!row) return "unknown";
  const verdict = normalizeVerdict(row.verdict);
  if (verdict === "verified" || verdict === "corroborated") return "verified";
  if (verdict === "contradicted") return "attention";
  if (verdict === "unverified") return "partial";
  return "unknown";
}

export function buildPassport(input: {
  trust?: TrustProfile | null;
  claims?: ClaimsAssessment | null;
  integrity?: IntegrityAssessment | null;
  websiteReachable?: boolean;
  lastVerified?: string | null;
  critical?: number;
}): CompanyPassport {
  const claims = input.claims?.claims;
  const directors = fromClaim(claims, "corporate-directors");
  const licence = fromClaim(claims, "licence-operator");
  const revenue = fromClaim(claims, "financial-revenue");
  const related = fromClaim(claims, "integrity-related");

  const identityBand: PassportBand = input.websiteReachable ? "partial" : "unknown";
  const ownershipUnknown = input.integrity?.unknown ?? 1;

  const dimensions: PassportDimension[] = [
    {
      id: "identity",
      label: "Identity",
      band: identityBand,
      note:
        identityBand === "partial"
          ? "Public website observed. A website is not a CR12."
          : "No public site observed.",
    },
    {
      id: "ownership",
      label: "Ownership",
      band: ownershipUnknown > 0 ? "unknown" : "partial",
      note: "Beneficial owners stay UNKNOWN until an official extract is in the vault. VERIQ does not scrape BRS.",
    },
    {
      id: "directors",
      label: "Directors",
      band: bandFromClaim(directors),
      note: directors?.why ?? "Director standing is a Companies Registry fact.",
    },
    {
      id: "licences",
      label: "Licences",
      band: bandFromClaim(licence),
      note: licence?.why ?? "Licence standing stays UNKNOWN without an artefact.",
    },
    {
      id: "financial",
      label: "Financial evidence",
      band: bandFromClaim(revenue),
      note: revenue?.why ?? "Amounts stay UNKNOWN. VERIQ will not invent KES figures.",
    },
    {
      id: "governance",
      label: "Governance / related parties",
      band: bandFromClaim(related),
      note: related?.why ?? "Related parties stay UNKNOWN until claimed or evidenced.",
    },
  ];

  const call = callFromPosture(input.trust?.posture ?? "insufficient_evidence", {
    contradicted: input.trust?.contradicted,
    critical: input.critical,
  });

  return {
    call,
    risk: input.trust?.risk ?? 0,
    evidence: input.trust?.evidence ?? 0,
    confidence: input.trust?.confidence ?? 0,
    dimensions,
    lastVerified: input.lastVerified ?? null,
    disclaimer:
      "A VERIQ Passport is a living evidence picture, not a certificate that the company is safe, licensed or creditworthy. Share it. Do not treat a green band as a KYB hit.",
  };
}

export const PASSPORT_BAND_LABELS: Record<PassportBand, string> = {
  verified: "Verified",
  partial: "Partial",
  unknown: "Unknown",
  attention: "Needs attention",
};
