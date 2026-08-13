"use client";

import Link from "next/link";
import { Badge, SeverityBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateTime, industryLabel, countryLabel } from "@/lib/utils";
import { downloadTextFile, slugFile, toCsv } from "@/lib/reports/export";
import type { DomainReport } from "@/lib/reports/domain";

export function DomainReportView({ report }: { report: DomainReport }) {
  const fileBase = `veriq-${report.kind}-${slugFile(report.company.name)}`;

  function downloadJson() {
    downloadTextFile(`${fileBase}.json`, JSON.stringify(report, null, 2), "application/json");
  }

  function downloadCsv() {
    const rows: string[][] = [
      ["Metric", "Value"],
      ...report.metrics.map((item) => [item.label, item.value]),
      [],
      report.table.columns,
      ...report.table.records,
    ];
    downloadTextFile(`${fileBase}.csv`, toCsv(rows), "text/csv;charset=utf-8");
  }

  return (
    <article className="report-print space-y-6">
      <ExportBar
        audience={report.audience}
        generatedAt={report.generatedAt}
        onJson={downloadJson}
        onCsv={downloadCsv}
      />
      <p className="hidden text-xs text-[var(--muted)] print:block">
        {industryLabel(report.company.industry)} · {countryLabel(report.company.country)} ·{" "}
        {formatDateTime(report.generatedAt)}
      </p>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">{report.scoreLabel}</p>
        <p className="mt-3 font-display text-7xl leading-none">{report.score ?? "—"}</p>
        <p className="mt-1 text-sm text-[var(--muted)]">/ 100</p>
        <p className="mt-4 text-sm leading-7 text-[var(--ink)]">{report.summary}</p>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <h2 className="font-display text-2xl">Snapshot</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {report.metrics.map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-[var(--border)] bg-[var(--elevated)] px-4 py-3"
            >
              <p className="text-xs uppercase tracking-wide text-[var(--muted)]">{item.label}</p>
              <p className="mt-1 text-sm text-[var(--ink)]">{item.value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <h2 className="font-display text-2xl">Flags</h2>
        {report.flags.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--muted)]">No material flags in this cut.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {report.flags.map((item) => (
              <li key={item.id}>
                <Link href={item.href ?? "/findings"} className="block">
                  <div className="rounded-xl border border-[var(--border)] bg-[var(--elevated)] px-4 py-3 hover:border-[var(--accent)]">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm text-[var(--ink)]">{item.title}</p>
                      {item.severity === "watch" ? (
                        <Badge variant="warning">Watch</Badge>
                      ) : (
                        <SeverityBadge severity={item.severity} />
                      )}
                    </div>
                    <p className="mt-1 text-xs text-[var(--muted)]">{item.detail}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <h2 className="font-display text-2xl">{report.table.title}</h2>
        {report.table.records.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--muted)]">Nothing to list on this snapshot.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-[var(--muted)]">
                  {report.table.columns.map((col) => (
                    <th key={col} className="border-b border-[var(--border)] pb-2 pr-4 font-medium">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.table.records.map((row, index) => (
                  <tr key={`${row[0]}-${index}`}>
                    {row.map((cell, cellIndex) => (
                      <td
                        key={`${cellIndex}-${cell.slice(0, 24)}`}
                        className="border-b border-[var(--border)] py-2 pr-4 text-[var(--ink)]"
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <h2 className="font-display text-2xl">Still UNKNOWN</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {report.unknowns.map((item) => (
            <Badge key={item} variant="muted">
              {item}
            </Badge>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <h2 className="font-display text-2xl">Open actions</h2>
        {report.actions.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--muted)]">No open actions.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {report.actions.map((item) => (
              <li
                key={item.title}
                className="rounded-xl border border-[var(--border)] bg-[var(--elevated)] px-4 py-3 text-sm"
              >
                {item.title}
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {item.owner} · {item.priority}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-xs leading-5 text-[var(--muted)]">{report.disclaimer}</p>
    </article>
  );
}

export function ExportBar({
  audience,
  generatedAt,
  onJson,
  onCsv,
}: {
  audience: string;
  generatedAt: string;
  onJson: () => void;
  onCsv: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
      <p className="text-xs text-[var(--muted)]">
        {audience} · Generated {formatDateTime(generatedAt)}
      </p>
      <div className="flex gap-2">
        <Button variant="secondary" onClick={onCsv}>
          Export CSV
        </Button>
        <Button variant="secondary" onClick={onJson}>
          Export JSON
        </Button>
        <Button onClick={() => window.print()}>Print / PDF</Button>
      </div>
    </div>
  );
}
