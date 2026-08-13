"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge, SeverityBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScanButton } from "@/components/scan-button";
import {
  countryLabel,
  formatDateTime,
  industryLabel,
} from "@/lib/utils";
import { buildBoardReport, type BoardReport } from "@/lib/reports/board";
import { simulateScenarios } from "@/lib/scenarios/simulate";
import { assessFinance, DEFAULT_ATTESTED, type FinanceAssessment } from "@/lib/finance/assess";
import type { AiAssessment } from "@/lib/ai/assess";
import type { ChangeSet } from "@/lib/changes/diff";
import type { WorldAssessment } from "@/lib/world/assess";
import type { Action, Risk, Score } from "@/lib/database.types";
import type { Exposure } from "@/lib/scan/exposure";
import type { RegulationAssessment } from "@/lib/regulations/assess";
import type { VendorMap } from "@/lib/vendors/assess";
import type { RiskGraph } from "@/lib/graph/build";

export default function BoardReportPage() {
  const { currentOrg } = useWorkspace();
  const [report, setReport] = useState<BoardReport | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!currentOrg) return;
    async function load() {
      const supabase = createClient();
      const orgId = currentOrg!.id;
      const [{ data: scores }, { data: topRisks }, { data: openActions }, { data: scans }] =
        await Promise.all([
          supabase
            .from("scores")
            .select("*")
            .eq("organization_id", orgId)
            .order("created_at", { ascending: false })
            .limit(2),
          supabase
            .from("risks")
            .select("*")
            .eq("organization_id", orgId)
            .eq("status", "open")
            .order("created_at", { ascending: false })
            .limit(20),
          supabase
            .from("actions")
            .select("*")
            .eq("organization_id", orgId)
            .eq("status", "open")
            .limit(10),
          supabase
            .from("scans")
            .select("summary")
            .eq("organization_id", orgId)
            .eq("status", "completed")
            .order("created_at", { ascending: false })
            .limit(2),
        ]);

      const latest = scans?.[0]?.summary as
        | {
            exposure?: Exposure;
            regulatory?: RegulationAssessment[];
            vendors?: VendorMap;
            graph?: RiskGraph;
            finance?: FinanceAssessment;
            ai?: AiAssessment;
            changes?: ChangeSet;
            world?: WorldAssessment;
            risks?: number;
          }
        | undefined;
      const previousSummary = scans?.[1]?.summary as { risks?: number } | undefined;
      const vendors = latest?.vendors ?? null;
      const regulatory = latest?.regulatory ?? [];
      const finance =
        latest?.finance ??
        assessFinance({
          vendors,
          industry: currentOrg!.industry,
          attested: DEFAULT_ATTESTED,
        });
      const ai = latest?.ai ?? null;
      const graph = latest?.graph ?? null;
      const scenarios = simulateScenarios({
        graph,
        vendors,
        assessments: regulatory,
      });

      setReport(
        buildBoardReport({
          name: currentOrg!.name,
          industry: currentOrg!.industry,
          country: currentOrg!.country,
          score: (scores?.[0] as Score) ?? null,
          previous: (scores?.[1] as Score) ?? null,
          risks: (topRisks as Risk[]) ?? [],
          actions: (openActions as Action[]) ?? [],
          previousRiskCount: previousSummary?.risks ?? null,
          regulatory,
          vendors,
          finance,
          ai,
          changelog: latest?.changes ?? null,
          world: latest?.world ?? null,
          graph,
          scenarios,
        }),
      );
      setLoaded(true);
    }
    void load();
  }, [currentOrg]);

  function downloadJson() {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `veriq-board-report-${report.company.name.toLowerCase().replace(/\s+/g, "-")}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (!currentOrg) return null;

  return (
    <div className="report-print">
      <PageHeader
        title="Board risk report"
        description={`${industryLabel(currentOrg.industry)} · ${countryLabel(currentOrg.country)}`}
        actions={
          <div className="flex gap-2 print:hidden">
            <Button variant="secondary" onClick={downloadJson} disabled={!report}>
              Export JSON
            </Button>
            <Button onClick={() => window.print()} disabled={!report}>
              Print / PDF
            </Button>
          </div>
        }
      />

      {!loaded ? (
        <p className="text-sm text-[var(--muted)]">Assembling the report…</p>
      ) : !report ? (
        <EmptyState
          icon={FileText}
          title="No scan to report"
          description="Run a scan first. The board report is assembled from evidence, not invented."
          action={<ScanButton organizationId={currentOrg.id} />}
        />
      ) : (
        <article className="space-y-6">
          <p className="text-xs text-[var(--muted)]">
            Generated {formatDateTime(report.generatedAt)} · VERIQ Score {report.score.overall}
            {report.score.delta != null
              ? ` · ${report.score.delta >= 0 ? "+" : ""}${report.score.delta} vs last scan`
              : ""}
          </p>

          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h2 className="font-display text-2xl">Executive summary</h2>
            <p className="mt-3 text-sm leading-7 text-[var(--ink)]">{report.summary}</p>
          </section>

          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h2 className="font-display text-2xl">Score</h2>
            <p className="mt-2 font-display text-6xl">{report.score.overall}</p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {report.score.dimensions.map((dim) => (
                <div
                  key={dim.key}
                  className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--elevated)] px-4 py-2 text-sm"
                >
                  <span>{dim.label}</span>
                  <span>
                    {dim.value}
                    {dim.delta != null ? (
                      <span className="ml-2 text-xs text-[var(--muted)]">
                        {dim.delta >= 0 ? "+" : ""}
                        {dim.delta}
                      </span>
                    ) : null}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h2 className="font-display text-2xl">Top changes</h2>
            <ul className="mt-4 space-y-2">
              {report.changes.map((item) => (
                <li
                  key={item.label + item.detail}
                  className="rounded-xl border border-[var(--border)] bg-[var(--elevated)] px-4 py-3"
                >
                  <p className="text-sm text-[var(--ink)]">{item.label}</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">{item.detail}</p>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h2 className="font-display text-2xl">Critical and high risks</h2>
            {report.criticalRisks.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--muted)]">No critical or high open findings.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {report.criticalRisks.map((risk) => (
                  <li key={risk.id}>
                    <Link
                      href={`/findings/${risk.id}`}
                      className="block rounded-xl border border-[var(--border)] bg-[var(--elevated)] px-4 py-3 hover:border-[var(--accent)]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm text-[var(--ink)]">{risk.title}</p>
                        <SeverityBadge severity={risk.severity} />
                      </div>
                      <p className="mt-1 text-xs text-[var(--muted)]">{risk.why_it_matters}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h2 className="font-display text-2xl">Board questions</h2>
            <ul className="mt-4 space-y-3">
              {report.questions.map((item) => (
                <li
                  key={item.question}
                  className="rounded-xl border border-[var(--border)] bg-[var(--elevated)] px-4 py-3"
                >
                  <p className="text-sm text-[var(--ink)]">{item.question}</p>
                  <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{item.why}</p>
                  {item.href && (
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

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
              <h2 className="font-display text-2xl">Regulatory alerts</h2>
              {report.regulatory.length === 0 ? (
                <p className="mt-2 text-sm text-[var(--muted)]">None mapped.</p>
              ) : (
                <ul className="mt-4 space-y-2">
                  {report.regulatory.map((item) => (
                    <li key={item.code} className="flex items-center justify-between gap-3 text-sm">
                      <span>
                        {item.name}{" "}
                        <Badge variant="muted">{item.code}</Badge>
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
              <h2 className="font-display text-2xl">Vendor alerts</h2>
              {report.vendors.length === 0 ? (
                <p className="mt-2 text-sm text-[var(--muted)]">No critical vendors mapped.</p>
              ) : (
                <ul className="mt-4 space-y-2">
                  {report.vendors.map((item) => (
                    <li key={item.id} className="flex items-center justify-between gap-3 text-sm">
                      <Link href={`/vendors/${item.id}`} className="hover:text-[var(--accent)]">
                        {item.name}
                      </Link>
                      <span className="capitalize text-[var(--muted)]">
                        {item.criticality} · {item.risk}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h2 className="font-display text-2xl">Correlated paths</h2>
            {report.paths.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--muted)]">No correlated paths in this scan.</p>
            ) : (
              <ul className="mt-4 space-y-2">
                {report.paths.map((path) => (
                  <li
                    key={path.title}
                    className="rounded-xl border border-[var(--border)] bg-[var(--elevated)] px-4 py-3"
                  >
                    <p className="text-sm text-[var(--ink)]">{path.title}</p>
                    <p className="mt-1 text-xs text-[var(--muted)]">{path.reason}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h2 className="font-display text-2xl">Financial signals</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{report.finance.summary}</p>
            {report.finance.posture != null && (
              <p className="mt-2 text-sm">Posture {report.finance.posture}/100 · amounts UNKNOWN</p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              {report.finance.unknowns.map((item) => (
                <Badge key={item} variant="muted">
                  {item}
                </Badge>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h2 className="font-display text-2xl">AI governance</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{report.ai.summary}</p>
            {report.ai.posture != null && (
              <p className="mt-2 text-sm">
                Posture {report.ai.posture}/100
                {report.ai.systems.length ? ` · ${report.ai.systems.join(", ")}` : ""}
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              {report.ai.unknowns.map((item) => (
                <Badge key={item} variant="muted">
                  {item}
                </Badge>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h2 className="font-display text-2xl">External world</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{report.world.summary}</p>
            {report.world.material > 0 && (
              <p className="mt-2 text-sm">
                {report.world.material} material
                {report.world.titles.length ? ` · ${report.world.titles.join(", ")}` : ""}
              </p>
            )}
          </section>

          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h2 className="font-display text-2xl">Management actions</h2>
            {report.actions.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--muted)]">No open actions.</p>
            ) : (
              <ul className="mt-4 space-y-2">
                {report.actions.map((action) => (
                  <li
                    key={action.id}
                    className="rounded-xl border border-[var(--border)] bg-[var(--elevated)] px-4 py-3 text-sm"
                  >
                    {action.title}
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      {action.owner_role ?? "Unassigned"} · {action.priority}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <p className="text-xs leading-5 text-[var(--muted)]">{report.disclaimer}</p>
        </article>
      )}
    </div>
  );
}
