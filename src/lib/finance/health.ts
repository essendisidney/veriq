import { formatKes, variancePct, type ExtractedAmount, type MoneyMetric } from "@/lib/acquire/money";
import { missingForPack, packForIndustry, type SectorPackId } from "@/lib/packs/sector";
import { assessTransactions, type TxnPattern } from "@/lib/finance/transactions";

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
  transactions?: { lines: number; patterns: TxnPattern[]; summary: string };
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
  documents?: { kind: string; filename: string; extractedText: string | null }[];
}): FinancialHealth {
  const pack = packForIndustry(input.industry);
  const revenue = amount(input.amounts, "revenue");
  const inflows = amount(input.amounts, "inflows");
  const payroll = amount(input.amounts, "payroll");
  const profit = amount(input.amounts, "profit");
  const expenses = amount(input.amounts, "expenses");
  const debt = amount(input.amounts, "debt");
  const equity = amount(input.amounts, "equity");
  const interest = amount(input.amounts, "interest");
  const receivables = amount(input.amounts, "receivables");
  const payables = amount(input.amounts, "payables");
  const cash = amount(input.amounts, "cash");

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
  const debtToEquity =
    debt && equity && equity.amountMinor > 0 ? debt.amountMinor / equity.amountMinor : null;
  const debtToRevenue =
    debt && revenue && revenue.amountMinor > 0 ? debt.amountMinor / revenue.amountMinor : null;
  /** Rough DSCR proxy: operating profit or inflows / interest — only when both exist. */
  const dscrNumerator = profit?.amountMinor ?? inflows?.amountMinor ?? null;
  const dscr =
    dscrNumerator != null && interest && interest.amountMinor > 0
      ? dscrNumerator / interest.amountMinor
      : null;
  const workingCapital =
    receivables || payables || cash
      ? (cash?.amountMinor ?? 0) + (receivables?.amountMinor ?? 0) - (payables?.amountMinor ?? 0)
      : null;
  const wcKnown = Boolean(cash || receivables || payables);

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
      "cash",
      "Cash / bank",
      cash ? cash.amountMinor / 100 : null,
      cash ? formatKes(cash.amountMinor) : "UNKNOWN",
      cash ? [cash.filename] : [],
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
    ratio(
      "working_capital",
      "Working capital (cash + receivables − payables)",
      wcKnown && workingCapital != null ? workingCapital / 100 : null,
      wcKnown && workingCapital != null ? formatKes(workingCapital) : "UNKNOWN",
      [cash?.filename, receivables?.filename, payables?.filename].filter(Boolean) as string[],
    ),
    ratio(
      "dscr",
      "DSCR proxy (profit or inflows / interest)",
      dscr,
      dscr == null ? "UNKNOWN" : dscr.toFixed(2),
      [profit?.filename, inflows?.filename, interest?.filename].filter(Boolean) as string[],
    ),
    ratio(
      "debt_to_equity",
      "Debt / equity",
      debtToEquity,
      debtToEquity == null ? "UNKNOWN" : debtToEquity.toFixed(2),
      [debt?.filename, equity?.filename].filter(Boolean) as string[],
    ),
    ratio(
      "debt_to_revenue",
      "Debt / revenue",
      debtToRevenue,
      debtToRevenue == null ? "UNKNOWN" : debtToRevenue.toFixed(2),
      [debt?.filename, revenue?.filename].filter(Boolean) as string[],
    ),
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
  if (dscr != null && dscr < 1.2) {
    anomalies.push({
      id: "thin-dscr",
      title: "Thin debt-service coverage",
      why: `DSCR proxy ${dscr.toFixed(2)} is below 1.2 from extracted interest and profit/inflows. Pattern requires investigation — not a credit decision.`,
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

  const transactions = assessTransactions({
    texts: (input.documents ?? []).map((doc) => ({
      filename: doc.filename,
      kind: doc.kind,
      text: doc.extractedText,
    })),
  });
  for (const row of transactions.patterns) {
    anomalies.push({
      id: row.id,
      title: row.title,
      why: row.why,
      status: "requires_investigation",
    });
  }
  if (
    input.documentKinds.includes("bank_statement") &&
    inflowFacts.length <= 1 &&
    transactions.lines === 0
  ) {
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
      : `${pack.title}: ${computed} ratio${computed === 1 ? "" : "s"} computed from authorised documents. ${anomalies.length} pattern${anomalies.length === 1 ? "" : "s"} flagged for investigation. ${transactions.summary} Missing inputs stay UNKNOWN — VERIQ does not invent KES.`;

  return {
    packId: pack.id,
    packTitle: pack.title,
    ratios,
    anomalies,
    transactions,
    missing,
    summary,
  };
}
