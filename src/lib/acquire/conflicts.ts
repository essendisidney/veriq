import type { FactConflict, FactObservation } from "@/lib/acquire/types";
import { formatKes, variancePct } from "@/lib/acquire/money";

function moneyFacts(observations: FactObservation[]) {
  return observations.filter(
    (row) => row.amountMinor != null && row.amountMinor > 0 && row.claim.startsWith("money:"),
  );
}

/** Same metric, two authorised sources, different amounts → conflict. Never a fraud label. */
export function moneyConflicts(observations: FactObservation[]): FactConflict[] {
  const byClaim = new Map<string, FactObservation[]>();
  for (const row of moneyFacts(observations)) {
    const list = byClaim.get(row.claim) ?? [];
    list.push(row);
    byClaim.set(row.claim, list);
  }
  const conflicts: FactConflict[] = [];
  for (const [claim, rows] of byClaim) {
    for (let i = 0; i < rows.length; i += 1) {
      for (let j = i + 1; j < rows.length; j += 1) {
        const left = rows[i];
        const right = rows[j];
        if (left.amountMinor === right.amountMinor) continue;
        if (left.sourceType === right.sourceType && left.sourceRef === right.sourceRef) continue;
        const pct = variancePct(left.amountMinor!, right.amountMinor!);
        if (pct < 2) continue;
        conflicts.push({
          claim,
          left,
          right,
          why: `${formatKes(left.amountMinor!)} (${left.sourceType}) vs ${formatKes(right.amountMinor!)} (${right.sourceType}) — ${pct}% variance. Requires validation. Not a fraud finding.`,
          variancePct: pct,
        });
      }
    }
  }
  return conflicts;
}
