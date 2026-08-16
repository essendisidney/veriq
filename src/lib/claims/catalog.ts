export const CLAIM_VERDICTS = [
  "verified",
  "corroborated",
  "unverified",
  "contradicted",
  "unknown",
] as const;

export type ClaimVerdict = (typeof CLAIM_VERDICTS)[number];

export const CLAIM_VERDICT_LABELS: Record<ClaimVerdict, string> = {
  verified: "Verified",
  corroborated: "Corroborated",
  unverified: "Unverified",
  contradicted: "Contradicted",
  unknown: "Unknown",
};

export const CLAIM_VERDICT_HINTS: Record<ClaimVerdict, string> = {
  verified: "Evidence supports the claim.",
  corroborated: "Multiple independent observations support the claim.",
  unverified: "There is not enough evidence.",
  contradicted: "Reliable evidence conflicts with the claim.",
  unknown: "The data simply is not available.",
};

const LEGACY_VERDICTS: Record<string, ClaimVerdict> = {
  conflict: "contradicted",
  signal: "unverified",
};

export function normalizeVerdict(value: unknown): ClaimVerdict {
  if (typeof value !== "string") return "unknown";
  if ((CLAIM_VERDICTS as readonly string[]).includes(value)) return value as ClaimVerdict;
  return LEGACY_VERDICTS[value] ?? "unknown";
}

export function isContradicted(value: unknown): boolean {
  return normalizeVerdict(value) === "contradicted" || value === "conflict";
}

export const EMPLOYEE_BANDS = ["unknown", "1-10", "11-50", "51-200", "201+"] as const;
export type EmployeeBand = (typeof EMPLOYEE_BANDS)[number];

export const DIRECTOR_BANDS = ["unknown", "1", "2-3", "4+"] as const;
export type DirectorBand = (typeof DIRECTOR_BANDS)[number];

export const PRESENCE_BANDS = ["unknown", "kenya", "regional", "continental"] as const;
export type PresenceBand = (typeof PRESENCE_BANDS)[number];

export const REVENUE_BANDS = [
  "unknown",
  "not_disclosed",
  "under_50m",
  "50m_to_500m",
  "over_500m",
] as const;
export type RevenueBand = (typeof REVENUE_BANDS)[number];

export const REVENUE_BAND_LABELS: Record<RevenueBand, string> = {
  unknown: "Unknown",
  not_disclosed: "Not disclosed",
  under_50m: "Under KSh 50M (attested)",
  "50m_to_500m": "KSh 50M–500M (attested)",
  over_500m: "Over KSh 500M (attested)",
};

export type TriState = "unknown" | "yes" | "no";

export type AttestedClaims = {
  employeeBand: EmployeeBand;
  directorBand: DirectorBand;
  licensedOperator: TriState;
  africaPresence: PresenceBand;
  relatedPartySuppliers: TriState;
  revenueBand: RevenueBand;
};

export const DEFAULT_ATTESTED_CLAIMS: AttestedClaims = {
  employeeBand: "unknown",
  directorBand: "unknown",
  licensedOperator: "unknown",
  africaPresence: "unknown",
  relatedPartySuppliers: "unknown",
  revenueBand: "unknown",
};

export const CLAIMS_ASSET = {
  type: "company_claims",
  name: "Company claims",
} as const;

export type ObservedClaims = {
  websiteEmployees: number | null;
  websiteEmployeeText: string | null;
  teamFootprint: number;
  teamPageUrl: string | null;
  licensedLanguage: boolean;
  africaLanguage: boolean;
  githubPublicRepos: number;
  paymentProcessors: number;
  revenueLanguage: boolean;
};

export type ClaimRow = {
  id: string;
  title: string;
  domain: "corporate" | "people" | "licence" | "commercial" | "integrity" | "financial";
  claim: string;
  verdict: ClaimVerdict;
  supporting: string[];
  conflicting: string[];
  confidence: number;
  requiredDocument: string | null;
  why: string;
  decisionImpact: string;
  inference: boolean;
  validationRequired: boolean;
};

export function employeeBandFor(count: number): Exclude<EmployeeBand, "unknown"> {
  if (count <= 10) return "1-10";
  if (count <= 50) return "11-50";
  if (count <= 200) return "51-200";
  return "201+";
}
