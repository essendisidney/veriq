export type PackKind = "diligence" | "credit" | "restructuring";

export function parsePackKind(value: string | null | undefined): PackKind {
  if (value === "credit" || value === "restructuring") return value;
  return "diligence";
}

export const PACK_COPY: Record<
  PackKind,
  {
    title: string;
    audience: string;
    scoreLabel: string;
    flagLabel: string;
    printBrand: string;
    disclaimer: string;
  }
> = {
  diligence: {
    title: "Investor due diligence",
    audience: "Investors, acquirers and diligence teams",
    scoreLabel: "Company Health Score",
    flagLabel: "Diligence flags",
    printBrand: "VERIQ Investor Intelligence",
    disclaimer:
      "VERIQ is not a lawyer, auditor, valuer or investment adviser. This pack does not recommend buying, selling or holding securities. Amounts, cap tables and forecasts remain UNKNOWN unless attested elsewhere.",
  },
  credit: {
    title: "Bank / credit intelligence",
    audience: "Banks, lenders and credit committees",
    scoreLabel: "Business Risk Profile",
    flagLabel: "Credit-relevant flags",
    printBrand: "VERIQ Bank Intelligence",
    disclaimer:
      "VERIQ is not a credit-rating agency, bank or auditor. This profile must not be used as a credit score, PD, LGD or limit recommendation. Liquidity, leverage and cash remain UNKNOWN without financial statements.",
  },
  restructuring: {
    title: "Restructuring / insolvency intelligence",
    audience: "Insolvency practitioners, restructuring counsel and legal firms",
    scoreLabel: "Operating continuity picture",
    flagLabel: "Continuity flags",
    printBrand: "VERIQ Restructuring Intelligence",
    disclaimer:
      "VERIQ is not a lawyer, insolvency practitioner, Official Receiver or court. This pack is not a solvency opinion, not a statement of affairs, and not advice under the Insolvency Act. Creditor lists, cash, preferences and going-concern remain UNKNOWN. Final decisions remain with authorised professionals.",
  },
};
