export type GovernanceFinding = {
  id: string;
  title: string;
  why: string;
  status: "requires_validation" | "missing_evidence" | "observed";
};

export type GovernanceAssessment = {
  score: number | null;
  findings: GovernanceFinding[];
  missing: string[];
  relatedPartyCount: number;
  summary: string;
};

const GOVERNANCE_DOCS = [
  { kind: "cr12", label: "CR12 / company extract" },
  { kind: "company_extract", label: "Official company extract" },
  { kind: "policy", label: "Policy or board paper" },
  { kind: "board_minutes", label: "Board minutes" },
  { kind: "contract", label: "Material contract" },
  { kind: "licence", label: "Licence or permit" },
] as const;

export function assessGovernance(input: {
  documentKinds: string[];
  relatedPartyEdges: number;
  peopleNamed: number;
  ownershipConfidence: number;
  directorsParsed?: number;
}): GovernanceAssessment {
  const kinds = new Set(input.documentKinds);
  const hasOwnership = kinds.has("cr12") || kinds.has("company_extract");
  const hasPolicy = kinds.has("policy") || kinds.has("board_minutes");
  const hasLicence = kinds.has("licence");
  const directorsParsed = input.directorsParsed ?? 0;

  const findings: GovernanceFinding[] = [];
  const missing: string[] = [];

  for (const row of GOVERNANCE_DOCS) {
    if (!kinds.has(row.kind)) {
      if (row.kind === "company_extract" && kinds.has("cr12")) continue;
      if (row.kind === "board_minutes" && kinds.has("policy")) continue;
      missing.push(row.label);
    }
  }

  if (hasOwnership) {
    findings.push({
      id: "ownership-artefact",
      title: "Ownership extract on file",
      why: directorsParsed
        ? `Customer-uploaded CR12 / extract. ${directorsParsed} director name(s) parsed from the text layer — confirm against the file. Not a BRS scrape.`
        : "Customer-uploaded CR12 / extract. No director names parsed from the text layer yet. Not a BRS scrape.",
      status: "observed",
    });
  } else {
    findings.push({
      id: "ownership-missing",
      title: "No ownership extract",
      why: "Upload a CR12 or company extract. VERIQ will not scrape BRS or invent a cap table.",
      status: "missing_evidence",
    });
  }

  if (input.relatedPartyEdges > 0) {
    findings.push({
      id: "related-party",
      title: `${input.relatedPartyEdges} possible related-party edge${input.relatedPartyEdges === 1 ? "" : "s"}`,
      why: "Shared name on the website and in a vault artefact. Requires human validation — not an accusation.",
      status: "requires_validation",
    });
  }

  if (input.peopleNamed > 0 && !hasOwnership) {
    findings.push({
      id: "people-unverified",
      title: `${input.peopleNamed} people named on the public site`,
      why: "Website people are unverified. They are not CR12 directors until an ownership extract is uploaded.",
      status: "requires_validation",
    });
  }

  if (!hasPolicy) {
    findings.push({
      id: "policy-missing",
      title: "No board / policy artefact",
      why: "Upload board minutes or a policy paper if governance controls must be evidenced.",
      status: "missing_evidence",
    });
  }

  if (!hasLicence) {
    findings.push({
      id: "licence-unknown",
      title: "Licence standing UNKNOWN",
      why: "No licence artefact uploaded. Regulator portals are not scraped.",
      status: "missing_evidence",
    });
  }

  let score: number | null = null;
  if (hasOwnership || hasPolicy || input.ownershipConfidence >= 40) {
    score = 62;
    if (hasOwnership) score += 12;
    if (hasPolicy) score += 8;
    if (hasLicence) score += 6;
    if (input.relatedPartyEdges > 0) score -= 10;
    if (missing.length >= 4) score -= 8;
    score = Math.max(28, Math.min(88, score));
  }

  const summary =
    score == null
      ? "Governance stays UNKNOWN until an ownership extract or board artefact is uploaded."
      : `Governance ${score}/100 from authorised artefacts. ${input.relatedPartyEdges} related-party edge${input.relatedPartyEdges === 1 ? "" : "s"} require validation. ${missing.length} document gap${missing.length === 1 ? "" : "s"} remain.`;

  return {
    score,
    findings,
    missing: missing.slice(0, 8),
    relatedPartyCount: input.relatedPartyEdges,
    summary,
  };
}
