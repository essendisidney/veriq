import type { TrustStatus } from "@/lib/database.types";
import type { VendorMap } from "@/lib/vendors/assess";
import {
  CLAIMS_ASSET,
  DEFAULT_ATTESTED_CLAIMS,
  employeeBandFor,
  isContradicted,
  type AttestedClaims,
  type ClaimRow,
  type ClaimVerdict,
  type DirectorBand,
  type EmployeeBand,
  type ObservedClaims,
  type PresenceBand,
  type RevenueBand,
  type TriState,
} from "@/lib/claims/catalog";

export { CLAIMS_ASSET, DEFAULT_ATTESTED_CLAIMS, isContradicted };
export type { AttestedClaims, ClaimRow, ObservedClaims };

export type ClaimsAssessment = {
  attested: AttestedClaims;
  observed: ObservedClaims;
  claims: ClaimRow[];
  verified: number;
  corroborated: number;
  unverified: number;
  contradicted: number;
  unknown: number;
  inferences: number;
  /** @deprecated use contradicted */
  conflicts: number;
  /** @deprecated use inferences */
  signals: number;
  summary: string;
};

const EMPLOYEE_BANDS: EmployeeBand[] = ["unknown", "1-10", "11-50", "51-200", "201+"];
const DIRECTOR_BANDS: DirectorBand[] = ["unknown", "1", "2-3", "4+"];
const PRESENCE: PresenceBand[] = ["unknown", "kenya", "regional", "continental"];
const REVENUE: RevenueBand[] = [
  "unknown",
  "not_disclosed",
  "under_50m",
  "50m_to_500m",
  "over_500m",
];
const TRI: TriState[] = ["unknown", "yes", "no"];

function pick<T extends string>(value: unknown, allowed: T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

export function parseAttestedClaims(metadata: unknown): AttestedClaims {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return { ...DEFAULT_ATTESTED_CLAIMS };
  }
  const row = metadata as Partial<AttestedClaims>;
  return {
    employeeBand: pick(row.employeeBand, EMPLOYEE_BANDS, "unknown"),
    directorBand: pick(row.directorBand, DIRECTOR_BANDS, "unknown"),
    licensedOperator: pick(row.licensedOperator, TRI, "unknown"),
    africaPresence: pick(row.africaPresence, PRESENCE, "unknown"),
    relatedPartySuppliers: pick(row.relatedPartySuppliers, TRI, "unknown"),
    revenueBand: pick(row.revenueBand, REVENUE, "unknown"),
  };
}

export function emptyObserved(): ObservedClaims {
  return {
    websiteEmployees: null,
    websiteEmployeeText: null,
    teamFootprint: 0,
    teamPageUrl: null,
    licensedLanguage: false,
    africaLanguage: false,
    githubPublicRepos: 0,
    paymentProcessors: 0,
    revenueLanguage: false,
  };
}

export function extractObservedClaims(input: {
  html?: string;
  teamFootprint?: number;
  teamPageUrl?: string | null;
  githubPublicRepos?: number;
  vendors?: VendorMap | null;
}): ObservedClaims {
  const html = input.html ?? "";
  const employeeMatch = html.match(
    /(\d{1,5})\s*(?:\+|plus)?\s*(?:employees|staff|people|team members)/i,
  );
  const teamMatch = html.match(/team of\s+(\d{1,5})/i);
  const websiteEmployees = employeeMatch
    ? Number(employeeMatch[1])
    : teamMatch
      ? Number(teamMatch[1])
      : null;
  const websiteEmployeeText = employeeMatch?.[0] ?? teamMatch?.[0] ?? null;
  const licensedLanguage =
    /licensed by|regulated by|cbk[- ]licensed|cma[- ]licensed|ira[- ]licensed|payment service provider|authorised dealer|authorized dealer|nse listed|data controller/i.test(
      html,
    );
  const africaLanguage =
    /across africa|pan-?african|east africa|west africa|operating in africa|offices in kenya|nairobi and|kenya, uganda|presence in \d+ countries/i.test(
      html,
    );
  const revenueLanguage =
    /annual revenue|turnover of|ksh\s*[\d,.]+|kes\s*[\d,.]+/i.test(html);
  const payments = (input.vendors?.vendors ?? []).filter(
    (item) => item.category === "payments",
  ).length;

  return {
    websiteEmployees:
      websiteEmployees != null && Number.isFinite(websiteEmployees)
        ? websiteEmployees
        : null,
    websiteEmployeeText,
    teamFootprint: input.teamFootprint ?? 0,
    teamPageUrl: input.teamPageUrl ?? null,
    licensedLanguage,
    africaLanguage,
    githubPublicRepos: input.githubPublicRepos ?? 0,
    paymentProcessors: payments,
    revenueLanguage,
  };
}

export function assessClaims(input: {
  attested?: AttestedClaims | null;
  observed: ObservedClaims;
  industry: string;
}): ClaimsAssessment {
  const attested = input.attested ?? { ...DEFAULT_ATTESTED_CLAIMS };
  const observed = input.observed;
  const claims: ClaimRow[] = [];

  claims.push(employeeClaim(attested.employeeBand, observed));
  claims.push(directorClaim(attested.directorBand, observed));
  claims.push(licenceClaim(attested.licensedOperator, observed, input.industry));
  claims.push(presenceClaim(attested.africaPresence, observed));
  claims.push(relatedPartyClaim(attested.relatedPartySuppliers));
  claims.push(revenueClaim(attested.revenueBand, observed));

  const verified = claims.filter((item) => item.verdict === "verified").length;
  const corroborated = claims.filter((item) => item.verdict === "corroborated").length;
  const unverified = claims.filter((item) => item.verdict === "unverified").length;
  const contradicted = claims.filter((item) => item.verdict === "contradicted").length;
  const unknown = claims.filter((item) => item.verdict === "unknown").length;
  const inferences = claims.filter((item) => item.inference).length;

  const summary = contradicted
    ? `${contradicted} claim${contradicted === 1 ? "" : "s"} contradicted. VERIQ is not alleging fraud — the story and the evidence do not agree.`
    : unverified
      ? `${unverified} claimed fact${unverified === 1 ? "" : "s"} remain UNVERIFIED. No evidence = no conclusion.`
      : unknown === claims.length
        ? "Nothing about this company has been evidenced yet. VERIQ will not invent a story."
        : corroborated || verified
          ? `${corroborated + verified} claimed fact${corroborated + verified === 1 ? "" : "s"} match observed evidence. That is the story, not a KYB database hit.`
          : "No management claims have been attested yet.";

  return {
    attested,
    observed,
    claims,
    verified,
    corroborated,
    unverified,
    contradicted,
    unknown,
    inferences,
    conflicts: contradicted,
    signals: inferences,
    summary,
  };
}

function employeeClaim(attested: EmployeeBand, observed: ObservedClaims): ClaimRow {
  const supporting: string[] = [];
  const conflicting: string[] = [];
  if (observed.websiteEmployeeText) {
    supporting.push(`Website copy: “${observed.websiteEmployeeText.trim()}”.`);
  }
  if (observed.teamFootprint) {
    supporting.push(
      `${observed.teamFootprint} people linked from the company team/about page${observed.teamPageUrl ? ` (${observed.teamPageUrl})` : ""}.`,
    );
  }
  if (observed.githubPublicRepos) {
    supporting.push(
      `${observed.githubPublicRepos} scanned GitHub repositories (engineering footprint, not headcount).`,
    );
  }

  const copyBand =
    observed.websiteEmployees != null ? employeeBandFor(observed.websiteEmployees) : null;
  const teamBand = observed.teamFootprint >= 3 ? employeeBandFor(observed.teamFootprint) : null;
  const observedBand = copyBand ?? teamBand;
  const independentAgree =
    Boolean(copyBand && teamBand && copyBand === teamBand) ||
    Boolean(copyBand && attested === copyBand && teamBand && attested === teamBand);

  if (attested === "unknown" && !observedBand) {
    return row({
      id: "people-headcount",
      domain: "people",
      title: "Headcount",
      claim: "unknown",
      verdict: "unknown",
      supporting,
      conflicting,
      confidence: 20,
      requiredDocument: "Attest a headcount band or upload authorised payroll. VERIQ does not scrape LinkedIn.",
      why: "The data simply is not available.",
      decisionImpact: "Lenders and investors cannot size the operating team.",
      inference: false,
      validationRequired: false,
    });
  }
  if (attested === "unknown" && observedBand) {
    return row({
      id: "people-headcount",
      domain: "people",
      title: "Headcount",
      claim: `Public site suggests ${observedBand}`,
      verdict: "unverified",
      supporting,
      conflicting,
      confidence: 55,
      requiredDocument: "Attest the operating headcount. A website number is a claim, not a payroll.",
      why: "A public headcount claim is an inference until management or an artefact confirms it.",
      decisionImpact: "Do not underwrite headcount from marketing copy.",
      inference: true,
      validationRequired: true,
    });
  }
  if (observedBand && attested !== observedBand) {
    conflicting.push(`Attested ${attested}; observed public footprint sits in ${observedBand}.`);
    return row({
      id: "people-headcount",
      domain: "people",
      title: "Headcount",
      claim: attested,
      verdict: "contradicted",
      supporting,
      conflicting,
      confidence: 82,
      requiredDocument: "Upload authorised payroll or correct the attested band. This is not a finding of fraud.",
      why: "Reliable public copy conflicts with the attested story.",
      decisionImpact: "Headcount is an underwriting input. Resolve before you say yes.",
      inference: false,
      validationRequired: true,
    });
  }
  if (independentAgree && attested === copyBand) {
    return row({
      id: "people-headcount",
      domain: "people",
      title: "Headcount",
      claim: attested,
      verdict: "corroborated",
      supporting,
      conflicting,
      confidence: 84,
      requiredDocument: null,
      why: "Website copy and the team page agree with the attested band. Payroll remains UNKNOWN.",
      decisionImpact: "Public story is consistent. It is still not a statutory headcount.",
      inference: false,
      validationRequired: false,
    });
  }
  if (observedBand && attested === observedBand) {
    return row({
      id: "people-headcount",
      domain: "people",
      title: "Headcount",
      claim: attested,
      verdict: "verified",
      supporting,
      conflicting,
      confidence: 74,
      requiredDocument: null,
      why: "The attested band matches the company's own public copy. Payroll remains UNKNOWN.",
      decisionImpact: "One source supports the story. Independent payroll would raise confidence.",
      inference: false,
      validationRequired: false,
    });
  }
  return row({
    id: "people-headcount",
    domain: "people",
    title: "Headcount",
    claim: attested,
    verdict: "unverified",
    supporting,
    conflicting,
    confidence: 48,
    requiredDocument: "Upload authorised payroll or a CR12-linked organogram. LinkedIn is not a source VERIQ will scrape.",
    why: "The claim is attested but not independently observed.",
    decisionImpact: "People risk stays qualitative until an artefact is in the vault.",
    inference: false,
    validationRequired: true,
  });
}

function directorClaim(attested: DirectorBand, observed: ObservedClaims): ClaimRow {
  const supporting: string[] = [];
  if (observed.teamFootprint) {
    supporting.push(`${observed.teamFootprint} names/profiles on the public team page.`);
  }
  if (attested === "unknown") {
    return row({
      id: "corporate-directors",
      domain: "corporate",
      title: "Directors",
      claim: "unknown",
      verdict: "unknown",
      supporting,
      conflicting: [],
      confidence: 15,
      requiredDocument: "Upload current CR12 / official company extract. VERIQ does not scrape BRS or eCitizen.",
      why: "Director identity is a Companies Registry fact. A website team page is not a CR12.",
      decisionImpact: "Ownership and related-party tests cannot start without an official extract.",
      inference: false,
      validationRequired: false,
    });
  }
  return row({
    id: "corporate-directors",
    domain: "corporate",
    title: "Directors",
    claim: attested,
    verdict: "unverified",
    supporting,
    conflicting: [],
    confidence: 42,
    requiredDocument: "Upload current CR12. A team page cannot confirm statutory directors.",
    why: "Attested director band is a claim until the official extract is in the evidence vault.",
    decisionImpact: "Banks and procurement teams should not treat a website as a CR12.",
    inference: false,
    validationRequired: true,
  });
}

function licenceClaim(
  attested: TriState,
  observed: ObservedClaims,
  industry: string,
): ClaimRow {
  const regulated = ["fintech", "financial_services", "insurance", "healthcare"].includes(
    industry,
  );
  const supporting: string[] = [];
  const conflicting: string[] = [];
  if (observed.licensedLanguage) supporting.push("Website uses licensed/regulated language.");
  if (observed.paymentProcessors) {
    supporting.push(
      `${observed.paymentProcessors} payment processor${observed.paymentProcessors === 1 ? "" : "s"} on the public site.`,
    );
  }
  if (attested === "no" && (observed.licensedLanguage || (regulated && observed.paymentProcessors))) {
    conflicting.push(
      "Public site implies licensed or payment activity while the claim is “not licensed”.",
    );
    return row({
      id: "licence-operator",
      domain: "licence",
      title: "Licensed operator",
      claim: "no",
      verdict: "contradicted",
      supporting,
      conflicting,
      confidence: 80,
      requiredDocument: "Upload the licence or correct the claim. A checkout button is not a CBK/CMA/IRA licence.",
      why: "Story vs surface: unlicensed claim against observed payment or licence language.",
      decisionImpact: "Onboarding a supposedly unlicensed operator with a licensed public story is a governance failure.",
      inference: false,
      validationRequired: true,
    });
  }
  if (attested === "yes") {
    return row({
      id: "licence-operator",
      domain: "licence",
      title: "Licensed operator",
      claim: "yes",
      verdict: "unverified",
      supporting,
      conflicting,
      confidence: 50,
      requiredDocument: "Upload the current licence. VERIQ does not scrape CBK, CMA or IRA lists.",
      why: "A licence claim is UNVERIFIED until the artefact is in the vault.",
      decisionImpact: "Do not treat website language as a licence to operate.",
      inference: false,
      validationRequired: true,
    });
  }
  if (attested === "unknown" && observed.licensedLanguage) {
    return row({
      id: "licence-operator",
      domain: "licence",
      title: "Licensed operator",
      claim: "unknown",
      verdict: "unverified",
      supporting,
      conflicting,
      confidence: 52,
      requiredDocument: "Attest whether the company is a licensed operator, then upload the licence.",
      why: "Licence language on the site is an inference, not a register hit.",
      decisionImpact: "Regulated counterparties need the artefact, not the slogan.",
      inference: true,
      validationRequired: true,
    });
  }
  return row({
    id: "licence-operator",
    domain: "licence",
    title: "Licensed operator",
    claim: attested,
    verdict: attested === "unknown" ? "unknown" : "unverified",
    supporting,
    conflicting,
    confidence: 35,
    requiredDocument: regulated ? "Attest licence standing for this industry." : null,
    why: "Licence standing stays UNKNOWN without an official list or an uploaded artefact.",
    decisionImpact: "Absence of a licence is not proved. Presence is not proved either.",
    inference: false,
    validationRequired: attested !== "unknown",
  });
}

function presenceClaim(attested: PresenceBand, observed: ObservedClaims): ClaimRow {
  const supporting: string[] = [];
  if (observed.africaLanguage) supporting.push("Website claims Africa-wide or regional presence.");
  if (attested === "continental" && !observed.africaLanguage) {
    return row({
      id: "commercial-presence",
      domain: "commercial",
      title: "Geographic presence",
      claim: attested,
      verdict: "unverified",
      supporting,
      conflicting: [],
      confidence: 44,
      requiredDocument: "Evidence the operating countries. A continental claim without public copy stays UNVERIFIED.",
      why: "Scale claims are underwriting facts. VERIQ will not invent a footprint.",
      decisionImpact: "Do not price a pan-African business on an unevidenced claim.",
      inference: false,
      validationRequired: true,
    });
  }
  if (attested !== "unknown" && observed.africaLanguage && attested !== "kenya") {
    return row({
      id: "commercial-presence",
      domain: "commercial",
      title: "Geographic presence",
      claim: attested,
      verdict: "verified",
      supporting,
      conflicting: [],
      confidence: 62,
      requiredDocument: "Attest operating countries with contracts or licences. Website copy is not a licence to operate.",
      why: "Public copy supports a regional story. Cross-border licences stay UNKNOWN.",
      decisionImpact: "Marketing presence is not regulatory presence.",
      inference: false,
      validationRequired: true,
    });
  }
  if (attested === "unknown") {
    return row({
      id: "commercial-presence",
      domain: "commercial",
      title: "Geographic presence",
      claim: "unknown",
      verdict: "unknown",
      supporting,
      conflicting: [],
      confidence: 20,
      requiredDocument: null,
      why: "Presence is UNKNOWN until attested.",
      decisionImpact: "Geographic concentration cannot be priced.",
      inference: false,
      validationRequired: false,
    });
  }
  return row({
    id: "commercial-presence",
    domain: "commercial",
    title: "Geographic presence",
    claim: attested,
    verdict: "unverified",
    supporting,
    conflicting: [],
    confidence: 42,
    requiredDocument: null,
    why: "Attested presence is a claim. Cross-border licences stay UNKNOWN.",
    decisionImpact: "Ask for operating licences per country before treating scale as a fact.",
    inference: false,
    validationRequired: true,
  });
}

function relatedPartyClaim(attested: TriState): ClaimRow {
  if (attested === "yes") {
    return row({
      id: "integrity-related",
      domain: "integrity",
      title: "Related-party suppliers",
      claim: "yes",
      verdict: "unverified",
      supporting: ["Management attested related-party suppliers."],
      conflicting: [],
      confidence: 70,
      requiredDocument: "Upload the related-party file. This is not an ACECA allegation.",
      why: "The claim is on the ledger. Independent graph evidence is still missing.",
      decisionImpact: "Procurement and credit files should treat this as a related-party risk signal, not fraud.",
      inference: true,
      validationRequired: true,
    });
  }
  if (attested === "no") {
    return row({
      id: "integrity-related",
      domain: "integrity",
      title: "Related-party suppliers",
      claim: "no",
      verdict: "unverified",
      supporting: [],
      conflicting: [],
      confidence: 38,
      requiredDocument: "A CR12 plus supplier list can later test this. VERIQ will not invent a related company.",
      why: "Absence of related parties cannot be proved from the public site.",
      decisionImpact: "A ‘no related parties’ claim is not evidence. Challenge it with the official extract.",
      inference: false,
      validationRequired: true,
    });
  }
  return row({
    id: "integrity-related",
    domain: "integrity",
    title: "Related-party suppliers",
    claim: "unknown",
    verdict: "unknown",
    supporting: [],
    conflicting: [],
    confidence: 15,
    requiredDocument: "Attest whether suppliers or partners are related. Do not invent a graph of people.",
    why: "Related entities stay UNKNOWN until claimed or evidenced on an official extract.",
    decisionImpact: "Conflicts of interest cannot be cleared.",
    inference: false,
    validationRequired: false,
  });
}

function revenueClaim(attested: RevenueBand, observed: ObservedClaims): ClaimRow {
  const supporting: string[] = [];
  if (observed.revenueLanguage) {
    supporting.push("Website uses revenue or turnover language. Amounts were not extracted as facts.");
  }
  if (attested === "unknown") {
    return row({
      id: "financial-revenue",
      domain: "financial",
      title: "Revenue",
      claim: "unknown",
      verdict: "unknown",
      supporting,
      conflicting: [],
      confidence: 10,
      requiredDocument: "Attest a qualitative band, then upload authorised accounts. VERIQ will not invent KES amounts.",
      why: "No evidence = no conclusion. A press release is not a revenue figure.",
      decisionImpact: "Credit, insurance and investment files cannot size the business.",
      inference: observed.revenueLanguage,
      validationRequired: false,
    });
  }
  if (attested === "not_disclosed") {
    return row({
      id: "financial-revenue",
      domain: "financial",
      title: "Revenue",
      claim: "not disclosed",
      verdict: "unverified",
      supporting,
      conflicting: [],
      confidence: 30,
      requiredDocument: null,
      why: "Management has not put a band on the ledger. That is honest, not a clearance.",
      decisionImpact: "Proceed only if the decision does not depend on scale.",
      inference: false,
      validationRequired: false,
    });
  }
  return row({
    id: "financial-revenue",
    domain: "financial",
    title: "Revenue",
    claim: attested,
    verdict: "unverified",
    supporting,
    conflicting: [],
    confidence: 35,
    requiredDocument:
      "Upload audited or management accounts, or authorised bank/tax artefacts. VERIQ does not OCR amounts into facts.",
    why: "An attested band is a claim. Accounts, tax files and bank statements stay UNKNOWN until they are in the vault — and even then a human classifies them.",
    decisionImpact: "Do not lend, invest or insure against an unevidenced revenue story.",
    inference: false,
    validationRequired: true,
  });
}

function row(input: ClaimRow): ClaimRow {
  return input;
}

export function claimTrust(verdict: ClaimVerdict): TrustStatus {
  if (verdict === "verified" || verdict === "corroborated") return "observed";
  if (verdict === "contradicted") return "inferred";
  return "unknown";
}
