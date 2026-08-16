import type {
  Certainty,
  IntelligenceStage,
  Severity,
  ValidationStatus,
} from "@/lib/database.types";

export const VALIDATION_STATUSES = [
  "pending",
  "confirmed",
  "disproved",
  "partially_confirmed",
  "unresolved",
  "insufficient_evidence",
] as const;

export type { ValidationStatus, IntelligenceStage };

export const VALIDATION_METHODS = [
  "observed",
  "document",
  "attestation",
  "human",
] as const;
export type ValidationMethod = (typeof VALIDATION_METHODS)[number];

export const DOCUMENT_KINDS = [
  "cr12",
  "company_extract",
  "accounts",
  "bank_statement",
  "tax_return",
  "licence",
  "contract",
  "policy",
  "other",
] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

export const VALIDATION_LABELS: Record<ValidationStatus, string> = {
  pending: "Requires validation",
  confirmed: "Confirmed",
  disproved: "False positive",
  partially_confirmed: "Partially confirmed",
  unresolved: "Unresolved",
  insufficient_evidence: "Insufficient evidence",
};

export const STAGE_LABELS: Record<IntelligenceStage, string> = {
  signal: "Signal",
  finding: "Finding",
  validated: "Validated finding",
};

export const DOCUMENT_KIND_LABELS: Record<DocumentKind, string> = {
  cr12: "CR12 / company extract",
  company_extract: "Official company extract",
  accounts: "Audited or management accounts",
  bank_statement: "Bank statement (authorised)",
  tax_return: "Tax return / KRA artefact",
  licence: "Licence or permit",
  contract: "Contract",
  policy: "Policy or board paper",
  other: "Other supporting artefact",
};

const DOCUMENT_CATEGORIES = new Set([
  "regulatory",
  "integrity",
  "financial",
  "operational",
  "data",
]);

export function isValidationStatus(value: string): value is ValidationStatus {
  return (VALIDATION_STATUSES as readonly string[]).includes(value);
}

export function isDocumentKind(value: string): value is DocumentKind {
  return (DOCUMENT_KINDS as readonly string[]).includes(value);
}

export function stageFor(
  certainty: Certainty,
  validation: ValidationStatus,
): IntelligenceStage {
  if (
    validation === "confirmed" ||
    validation === "disproved" ||
    validation === "partially_confirmed"
  ) {
    return "validated";
  }
  if (certainty === "informational") return "signal";
  return "finding";
}

export function classifyFinding(input: {
  category: string;
  certainty: Certainty;
  fingerprint: string;
}): {
  intelligence_stage: IntelligenceStage;
  validation_status: ValidationStatus;
  validation_method: ValidationMethod;
  required_document: string | null;
} {
  const document = requiredDocumentFor(input.fingerprint, input.category);
  if (input.certainty === "informational") {
    return {
      intelligence_stage: "signal",
      validation_status: "pending",
      validation_method: "observed",
      required_document: document,
    };
  }
  if (DOCUMENT_CATEGORIES.has(input.category) || document) {
    return {
      intelligence_stage: "finding",
      validation_status: "pending",
      validation_method: "document",
      required_document: document,
    };
  }
  if (input.certainty === "confirmed") {
    return {
      intelligence_stage: "finding",
      validation_status: "pending",
      validation_method: "observed",
      required_document: document,
    };
  }
  return {
    intelligence_stage: "finding",
    validation_status: "pending",
    validation_method: "observed",
    required_document: document,
  };
}

export function requiredDocumentFor(fingerprint: string, category: string) {
  if (fingerprint.includes("KE-BO") || fingerprint.includes("KE-CA") || fingerprint.includes("brs")) {
    return "Upload current CR12 / official company extract.";
  }
  if (fingerprint.includes("KE-ACECA") || fingerprint.includes("KE-PPADA")) {
    return "Upload conflict, gifts or procurement-file artefacts. This is not an allegation.";
  }
  if (fingerprint.includes("KE-ADV") || fingerprint.includes("lsk")) {
    return "Upload practising certificate / LSK standing.";
  }
  if (fingerprint.includes("KE-NPS") || fingerprint.includes("licence")) {
    return "Upload the current licence or permit, or attest that none is held.";
  }
  if (fingerprint.startsWith("contradiction:ai")) {
    return "Attest the AI inventory against the observed lockfile or pixel.";
  }
  if (fingerprint.startsWith("contradiction:privacy") || fingerprint.startsWith("contradiction:undeclared")) {
    return "Publish or upload the privacy notice that names observed processors.";
  }
  if (fingerprint.startsWith("contradiction:secondary-rail") || category === "financial") {
    return "Upload authorised accounts or evidence of the second collection rail. Amounts stay UNKNOWN.";
  }
  if (category === "regulatory" || category === "integrity") {
    return "Upload the statutory artefact, or attest that it is not held.";
  }
  return null;
}

export function explainScore(input: {
  overall: number;
  risks: {
    id: string;
    title: string;
    severity: Severity;
    category: string;
    certainty?: Certainty | null;
    validation_status?: ValidationStatus | null;
    intelligence_stage?: IntelligenceStage | null;
    fingerprint: string;
  }[];
}) {
  const open = input.risks.filter(
    (item) => item.intelligence_stage !== "signal" || item.certainty !== "informational",
  );
  const signals = input.risks.filter(
    (item) => (item.intelligence_stage ?? "finding") === "signal",
  );
  const findings = input.risks.filter(
    (item) => (item.intelligence_stage ?? "finding") !== "signal",
  );
  const validated = findings.filter((item) =>
    ["confirmed", "disproved", "partially_confirmed"].includes(
      item.validation_status ?? "pending",
    ),
  );
  const pending = findings.filter(
    (item) => (item.validation_status ?? "pending") === "pending",
  );
  const lowConfidence = findings.filter(
    (item) =>
      (item.certainty ?? "potential") === "potential" &&
      (item.validation_status ?? "pending") === "pending",
  );
  const material = findings
    .filter(
      (item) =>
        (item.severity === "critical" || item.severity === "high") &&
        item.validation_status !== "disproved",
    )
    .slice(0, 12);

  return {
    overall: input.overall,
    summary: `${findings.length} finding${findings.length === 1 ? "" : "s"} · ${validated.length} validated · ${pending.length} pending validation · ${signals.length} signal${signals.length === 1 ? "" : "s"}. A signal is not a fact.`,
    counts: {
      findings: findings.length,
      validated: validated.length,
      pending: pending.length,
      signals: signals.length,
      lowConfidence: lowConfidence.length,
      open: open.length,
    },
    material,
  };
}
