export const SECTOR_PACKS = [
  "sme",
  "sacco",
  "mfi",
  "ngo",
  "school",
  "hospital",
  "church",
  "professional",
  "logistics",
  "fintech",
] as const;
export type SectorPackId = (typeof SECTOR_PACKS)[number];

export type PackRule = {
  id: string;
  title: string;
  need: string;
  evidence: string[];
};

export type SectorPack = {
  id: SectorPackId;
  title: string;
  question: string;
  industries: string[];
  metrics: string[];
  rules: PackRule[];
  implemented: boolean;
};

export const SECTOR_PACK_CATALOG: SectorPack[] = [
  {
    id: "sme",
    title: "SME pack",
    question: "Does cash, revenue, debt and working capital hang together?",
    industries: ["*", "saas", "technology", "retail", "manufacturing", "agriculture", "other"],
    metrics: ["cash", "revenue", "debt", "margins", "customers", "suppliers", "working_capital"],
    implemented: true,
    rules: [
      {
        id: "sme-revenue-evidence",
        title: "Revenue evidence",
        need: "Management or audited accounts, or a bank statement with identifiable operating inflows.",
        evidence: ["accounts", "management_accounts", "audited_accounts", "bank_statement", "tax_return"],
      },
      {
        id: "sme-cash",
        title: "Cash and liquidity",
        need: "Bank statement covering a recent period.",
        evidence: ["bank_statement"],
      },
      {
        id: "sme-payroll",
        title: "Workforce vs payroll",
        need: "Payroll or attested headcount. Website employee claims are unverified.",
        evidence: ["payroll"],
      },
      {
        id: "sme-debt",
        title: "Debt service",
        need: "Loan schedule or accounts showing interest and principal. DSCR stays UNKNOWN without both.",
        evidence: ["accounts", "contract"],
      },
      {
        id: "sme-ownership",
        title: "Ownership extract",
        need: "Customer-uploaded CR12 / company extract. BRS is not scraped.",
        evidence: ["cr12", "company_extract"],
      },
    ],
  },
  {
    id: "sacco",
    title: "SACCO pack",
    question: "Liquidity, capital, portfolio quality, governance, member concentration.",
    industries: ["sacco"],
    metrics: ["liquidity", "capital", "par", "governance", "member_concentration"],
    implemented: false,
    rules: [],
  },
  {
    id: "mfi",
    title: "MFI pack",
    question: "Portfolio quality, PAR, collections, cost of funds, borrower concentration.",
    industries: ["mfi"],
    metrics: ["par", "collections", "cost_of_funds", "borrower_concentration"],
    implemented: false,
    rules: [],
  },
  {
    id: "ngo",
    title: "NGO pack",
    question: "Donor concentration, restricted funds, programme vs admin, grant compliance.",
    industries: ["ngo"],
    metrics: ["donor_concentration", "restricted_funds", "programme_spend", "governance"],
    implemented: false,
    rules: [],
  },
  {
    id: "school",
    title: "School pack",
    question: "Enrolment, fee collections, payroll, ratios, cash leakage.",
    industries: ["education"],
    metrics: ["enrolment", "fees", "payroll", "ratios"],
    implemented: false,
    rules: [],
  },
  {
    id: "hospital",
    title: "Hospital pack",
    question: "Volumes, claims, pharmacy, procurement, receivables.",
    industries: ["healthcare"],
    metrics: ["volumes", "claims", "pharmacy", "receivables"],
    implemented: false,
    rules: [],
  },
  {
    id: "church",
    title: "Church pack",
    question: "Collections, projects, payroll, restricted funds, governance.",
    industries: ["church"],
    metrics: ["collections", "projects", "payroll", "restricted_funds"],
    implemented: false,
    rules: [],
  },
  {
    id: "professional",
    title: "Professional firm pack",
    question: "Client concentration, billings, WIP, receivables, partner concentration.",
    industries: ["professional_services"],
    metrics: ["client_concentration", "billings", "wip", "receivables"],
    implemented: false,
    rules: [],
  },
  {
    id: "logistics",
    title: "Logistics pack",
    question: "Fleet, fuel, utilisation, revenue per vehicle.",
    industries: ["logistics"],
    metrics: ["fleet", "fuel", "utilisation", "revenue_per_vehicle"],
    implemented: false,
    rules: [],
  },
  {
    id: "fintech",
    title: "Fintech pack",
    question: "Volumes, liquidity, concentration, AML/KYC artefacts, settlement risk.",
    industries: ["fintech", "financial_services"],
    metrics: ["volumes", "liquidity", "aml_kyc", "settlement"],
    implemented: false,
    rules: [],
  },
];

export function packForIndustry(industry: string): SectorPack {
  const hit = SECTOR_PACK_CATALOG.find(
    (pack) => pack.id !== "sme" && pack.industries.includes(industry),
  );
  return hit ?? SECTOR_PACK_CATALOG[0];
}

export function missingForPack(pack: SectorPack, documentKinds: string[]) {
  if (!pack.implemented) {
    return pack.metrics.map((metric) => `${pack.title} metric '${metric}' is not implemented yet.`);
  }
  return pack.rules
    .filter((rule) => !rule.evidence.some((kind) => documentKinds.includes(kind)))
    .map((rule) => `${rule.title}: ${rule.need}`);
}
