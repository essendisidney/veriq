import type { TrustStatus } from "@/lib/database.types";
import type { VendorMap } from "@/lib/vendors/assess";
import type { ExtractedAmount } from "@/lib/acquire/money";
import { extractAmounts } from "@/lib/acquire/money";
import { assessFinancialHealth, type FinancialHealth } from "@/lib/finance/health";

export type ConcentrationBand = "unknown" | "low" | "moderate" | "high";
export type LiquidityBand = "unknown" | "tight" | "adequate" | "strong";
export type RevenueMix = "unknown" | "transactions" | "subscriptions" | "mixed";
export type TriState = "unknown" | "yes" | "no";

export type AttestedFinance = {
  customerConcentration: ConcentrationBand;
  liquidity: LiquidityBand;
  revenueMix: RevenueMix;
  singleSite: TriState;
  keyPerson: TriState;
  secondaryPaymentRail: TriState;
};

export const DEFAULT_ATTESTED: AttestedFinance = {
  customerConcentration: "unknown",
  liquidity: "unknown",
  revenueMix: "unknown",
  singleSite: "unknown",
  keyPerson: "unknown",
  secondaryPaymentRail: "unknown",
};

export type FinanceSignal = {
  id: string;
  label: string;
  value: string;
  trustStatus: TrustStatus;
  note: string;
};

export type FinanceAssessment = {
  attested: AttestedFinance;
  signals: FinanceSignal[];
  paymentRails: string[];
  paymentVendors: { id: string; name: string }[];
  paymentConcentration: ConcentrationBand;
  supplierConcentration: ConcentrationBand;
  technologyConcentration: ConcentrationBand;
  unknowns: string[];
  posture: number;
  summary: string;
  health?: FinancialHealth;
};

const BAND_LABEL: Record<ConcentrationBand, string> = {
  unknown: "Unknown",
  low: "Low",
  moderate: "Moderate",
  high: "High",
};

export function concentrationLabel(band: ConcentrationBand) {
  return BAND_LABEL[band];
}

export function parseAttested(metadata: unknown): AttestedFinance {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return { ...DEFAULT_ATTESTED };
  }
  const row = metadata as Partial<AttestedFinance>;
  return {
    customerConcentration: row.customerConcentration ?? "unknown",
    liquidity: row.liquidity ?? "unknown",
    revenueMix: row.revenueMix ?? "unknown",
    singleSite: row.singleSite ?? "unknown",
    keyPerson: row.keyPerson ?? "unknown",
    secondaryPaymentRail: row.secondaryPaymentRail ?? "unknown",
  };
}

function fromCount(count: number): ConcentrationBand {
  if (count <= 0) return "unknown";
  if (count === 1) return "high";
  if (count === 2) return "moderate";
  return "low";
}

function attestedComplete(attested: AttestedFinance) {
  return (
    attested.customerConcentration !== "unknown" &&
    attested.liquidity !== "unknown" &&
    attested.revenueMix !== "unknown"
  );
}

export function assessFinance(input: {
  vendors: VendorMap | null;
  industry: string;
  attested?: AttestedFinance | null;
  documents?: { kind: string; filename: string; extractedText: string | null }[];
}): FinanceAssessment {
  const attested = input.attested ?? { ...DEFAULT_ATTESTED };
  const vendors = input.vendors?.vendors ?? [];
  const payments = vendors.filter((item) => item.category === "payments");
  const hosting = vendors.filter((item) => item.category === "hosting");
  const critical = vendors.filter(
    (item) => item.criticality === "critical" || item.criticality === "high",
  );
  const paymentVendors = payments.map((item) => ({ id: item.id, name: item.name }));
  const paymentRails = paymentVendors.map((item) => item.name);
  const paymentConcentration = fromCount(payments.length);
  const technologyConcentration = fromCount(hosting.length);
  const supplierConcentration = fromCount(critical.length);

  const signals: FinanceSignal[] = [
    {
      id: "payment_rails",
      label: "Payment rails",
      value: paymentRails.length ? paymentRails.join(", ") : "None observed",
      trustStatus: paymentRails.length ? "observed" : "unknown",
      note: paymentRails.length
        ? "Observed on the public site or in package manifests. Share of transactions is UNKNOWN."
        : "No payment processor was observed. Transaction dependency is UNKNOWN.",
    },
    {
      id: "payment_concentration",
      label: "Payment concentration",
      value: BAND_LABEL[paymentConcentration],
      trustStatus: payments.length ? "inferred" : "unknown",
      note:
        payments.length === 1
          ? "A single observed rail is a revenue-path concentration until a second rail is attested."
          : payments.length
            ? "More than one rail was observed. Failover is still unattested."
            : "Cannot infer payment concentration without an observed rail.",
    },
    {
      id: "supplier_concentration",
      label: "Supplier concentration",
      value: BAND_LABEL[supplierConcentration],
      trustStatus: critical.length ? "inferred" : "unknown",
      note: critical.length
        ? `${critical.length} high or critical vendors sit on production or data paths.`
        : "Critical supplier set is UNKNOWN until vendors are observed or declared.",
    },
    {
      id: "technology_concentration",
      label: "Technology concentration",
      value: BAND_LABEL[technologyConcentration],
      trustStatus: hosting.length ? "inferred" : "unknown",
      note: hosting.length
        ? `${hosting.map((item) => item.name).join(", ")} hosting the public application.`
        : "Hosting dependency is UNKNOWN.",
    },
    {
      id: "customer_concentration",
      label: "Customer concentration",
      value: BAND_LABEL[attested.customerConcentration],
      trustStatus: attested.customerConcentration === "unknown" ? "unknown" : "observed",
      note:
        attested.customerConcentration === "unknown"
          ? "Not attested. VERIQ will not invent a revenue split."
          : "Attested band only — no customer names or amounts are stored.",
    },
    {
      id: "liquidity",
      label: "Liquidity posture",
      value:
        attested.liquidity === "unknown"
          ? "Unknown"
          : attested.liquidity === "tight"
            ? "Tight"
            : attested.liquidity === "adequate"
              ? "Adequate"
              : "Strong",
      trustStatus: attested.liquidity === "unknown" ? "unknown" : "observed",
      note:
        attested.liquidity === "unknown"
          ? "Cash, runway and reserves are UNKNOWN. This is not an accounting system."
          : "Qualitative posture attested by the company. Not a cash figure.",
    },
    {
      id: "revenue_mix",
      label: "Revenue mix",
      value:
        attested.revenueMix === "unknown"
          ? "Unknown"
          : attested.revenueMix === "transactions"
            ? "Transactions"
            : attested.revenueMix === "subscriptions"
              ? "Subscriptions"
              : "Mixed",
      trustStatus: attested.revenueMix === "unknown" ? "unknown" : "observed",
      note: "How money arrives, not how much.",
    },
  ];

  const documents = input.documents ?? [];
  const amounts: ExtractedAmount[] = documents.flatMap((doc) =>
    extractAmounts(doc.extractedText, doc.kind, doc.filename),
  );
  const health = assessFinancialHealth({
    industry: input.industry,
    amounts,
    documentKinds: documents.map((doc) => doc.kind),
  });

  const unknowns: string[] = [];
  if (!paymentRails.length) unknowns.push("Payment processor / transaction rail");
  if (attested.customerConcentration === "unknown") unknowns.push("Customer concentration");
  if (attested.liquidity === "unknown" && health.ratios.find((row) => row.id === "inflows")?.status !== "computed") {
    unknowns.push("Liquidity / cash runway");
  }
  if (attested.revenueMix === "unknown") unknowns.push("Revenue mix");
  if (attested.singleSite === "unknown") unknowns.push("Single-site operations");
  if (attested.keyPerson === "unknown") unknowns.push("Key-person dependency");
  if (attested.secondaryPaymentRail === "unknown") {
    unknowns.push("Secondary payment rail");
  }
  if (!amounts.some((row) => row.metric === "revenue")) unknowns.push("Revenue amount");
  if (!amounts.some((row) => row.metric === "inflows")) unknowns.push("Transaction volume");

  let posture = 70;
  if (paymentConcentration === "high") posture -= 12;
  if (supplierConcentration === "high") posture -= 8;
  if (technologyConcentration === "high") posture -= 8;
  if (attested.customerConcentration === "high") posture -= 12;
  if (attested.liquidity === "tight") posture -= 10;
  if (attested.customerConcentration === "high" && paymentConcentration === "high") posture -= 8;
  if (!attestedComplete(attested)) posture -= 6;
  const financialIndustry = ["fintech", "financial_services", "insurance"].includes(
    input.industry,
  );
  if (financialIndustry && !paymentRails.length) posture -= 8;
  posture = Math.max(18, Math.min(92, posture));

  const summaryParts: string[] = [];
  if (paymentRails.length === 1) {
    summaryParts.push(`Revenue path depends on ${paymentRails[0]}.`);
  } else if (paymentRails.length > 1) {
    summaryParts.push(`${paymentRails.length} payment rails observed.`);
  } else if (financialIndustry) {
    summaryParts.push("A financial-industry company with no observed payment rail.");
  }
  if (attested.customerConcentration === "high") {
    summaryParts.push("Customer concentration is attested as high.");
  }
  if (attested.liquidity === "tight") {
    summaryParts.push("Liquidity is attested as tight.");
  }
  if (!summaryParts.length) {
    summaryParts.push(
      "Financial risk is mostly UNKNOWN. VERIQ interprets signals — it does not replace the ledger.",
    );
  }

  return {
    attested,
    signals,
    paymentRails,
    paymentVendors,
    paymentConcentration,
    supplierConcentration,
    technologyConcentration,
    unknowns,
    posture,
    summary: `${summaryParts.join(" ")} ${health.summary}`,
    health,
  };
}
