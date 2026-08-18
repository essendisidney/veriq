import type { AcquisitionAssessment } from "@/lib/acquire/types";
import type { FinancialHealth } from "@/lib/finance/health";

export type TruthDimension = {
  id: string;
  label: string;
  score: number | null;
  why: string;
};

export type TruthScore = {
  overall: number | null;
  dimensions: TruthDimension[];
  critical: number;
  high: number;
  unknown: string[];
  summary: string;
};

function meanKnown(rows: TruthDimension[]) {
  const known = rows.filter((row) => row.score != null) as { score: number }[];
  if (!known.length) return null;
  return Math.round(known.reduce((sum, row) => sum + row.score, 0) / known.length);
}

export function buildTruthScore(input: {
  riskOverall: number;
  cyber: number;
  regulatory: number;
  operational: number;
  vendor: number;
  financial: number;
  data: number;
  acquisition?: AcquisitionAssessment | null;
  health?: FinancialHealth | null;
  conflictCount: number;
}): TruthScore {
  const coverage = input.acquisition?.coverage ?? 0;
  const dataConfidence = input.acquisition?.confidence.overall ?? 0;
  const ownership = input.acquisition?.confidence.ownership ?? 0;
  const healthComputed = input.health?.ratios.filter((row) => row.status === "computed").length ?? 0;
  const liquidityKnown = input.health?.ratios.find((row) => row.id === "inflows")?.status === "computed";
  const anomalyHit = (input.health?.anomalies.length ?? 0) > 0;

  const financialHealth: TruthDimension = {
    id: "financial_health",
    label: "Financial Health",
    score:
      healthComputed === 0
        ? null
        : Math.max(20, Math.min(92, 78 - (anomalyHit ? 18 : 0) - (input.conflictCount > 0 ? 10 : 0))),
    why:
      healthComputed === 0
        ? "No ledger amounts were extracted. Dimension is UNKNOWN, not zero."
        : anomalyHit
          ? "Computed from authorised documents, with patterns that require investigation."
          : "Computed from authorised documents. Still not an audit opinion.",
  };
  const liquidity: TruthDimension = {
    id: "liquidity",
    label: "Liquidity",
    score: liquidityKnown
      ? Math.max(24, Math.min(90, (input.health?.ratios.find((row) => row.id === "inflow_coverage")?.value ?? 0.5) * 80))
      : null,
    why: liquidityKnown
      ? "Inflows vs reported revenue from authorised files."
      : "No bank-statement inflows extracted. UNKNOWN.",
  };
  const dataIntegrity: TruthDimension = {
    id: "data_integrity",
    label: "Data Integrity",
    score: Math.max(18, Math.min(92, dataConfidence - input.conflictCount * 8)),
    why:
      input.conflictCount > 0
        ? `${input.conflictCount} contradiction${input.conflictCount === 1 ? "" : "s"} on the evidence graph.`
        : `Data confidence ${dataConfidence}% from connected sources. Not a clearance.`,
  };
  const governance: TruthDimension = {
    id: "governance",
    label: "Governance",
    score: ownership >= 80 ? 74 : ownership >= 40 ? 58 : null,
    why:
      ownership >= 40
        ? "Ownership artefact present. Board/related-party completeness is still incomplete."
        : "No CR12 / company extract. Governance stays UNKNOWN.",
  };
  const compliance: TruthDimension = {
    id: "compliance",
    label: "Compliance",
    score: input.regulatory,
    why: "From observed regulatory gaps on this scan, not a licence confirmation.",
  };
  const operational: TruthDimension = {
    id: "operational",
    label: "Operational Health",
    score: input.operational,
    why: "From observed operations and vendor paths.",
  };
  const counterparty: TruthDimension = {
    id: "counterparty",
    label: "Counterparty Risk",
    score: input.vendor,
    why: "From observed vendors. Related-party edges require human validation.",
  };
  const cyber: TruthDimension = {
    id: "cyber",
    label: "Cyber / Technology",
    score: input.cyber,
    why: "From the existing scan spine (exposure, stack, secrets).",
  };

  const dimensions = [
    financialHealth,
    governance,
    compliance,
    operational,
    dataIntegrity,
    counterparty,
    cyber,
    liquidity,
  ];
  const overall = meanKnown(dimensions);
  const unknown = dimensions.filter((row) => row.score == null).map((row) => row.label);
  const summary =
    overall == null
      ? "Not enough evidenced dimensions to publish an organisational truth score."
      : `Organizational truth ${overall}/100 from ${dimensions.length - unknown.length} evidenced dimensions. ${unknown.length} stay UNKNOWN. Coverage ${coverage}%.`;

  return {
    overall,
    dimensions,
    critical: input.conflictCount,
    high: input.health?.anomalies.length ?? 0,
    unknown,
    summary,
  };
}
