export type RiskPack = {
  id: "banking" | "investment" | "procurement" | "insurance" | "healthcare";
  title: string;
  question: string;
  industries: string[];
  href: string;
  domains: string[];
};

export const RISK_PACKS: RiskPack[] = [
  {
    id: "banking",
    title: "VERIQ Banking",
    question: "Can we safely lend or onboard this business?",
    industries: ["fintech", "financial_services"],
    href: "/reports/credit",
    domains: ["KYB story", "governance", "AML artefacts", "financial bands", "operations"],
  },
  {
    id: "investment",
    title: "VERIQ Investment",
    question: "Is the company we would fund actually what management says it is?",
    industries: ["*"],
    href: "/reports/diligence",
    domains: ["founder/company claims", "financial", "market footprint", "governance"],
  },
  {
    id: "procurement",
    title: "VERIQ Procurement",
    question: "Before we award, what can be proven?",
    industries: ["public_sector", "construction", "logistics", "manufacturing", "energy"],
    href: "/reports/procurement",
    domains: ["ownership", "capacity", "conflicts", "licences", "past-performance unknowns"],
  },
  {
    id: "insurance",
    title: "VERIQ Insurance",
    question: "Should we insure this business, and at what uncertainty?",
    industries: ["insurance", "healthcare", "logistics", "manufacturing"],
    href: "/reports/credit",
    domains: ["operational", "financial", "regulatory", "reputation"],
  },
  {
    id: "healthcare",
    title: "VERIQ Healthcare",
    question: "Is this a licensed operator with an evidenced ownership story?",
    industries: ["healthcare"],
    href: "/reports/regulatory",
    domains: ["licensing", "ownership", "compliance", "operations"],
  },
];

export function packsForIndustry(industry: string): RiskPack[] {
  const matched = RISK_PACKS.filter(
    (pack) => pack.industries.includes("*") || pack.industries.includes(industry),
  );
  return matched.length ? matched : RISK_PACKS.filter((pack) => pack.id === "investment");
}
