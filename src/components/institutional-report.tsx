"use client";

import Link from "next/link";
import { Badge, SeverityBadge } from "@/components/ui/badge";
import { formatDateTime, industryLabel, countryLabel } from "@/lib/utils";
import { downloadTextFile, institutionalCsv, slugFile } from "@/lib/reports/export";
import { ExportBar } from "@/components/domain-report";
import type { InstitutionalReport, PillarStatus } from "@/lib/reports/institutional";

const STATUS: Record<
  PillarStatus,
  { label: string; variant: "accent" | "muted" | "warning" | "danger" }
> = {
  strong: { label: "Strong", variant: "accent" },
  adequate: { label: "Adequate", variant: "muted" },
  weak: { label: "Weak", variant: "warning" },
  unknown: { label: "Unknown", variant: "danger" },
};

export function InstitutionalReportView({
  report,
  publicView = false,
}: {
  report: InstitutionalReport;
  publicView?: boolean;
}) {
  const fileBase = `veriq-${report.kind}-${slugFile(report.company.name)}`;

  function downloadJson() {
    downloadTextFile(`${fileBase}.json`, JSON.stringify(report, null, 2), "application/json");
  }

  function downloadCsv() {
    downloadTextFile(`${fileBase}.csv`, institutionalCsv(report), "text/csv;charset=utf-8");
  }

  return (
    <article className="report-print space-y-6">
      <ExportBar
        audience={report.audience}
        generatedAt={report.generatedAt}
        onJson={downloadJson}
        onCsv={downloadCsv}
      />

      <header className="hidden print:block print:mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--accent)]">
          {report.kind === "diligence"
            ? "VERIQ Investor Intelligence"
            : "VERIQ Bank Intelligence"}
        </p>
        <h1 className="mt-2 font-display text-4xl">{report.company.name}</h1>
        <p className="mt-2 text-sm">
          {industryLabel(report.company.industry)} · {countryLabel(report.company.country)}
        </p>
        <p className="mt-1 text-sm">
          {report.kind === "diligence" ? "Company Health Score" : "Business Risk Profile"}{" "}
          {report.healthScore}/100
          {report.scannedAt
            ? ` · As of ${formatDateTime(report.scannedAt)}`
            : ` · Generated ${formatDateTime(report.generatedAt)}`}
        </p>
        {report.overdueCount > 0 && (
          <p className="mt-2 text-sm">
            {report.overdueCount} recommended action{report.overdueCount === 1 ? "" : "s"} past SLA
          </p>
        )}
        <p className="mt-2 text-xs text-[var(--muted)]">{report.audience}</p>
      </header>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
          {report.kind === "diligence" ? "Company Health Score" : "Business Risk Profile"}
        </p>
        <p className="mt-3 font-display text-7xl leading-none">{report.healthScore}</p>
        <p className="mt-1 text-sm text-[var(--muted)]">/ 100</p>
        {report.delta != null && (
          <p className="mt-3 text-sm text-[var(--muted)]">
            {report.delta >= 0 ? "+" : ""}
            {report.delta} versus the previous scan
            {report.previous != null ? ` (${report.previous} → ${report.healthScore})` : ""}
          </p>
        )}
        <p className="mt-4 text-sm leading-7 text-[var(--ink)]">{report.summary}</p>
        {report.staleDays != null && (
          <p className="mt-3 text-sm text-[var(--high)]">
            This snapshot is {report.staleDays} day{report.staleDays === 1 ? "" : "s"} old. Ask the
            company to rescan. VERIQ will not invent a newer score.
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <h2 className="font-display text-2xl">Pillars</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {report.pillars.map((item) => {
            const status = STATUS[item.status];
            return (
              <div
                key={item.key}
                className="rounded-xl border border-[var(--border)] bg-[var(--elevated)] px-4 py-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-[var(--ink)]">{item.label}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{item.score}</span>
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </div>
                </div>
                <p className="mt-2 text-xs leading-5 text-[var(--muted)]">{item.note}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <h2 className="font-display text-2xl">
          {report.kind === "diligence" ? "Diligence flags" : "Credit-relevant flags"}
        </h2>
        {report.flags.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--muted)]">No material flags on this snapshot.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {report.flags.map((item) => (
              <li key={item.id}>
                <FlagRow flag={item} publicView={publicView} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <h2 className="font-display text-2xl">Questions to close</h2>
        <ul className="mt-4 space-y-3">
          {report.questions.map((item) => (
            <li
              key={item.question}
              className="rounded-xl border border-[var(--border)] bg-[var(--elevated)] px-4 py-3"
            >
              <p className="text-sm text-[var(--ink)]">{item.question}</p>
              <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{item.why}</p>
              {item.href && !publicView && (
                <Link
                  href={item.href}
                  className="mt-2 inline-block text-xs text-[var(--accent)] hover:underline print:hidden"
                >
                  Open in VERIQ
                </Link>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <h2 className="font-display text-2xl">Management actions</h2>
        {report.actions.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--muted)]">
            No open recommended actions on this snapshot.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {report.actions.map((item) => (
              <li
                key={item.id}
                className="rounded-xl border border-[var(--border)] bg-[var(--elevated)] px-4 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm text-[var(--ink)]">{item.title}</p>
                  {item.overdue ? (
                    <Badge variant="danger">Overdue</Badge>
                  ) : (
                    <Badge variant="muted">{item.priority}</Badge>
                  )}
                </div>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {item.owner}
                  {item.deadline ? ` · due ${formatDateTime(item.deadline)}` : ""}
                </p>
              </li>
            ))}
          </ul>
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

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
          <h2 className="font-display text-2xl">Regulatory</h2>
          {report.regulatory.length === 0 ? (
            <p className="mt-2 text-sm text-[var(--muted)]">None mapped.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {report.regulatory.map((item) => (
                <li key={item.code} className="flex items-center justify-between gap-3 text-sm">
                  <span>
                    {item.name} <Badge variant="muted">{item.code}</Badge>
                  </span>
                  <span className="text-[var(--muted)]">
                    {item.coverage}% · {item.unknown} unknown
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
          <h2 className="font-display text-2xl">Critical vendors</h2>
          {report.vendors.length === 0 ? (
            <p className="mt-2 text-sm text-[var(--muted)]">No critical vendors mapped.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {report.vendors.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3 text-sm">
                  {publicView ? (
                    <span>{item.name}</span>
                  ) : (
                    <Link href={`/vendors/${item.id}`} className="hover:text-[var(--accent)]">
                      {item.name}
                    </Link>
                  )}
                  <span className="capitalize text-[var(--muted)]">
                    {item.criticality} · {item.risk}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {report.exposure && (
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
          <h2 className="font-display text-2xl">External exposure</h2>
          <p className="mt-2 text-sm">
            Posture {report.exposure.posture}/100 · TLS{" "}
            {report.exposure.tlsDays != null ? `${report.exposure.tlsDays}d` : "UNKNOWN"} · SPF{" "}
            {report.exposure.spf ? "observed" : "not observed"} · DMARC{" "}
            {report.exposure.dmarc ? "observed" : "not observed"}
          </p>
        </section>
      )}

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <h2 className="font-display text-2xl">Financial signals</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{report.finance.summary}</p>
        {report.finance.posture != null && (
          <p className="mt-2 text-sm">Posture {report.finance.posture}/100 · amounts UNKNOWN</p>
        )}
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <h2 className="font-display text-2xl">AI governance</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{report.ai.summary}</p>
        {report.ai.systems.length > 0 && (
          <p className="mt-2 text-sm">{report.ai.systems.join(", ")}</p>
        )}
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <h2 className="font-display text-2xl">External world</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{report.world.summary}</p>
        {report.world.titles.length > 0 && (
          <p className="mt-2 text-sm">{report.world.titles.join(", ")}</p>
        )}
      </section>

      <p className="text-xs leading-5 text-[var(--muted)]">{report.disclaimer}</p>
    </article>
  );
}

function FlagRow({
  flag,
  publicView,
}: {
  flag: InstitutionalReport["flags"][number];
  publicView: boolean;
}) {
  const inner = (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--elevated)] px-4 py-3 hover:border-[var(--accent)]">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-[var(--ink)]">{flag.title}</p>
        {flag.severity === "watch" ? (
          <Badge variant="warning">Watch</Badge>
        ) : (
          <SeverityBadge severity={flag.severity} />
        )}
      </div>
      <p className="mt-1 text-xs text-[var(--muted)]">{flag.detail}</p>
    </div>
  );
  if (!flag.href || publicView) return inner;
  return (
    <Link href={flag.href} className="block">
      {inner}
    </Link>
  );
}
