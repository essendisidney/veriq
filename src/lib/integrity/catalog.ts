export const INTEGRITY_KINDS = [
  "registry",
  "licence",
  "professional",
  "integrity",
  "sanctions",
] as const;

export type IntegrityKind = (typeof INTEGRITY_KINDS)[number];

export type IntegrityStatus = "observed" | "unknown" | "watch";

export const INTEGRITY_KIND_LABELS: Record<IntegrityKind, string> = {
  registry: "Public registry",
  licence: "Licence list",
  professional: "Professional roll",
  integrity: "Integrity regime",
  sanctions: "PEP / sanctions",
};

export type IntegrityDef = {
  id: string;
  title: string;
  kind: IntegrityKind;
  jurisdictions: string[] | "*";
  industries: string[] | "*";
  source: string;
  sourceUrl: string | null;
  summary: string;
  /** True only when VERIQ can observe this from the company's own surface. */
  observe?: "privacyNotice" | "githubConnected";
};

export const INTEGRITY_CATALOG: IntegrityDef[] = [
  {
    id: "ke-brs-registry",
    title: "Kenya company registry (BRS / eCitizen)",
    kind: "registry",
    jurisdictions: ["KE"],
    industries: "*",
    source: "Business Registration Service",
    sourceUrl: "https://brs.go.ke",
    summary:
      "Incorporation, directors and filing status live on the public company register. VERIQ does not scrape BRS. Status of this company is UNKNOWN until a public record is observed or counsel attests the certificate.",
  },
  {
    id: "ke-beneficial-ownership",
    title: "Beneficial ownership where published",
    kind: "registry",
    jurisdictions: ["KE"],
    industries: "*",
    source: "Companies registry / BO filing",
    sourceUrl: "https://brs.go.ke",
    summary:
      "Kenya requires beneficial-ownership filing. Whether this company's persons with significant control are published is UNKNOWN. VERIQ will not invent a cap table or a PEP.",
  },
  {
    id: "ke-odpc-register",
    title: "ODPC data-controller register",
    kind: "registry",
    jurisdictions: ["KE"],
    industries: "*",
    source: "Office of the Data Protection Commissioner",
    sourceUrl: "https://www.odpc.go.ke",
    summary:
      "Registration as a data controller or processor is a public ODPC fact where published. VERIQ does not scrape the register. A privacy notice on the company's own site can be observed; register standing cannot.",
  },
  {
    id: "ke-cbk-licence",
    title: "CBK supervised-institution lists",
    kind: "licence",
    jurisdictions: ["KE"],
    industries: ["financial_services", "fintech", "insurance"],
    source: "Central Bank of Kenya",
    sourceUrl: "https://www.centralbank.go.ke",
    summary:
      "Whether this company appears on a CBK licence or supervision list is UNKNOWN. VERIQ will not invent a banking or payment licence.",
  },
  {
    id: "ke-nps-licence",
    title: "National payment-system licence lists",
    kind: "licence",
    jurisdictions: ["KE"],
    industries: ["financial_services", "fintech"],
    source: "Central Bank of Kenya / NPS",
    sourceUrl: "https://www.centralbank.go.ke",
    summary:
      "Payment-service and e-money authorisation is a public CBK/NPS fact where published. An unlicensed rail is a finding only if a public list is observed — not inferred from a checkout button.",
  },
  {
    id: "ke-lsk-roll",
    title: "LSK practising status",
    kind: "professional",
    jurisdictions: ["KE"],
    industries: ["professional_services"],
    source: "Law Society of Kenya",
    sourceUrl: "https://lsk.or.ke",
    summary:
      "Whether named advocates are on the roll with a current practising certificate is UNKNOWN. VERIQ does not scrape the LSK roll and will not invent professional misconduct.",
  },
  {
    id: "ke-ppra-procurement",
    title: "Public procurement notices (PPRA)",
    kind: "integrity",
    jurisdictions: ["KE"],
    industries: ["public_sector"],
    source: "Public Procurement Regulatory Authority",
    sourceUrl: "https://www.ppra.go.ke",
    summary:
      "Tender and award notices are public where published. VERIQ does not scrape PPIP. This is not a finding that a procurement was irregular.",
  },
  {
    id: "ke-aceca-standing",
    title: "ACECA / EACC standing anti-corruption regime",
    kind: "integrity",
    jurisdictions: ["KE"],
    industries: "*",
    source: "Ethics and Anti-Corruption Commission",
    sourceUrl: "https://www.eacc.go.ke",
    summary:
      "The Anti-Corruption and Economic Crimes Act remains in force. Conflict, gifts and procurement-file artefacts stay UNKNOWN until attested. This is not an EACC finding and not a claim that anyone is corrupt.",
  },
  {
    id: "pep-sanctions-screening",
    title: "PEP and sanctions screening",
    kind: "sanctions",
    jurisdictions: "*",
    industries: "*",
    source: "Not operated by VERIQ",
    sourceUrl: null,
    summary:
      "VERIQ does not run a PEP, sanctions or leak database. Screening status is UNKNOWN. A name match will never be invented.",
  },
  {
    id: "privacy-notice",
    title: "Privacy notice on the company site",
    kind: "registry",
    jurisdictions: "*",
    industries: "*",
    source: "Company website",
    sourceUrl: null,
    summary:
      "A privacy or data-protection notice on the company's own domain can be observed. That is not ODPC registration.",
    observe: "privacyNotice",
  },
  {
    id: "github-org-membership",
    title: "Connected GitHub organisation membership",
    kind: "registry",
    jurisdictions: "*",
    industries: "*",
    source: "GitHub (connected)",
    sourceUrl: "https://github.com",
    summary:
      "Org membership is visible only with a connected GitHub identity. A public username scan cannot see private repos or sibling organisations.",
    observe: "githubConnected",
  },
];
