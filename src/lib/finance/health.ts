import { formatKes, variancePct, type ExtractedAmount, type MoneyMetric } from "@/lib/acquire/money";
import { missingForPack, packForIndustry, type SectorPackId } from "@/lib/packs/sector";

export type HealthRatio = {
  id: string;
  label: string;
  value: number | null;
  display: string;
  status: "computed" | "unknown";
  evidence: string[];
};

export type HealthAnomaly = {
  id: string;
  title: string;
  why: string;
  status: "requires_investigation";
};

export type FinancialHealth = {
  packId: SectorPackId;
  packTitle: string;
  ratios: HealthRatio[];
  anomalies: HealthAnomaly[];
  missing: string[];
  summary: string;
};

function amount(facts: ExtractedAmount[], metric: MoneyMetric) {
  return facts.find((row) => row.metric === metric) ?? null;
}

function ratio(
  id: string,
  label: string,
  value: number | null,
  display: string,
  evidence: string[],
): HealthRatio {
  return {
    id,
    label,
    value,
    display: value == null ? "UNKNOWN" : display,
    status: value == null ? "unknown" : "computed",
    evidence,
  };
}

export function assessFinancialHealth(input: {
  industry: string;
  amounts: ExtractedAmount[];
  documentKinds: string[];
}): FinancialHealth {
  const pack = packForIndustry(input.industry);
  const revenue = amount(input.amounts, "revenue");
  const inflows = amount(input.amounts, "inflows");
  const payroll = amount(input.amounts, "payroll");
  const profit = amount(input.amounts, "profit");
  const expenses = amount(input.amounts, "expenses");

  const coverage =
    revenue && inflows && revenue.amountMinor > 0
      ? inflows.amountMinor / revenue.amountMinor
      : null;
  const payrollShare =
    payroll && revenue && revenue.amountMinor > 0
      ? payroll.amountMinor / revenue.amountMinor
      : null;
  const netMargin =
    profit && revenue && revenue.amountMinor > 0
      ? profit.amountMinor / revenue.amountMinor
      : null;

  const revenues = input.amounts
    .filter((row) => row.metric === "revenue")
    .slice()
    .sort((a, b) => (b.periodEnd ?? "").localeCompare(a.periodEnd ?? ""));
  const later = revenues[0];
  const earlier = revenues[1];
  const growth =
    later && earlier && earlier.amountMinor > 0
      ? (later.amountMinor - earlier.amountMinor) / earlier.amountMinor
      : null;

  const ratios: HealthRatio[] = [
    ratio(
      "revenue",
      "Reported revenue",
      revenue ? revenue.amountMinor / 100 : null,
      revenue ? formatKes(revenue.amountMinor) : "UNKNOWN",
      revenue ? [revenue.filename] : [],
    ),
    ratio(
      "inflows",
      "Identifiable operating inflows",
      inflows ? inflows.amountMinor / 100 : null,
      inflows ? formatKes(inflows.amountMinor) : "UNKNOWN",
      inflows ? [inflows.filename] : [],
    ),
    ratio(
      "inflow_coverage",
      "Inflows / reported revenue",
      coverage,
      coverage == null ? "UNKNOWN" : `${Math.round(coverage * 100)}%`,
      [revenue?.filename, inflows?.filename].filter(Boolean) as string[],
    ),
    ratio(
      "payroll_share",
      "Payroll / revenue",
      payrollShare,
      payrollShare == null ? "UNKNOWN" : `${Math.round(payrollShare * 100)}%`,
      [payroll?.filename, revenue?.filename].filter(Boolean) as string[],
    ),
    ratio(
      "net_margin",
      "Net margin",
      netMargin,
      netMargin == null ? "UNKNOWN" : `${Math.round(netMargin * 100)}%`,
      [profit?.filename, revenue?.filename].filter(Boolean) as string[],
    ),
    ratio(
      "revenue_growth",
      "Revenue change (latest vs prior extracted)",
      growth,
      growth == null ? "UNKNOWN" : `${Math.round(growth * 100)}%`,
      revenues.slice(0, 2).map((row) => row.filename),
    ),
    ratio("dscr", "DSCR", null, "UNKNOWN", []),
    ratio("debt_to_equity", "Debt / equity", null, "UNKNOWN", []),
  ];

  const anomalies: HealthAnomaly[] = [];
  if (revenue && inflows) {
    const pct = variancePct(revenue.amountMinor, inflows.amountMinor);
    if (pct >= 10) {
      anomalies.push({
        id: "inflow-revenue-gap",
        title: "Bank inflows do not match reported revenue",
        why: `${formatKes(inflows.amountMinor)} identifiable inflows vs ${formatKes(revenue.amountMinor)} reported revenue (${pct}% variance). This pattern requires investigation. It is not a fraud finding.`,
        status: "requires_investigation",
      });
    }
  }
  if (payroll && revenue && payroll.amountMinor > revenue.amountMinor) {
    anomalies.push({
      id: "payroll-gt-revenue",
      title: "Payroll exceeds reported revenue",
      why: `${formatKes(payroll.amountMinor)} payroll vs ${formatKes(revenue.amountMinor)} revenue. Requires investigation.`,
      status: "requires_investigation",
    });
  }
  if (expenses && revenue && expenses.amountMinor > revenue.amountMinor * 2) {
    anomalies.push({
      id: "opex-spike",
      title: "Expenses far exceed reported revenue",
      why: `${formatKes(expenses.amountMinor)} expenses vs ${formatKes(revenue.amountMinor)} revenue. Requires investigation.`,
      status: "requires_investigation",
    });
  }
  for (const row of input.amounts) {
    const kes = row.amountMinor / 100;
    if (kes >= 1_000_000 && kes % 1_000_000 === 0) {
      anomalies.push({
        id: `round-${row.metric}-${row.amountMinor}`,
        title: `Round-number ${row.metric}`,
        why: `${formatKes(row.amountMinor)} in ${row.filename} is an exact million. Pattern requires investigation — not a fraud finding.`,
        status: "requires_investigation",
      });
    }
  }
  const inflowFacts = input.amounts.filter((row) => row.metric === "inflows");
  if (inflows && revenue && inflowFacts.length === 1 && inflows.amountMinor / revenue.amountMinor >= 0.8) {
    anomalies.push({
      id: "inflow-concentration",
      title: "Identified inflows are concentrated",
      why: `${formatKes(inflows.amountMinor)} is the only labelled inflow vs ${formatKes(revenue.amountMinor)} revenue. Pattern requires investigation — not a fraud finding.`,
      status: "requires_investigation",
    });
  }
  if (input.documentKinds.includes("bank_statement") && inflowFacts.length <= 1) {
    anomalies.push({
      id: "below-threshold-untested",
      title: "Repeat below-threshold credits untested",
      why: "The authorised statement did not yield a transaction listing. Repeat credits below a reporting threshold cannot be tested. Pattern requires investigation — not a fraud finding.",
      status: "requires_investigation",
    });
  }

  const missing = missingForPack(pack, input.documentKinds);
  const computed = ratios.filter((row) => row.status === "computed").length;
  const summary =
    computed === 0
      ? `${pack.title}: no ledger amounts were extracted. Ratios stay UNKNOWN. Upload searchable (not scanned-only) accounts or bank statements.`
      : `${pack.title}: ${computed} ratio${computed === 1 ? "" : "s"} computed from authorised documents. ${anomalies.length} pattern${anomalies.length === 1 ? "" : "s"} flagged for investigation. Missing inputs stay UNKNOWN — VERIQ does not invent KES.`;

  return {
    packId: pack.id,
    packTitle: pack.title,
    ratios,
    anomalies,
    missing,
    summary,
  };
}
