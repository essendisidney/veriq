import { formatKes, variancePct } from "@/lib/acquire/money";

export type TxnPattern = {
  id: string;
  title: string;
  why: string;
  status: "requires_investigation";
  evidence: string[];
};

export type TxnLine = {
  amountMinor: number;
  counterparty: string | null;
  excerpt: string;
};

const LINE_RE =
  /(?:^|\n)\s*(?:\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?\s+)?([A-Za-z][A-Za-z0-9 &.\-]{2,40})?\s*(?:KES|KSh|Ksh)?\s*([\d]{1,3}(?:,\d{3})+|\d{4,})(?:\.\d{2})?/gim;

function toMinor(raw: string): number | null {
  const n = Number(raw.replace(/,/g, ""));
  if (!Number.isFinite(n) || n < 1_000) return null;
  return Math.round(n * 100);
}

/** Pull discrete credit/debit-looking lines from bank-statement text. No OCR. */
export function extractTxnLines(text: string | null | undefined): TxnLine[] {
  if (!text || text.length < 40) return [];
  const out: TxnLine[] = [];
  const seen = new Set<string>();
  const re = new RegExp(LINE_RE.source, "gim");
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    const amountMinor = toMinor(match[2]!);
    if (amountMinor == null) continue;
    const counterparty = (match[1] ?? "").trim() || null;
    if (counterparty && /revenue|turnover|total|balance|page/i.test(counterparty)) continue;
    const key = `${counterparty ?? ""}:${amountMinor}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      amountMinor,
      counterparty,
      excerpt: match[0].replace(/\s+/g, " ").trim().slice(0, 160),
    });
    if (out.length >= 40) break;
  }
  return out;
}

/**
 * Pattern detection on authorised bank-statement text only.
 * Labels require investigation — never fraud, never AML case status.
 */
export function assessTransactions(input: {
  texts: { filename: string; kind: string; text: string | null }[];
}): { lines: number; patterns: TxnPattern[]; summary: string } {
  const bankDocs = input.texts.filter((row) => row.kind === "bank_statement" && row.text);
  if (!bankDocs.length) {
    return {
      lines: 0,
      patterns: [],
      summary: "No authorised bank-statement text layer. Transaction patterns stay UNKNOWN.",
    };
  }

  const lines: (TxnLine & { filename: string })[] = [];
  for (const doc of bankDocs) {
    for (const line of extractTxnLines(doc.text)) {
      lines.push({ ...line, filename: doc.filename });
    }
  }

  const patterns: TxnPattern[] = [];
  const byAmount = new Map<number, number>();
  for (const line of lines) {
    byAmount.set(line.amountMinor, (byAmount.get(line.amountMinor) ?? 0) + 1);
  }
  for (const [amountMinor, count] of byAmount) {
    if (count < 3) continue;
    const kes = amountMinor / 100;
    if (kes >= 50_000 && kes < 500_000) {
      patterns.push({
        id: `repeat-below-${amountMinor}`,
        title: "Repeated similar credits",
        why: `${count} lines near ${formatKes(amountMinor)} on an authorised statement. Pattern requires investigation — not a structuring finding.`,
        status: "requires_investigation",
        evidence: bankDocs.map((d) => d.filename),
      });
    }
  }

  for (const line of lines) {
    const kes = line.amountMinor / 100;
    if (kes >= 1_000_000 && kes % 1_000_000 === 0) {
      patterns.push({
        id: `round-txn-${line.amountMinor}`,
        title: "Round-number transaction line",
        why: `${formatKes(line.amountMinor)}${line.counterparty ? ` (${line.counterparty})` : ""} is an exact million. Pattern requires investigation — not a fraud finding.`,
        status: "requires_investigation",
        evidence: [line.filename],
      });
    }
  }

  const named = lines.filter((row) => row.counterparty);
  if (named.length >= 4) {
    const byParty = new Map<string, number>();
    for (const row of named) {
      const key = row.counterparty!.toLowerCase();
      byParty.set(key, (byParty.get(key) ?? 0) + row.amountMinor);
    }
    const total = [...byParty.values()].reduce((a, b) => a + b, 0);
    const top = [...byParty.entries()].sort((a, b) => b[1] - a[1])[0];
    if (top && total > 0 && top[1] / total >= 0.45) {
      patterns.push({
        id: "counterparty-concentration",
        title: "Counterparty concentration on statement",
        why: `${Math.round((top[1] / total) * 100)}% of labelled lines concentrate on one counterparty (${top[0]}). Pattern requires investigation.`,
        status: "requires_investigation",
        evidence: bankDocs.map((d) => d.filename),
      });
    }
  }

  if (lines.length >= 2) {
    const sorted = lines.slice().sort((a, b) => a.amountMinor - b.amountMinor);
    for (let i = 0; i < sorted.length; i += 1) {
      for (let j = i + 1; j < sorted.length; j += 1) {
        const pct = variancePct(sorted[i].amountMinor, sorted[j].amountMinor);
        if (pct < 1 && sorted[i].amountMinor === sorted[j].amountMinor && sorted[i].counterparty && sorted[j].counterparty) {
          if (sorted[i].counterparty!.toLowerCase() !== sorted[j].counterparty!.toLowerCase()) continue;
        }
      }
    }
  }

  const unique = patterns.filter(
    (row, i, all) => all.findIndex((item) => item.id === row.id) === i,
  );

  const summary =
    lines.length === 0
      ? "Bank statement uploaded but no discrete transaction lines were parseable. Pattern tests stay UNKNOWN — not OCR."
      : `${lines.length} labelled line${lines.length === 1 ? "" : "s"} from authorised statements. ${unique.length} pattern${unique.length === 1 ? "" : "s"} require investigation. Not an AML case file.`;

  return { lines: lines.length, patterns: unique.slice(0, 12), summary };
}
