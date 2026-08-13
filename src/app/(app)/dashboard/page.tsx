"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Radar, ShieldAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { SeverityBadge, Badge } from "@/components/ui/badge";
import { ScanButton } from "@/components/scan-button";
import {
  SCORE_DIMENSIONS,
  countryLabel,
  formatDateTime,
  industryLabel,
  scoreTone,
} from "@/lib/utils";
import type { Action, Risk, Score } from "@/lib/database.types";
import type { Exposure } from "@/lib/scan/exposure";
import type { RegulationAssessment } from "@/lib/regulations/assess";
import type { VendorMap } from "@/lib/vendors/assess";
import type { RiskGraph } from "@/lib/graph/build";
import { simulateScenarios } from "@/lib/scenarios/simulate";
import { assessFinance, DEFAULT_ATTESTED, type FinanceAssessment } from "@/lib/finance/assess";
import type { AiAssessment } from "@/lib/ai/assess";
import type { ChangeSet } from "@/lib/changes/diff";
import type { WorldAssessment } from "@/lib/world/assess";
import { isScanDue, parseCadence, type ScanCadence } from "@/lib/webhooks/cadence";
import { isOverdue } from "@/lib/risk/certainty";

export default function DashboardPage() {
  const { currentOrg } = useWorkspace();
  const [score, setScore] = useState<Score | null>(null);
  const [previous, setPrevious] = useState<Score | null>(null);
  const [risks, setRisks] = useState<Risk[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [exposure, setExposure] = useState<Exposure | null>(null);
  const [regulatory, setRegulatory] = useState<RegulationAssessment[]>([]);
  const [vendors, setVendors] = useState<VendorMap | null>(null);
  const [graph, setGraph] = useState<RiskGraph | null>(null);
  const [finance, setFinance] = useState<FinanceAssessment | null>(null);
  const [ai, setAi] = useState<AiAssessment | null>(null);
  const [changes, setChanges] = useState<ChangeSet | null>(null);
  const [world, setWorld] = useState<WorldAssessment | null>(null);
  const [scanDue, setScanDue] = useState(false);
  const [cadence, setCadence] = useState<ScanCadence>("off");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentOrg) return;

    async function load() {
      const supabase = createClient();
      const orgId = currentOrg!.id;
      const [{ data: scores }, { data: topRisks }, { data: openActions }, { data: scans }, { data: monitoring }] =
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
            .limit(8),
          supabase
            .from("actions")
            .select("*")
            .eq("organization_id", orgId)
            .eq("status", "open")
            .limit(6),
          supabase
            .from("scans")
            .select("summary")
            .eq("organization_id", orgId)
            .eq("status", "completed")
            .order("created_at", { ascending: false })
            .limit(1),
          supabase
            .from("assets")
            .select("metadata")
            .eq("organization_id", orgId)
            .eq("type", "monitoring")
            .eq("name", "Monitoring")
            .maybeSingle(),
        ]);

      setScore(scores?.[0] ?? null);
      setPrevious(scores?.[1] ?? null);
      setRisks((topRisks as Risk[]) ?? []);
      setActions((openActions as Action[]) ?? []);
      const summary = scans?.[0]?.summary as
        | {
            exposure?: Exposure;
            regulatory?: RegulationAssessment[];
            vendors?: VendorMap;
            graph?: RiskGraph;
            finance?: FinanceAssessment;
            ai?: AiAssessment;
            changes?: ChangeSet;
            world?: WorldAssessment;
          }
        | undefined;
      setExposure(summary?.exposure ?? null);
      setRegulatory(summary?.regulatory ?? []);
      setVendors(summary?.vendors ?? null);
      setGraph(summary?.graph ?? null);
      setFinance(
        summary?.finance ??
          assessFinance({
            vendors: summary?.vendors ?? null,
            industry: currentOrg!.industry,
            attested: DEFAULT_ATTESTED,
          }),
      );
      setAi(summary?.ai ?? null);
      setChanges(summary?.changes ?? null);
      setWorld(summary?.world ?? null);
      const monitoringMeta = (monitoring?.metadata ?? null) as {
        cadence?: string;
        nextDueAt?: string;
      } | null;
      setCadence(parseCadence(monitoringMeta?.cadence));
      setScanDue(isScanDue(monitoringMeta));
      setLoading(false);
    }

    void load();
  }, [currentOrg]);

  if (!currentOrg) return null;

  const orderedRisks = [...risks].sort((a, b) => {
    const rank = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3,
      informational: 4,
    };
    return rank[a.severity] - rank[b.severity];
  });

  const delta =
    score && previous ? score.overall - previous.overall : null;
  const tone = score ? scoreTone(score.overall) : "ok";
  const toneColor =
    tone === "good"
      ? "var(--good)"
      : tone === "ok"
        ? "var(--low)"
        : tone === "warn"
          ? "var(--medium)"
          : "var(--critical)";

  const topScenarios = simulateScenarios({
    graph,
    vendors,
    assessments: regulatory,
  }).slice(0, 3);
  const overdueActions = actions.filter((item) => isOverdue(item.deadline, item.status));

  return (
    <div>
      <PageHeader
        title="What can hurt us?"
        description={`${currentOrg.name} · ${industryLabel(currentOrg.industry)} · ${countryLabel(currentOrg.country)}`}
        actions={<ScanButton organizationId={currentOrg.id} label="Rescan" />}
      />

      {scanDue && (
        <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-[var(--accent)] bg-[var(--accent-dim)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-[var(--ink)]">Scheduled scan is due</p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              {cadence === "weekly" ? "Weekly" : "Daily"} monitoring waits for this session. VERIQ
              does not scan in the background.
            </p>
          </div>
          <ScanButton organizationId={currentOrg.id} label="Run due scan" />
        </div>
      )}

      {overdueActions.length > 0 && (
        <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-[var(--critical)] bg-[rgba(255,77,109,0.08)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-[var(--ink)]">
              {overdueActions.length} action{overdueActions.length === 1 ? "" : "s"} past SLA
            </p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Critical items have a 24-hour deadline. High items have 7 days. VERIQ does not change
              production systems.
            </p>
          </div>
          <Link
            href="/actions"
            className="text-sm text-[var(--accent)] hover:underline"
          >
            Open actions
          </Link>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-[var(--muted)]">Loading radar…</p>
      ) : !score ? (
        <EmptyState
          icon={Radar}
          title="No scan yet"
          description="Run the first scan to build the company model, score and evidence."
          action={<ScanButton organizationId={currentOrg.id} />}
        />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[280px_1fr]">
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              VERIQ Score
            </p>
            <p
              className="mt-3 font-display text-7xl leading-none"
              style={{ color: toneColor }}
            >
              {score.overall}
            </p>
            <p className="mt-1 text-sm text-[var(--muted)]">/ 100</p>
            {delta !== null && (
              <p className="mt-3 text-sm text-[var(--muted)]">
                {delta >= 0 ? "+" : ""}
                {delta} since last scan
              </p>
            )}
            <p className="mt-2 text-xs text-[var(--muted)]">
              {formatDateTime(score.created_at)}
            </p>
            <div className="mt-6 space-y-3">
              {SCORE_DIMENSIONS.map((dim) => {
                const value = score[dim.key];
                return (
                  <div key={dim.key}>
                    <div className="mb-1 flex justify-between text-xs text-[var(--muted)]">
                      <span>{dim.label}</span>
                      <span>{value}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-[var(--elevated)]">
                      <div
                        className="h-full rounded-full bg-[var(--accent)]"
                        style={{ width: `${value}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <div className="space-y-6">
            <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-display text-2xl">What changed?</h2>
                <Link
                  href="/changes"
                  className="text-sm text-[var(--accent)] hover:underline"
                >
                  Full changelog
                </Link>
              </div>
              {!changes ? (
                <p className="text-sm text-[var(--muted)]">
                  Run a second scan to compare against this snapshot.
                </p>
              ) : (
                <div>
                  <div className="mb-4 grid gap-4 sm:grid-cols-3">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
                        Added
                      </p>
                      <p className="mt-1 font-display text-3xl">{changes.added}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
                        Removed
                      </p>
                      <p className="mt-1 font-display text-3xl">{changes.removed}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
                        Changed
                      </p>
                      <p className="mt-1 font-display text-3xl">{changes.changed}</p>
                    </div>
                  </div>
                  <p className="text-sm leading-6 text-[var(--muted)]">{changes.summary}</p>
                  {changes.items.length > 0 && (
                    <ul className="mt-4 space-y-2">
                      {changes.items.slice(0, 4).map((item) => (
                        <li
                          key={item.id}
                          className="rounded-xl border border-[var(--border)] bg-[var(--elevated)] px-4 py-3 text-sm text-[var(--ink)]"
                        >
                          {item.title}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-display text-2xl">External exposure</h2>
                <Link
                  href="/technology"
                  className="text-sm text-[var(--accent)] hover:underline"
                >
                  Technology
                </Link>
              </div>
              {exposure ? (
                <div className="grid gap-4 sm:grid-cols-4">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
                      Posture
                    </p>
                    <p className="mt-1 font-display text-4xl">{exposure.posture}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
                      Hostnames
                    </p>
                    <p className="mt-1 text-lg">{exposure.hostnames.length}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
                      TLS
                    </p>
                    <p className="mt-1 text-lg">
                      {exposure.tls?.daysRemaining != null
                        ? `${exposure.tls.daysRemaining}d`
                        : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
                      Email auth
                    </p>
                    <p className="mt-1 text-lg">
                      {exposure.spf && exposure.dmarc ? "SPF + DMARC" : "Gaps"}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-[var(--muted)]">
                  Run a scan with a website to measure internet exposure.
                </p>
              )}
            </section>

            <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-display text-2xl">Regulatory map</h2>
                <Link
                  href="/regulations"
                  className="text-sm text-[var(--accent)] hover:underline"
                >
                  All regulations
                </Link>
              </div>
              {regulatory.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">
                  Run a scan to map applicable regulations.
                </p>
              ) : (
                <ul className="space-y-3">
                  {regulatory.slice(0, 4).map((reg) => (
                    <li key={reg.code}>
                      <Link
                        href={`/regulations/${reg.code}`}
                        className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--elevated)] px-4 py-3 hover:border-[var(--accent)]"
                      >
                        <div>
                          <p className="text-sm text-[var(--ink)]">{reg.name}</p>
                          <p className="mt-1 text-xs text-[var(--muted)]">
                            {
                              reg.evidence.filter((item) => item.status === "unknown")
                                .length
                            }{" "}
                            unknown artefacts
                          </p>
                        </div>
                        <span className="text-sm text-[var(--muted)]">
                          {reg.coverage}%
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-display text-2xl">Vendors</h2>
                <Link
                  href="/vendors"
                  className="text-sm text-[var(--accent)] hover:underline"
                >
                  All vendors
                </Link>
              </div>
              {!vendors || vendors.vendors.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">
                  Run a scan to observe third parties, or declare a critical vendor.
                </p>
              ) : (
                <div>
                  <div className="mb-4 grid gap-4 sm:grid-cols-3">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
                        Mapped
                      </p>
                      <p className="mt-1 font-display text-3xl">{vendors.vendors.length}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
                        Critical / high
                      </p>
                      <p className="mt-1 font-display text-3xl">{vendors.criticalCount}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
                        Unknown answers
                      </p>
                      <p className="mt-1 font-display text-3xl">{vendors.unknownAnswers}</p>
                    </div>
                  </div>
                  <ul className="space-y-3">
                    {vendors.vendors.slice(0, 4).map((vendor) => (
                      <li key={vendor.id}>
                        <Link
                          href={`/vendors/${vendor.id}`}
                          className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--elevated)] px-4 py-3 hover:border-[var(--accent)]"
                        >
                          <div>
                            <p className="text-sm text-[var(--ink)]">{vendor.name}</p>
                            <p className="mt-1 text-xs text-[var(--muted)]">
                              {vendor.category} · {vendor.origin}
                            </p>
                          </div>
                          <span className="text-sm capitalize text-[var(--muted)]">
                            {vendor.risk}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-display text-2xl">Why this is material</h2>
                <Link
                  href="/graph"
                  className="text-sm text-[var(--accent)] hover:underline"
                >
                  Open graph
                </Link>
              </div>
              {!graph || graph.nodes.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">
                  Run a scan to connect company, vendors, regulations and findings.
                </p>
              ) : (
                <div>
                  <div className="mb-4 grid gap-4 sm:grid-cols-3">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
                        Entities
                      </p>
                      <p className="mt-1 font-display text-3xl">{graph.nodes.length}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
                        Relationships
                      </p>
                      <p className="mt-1 font-display text-3xl">{graph.edges.length}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
                        Paths
                      </p>
                      <p className="mt-1 font-display text-3xl">{graph.paths.length}</p>
                    </div>
                  </div>
                  {graph.paths.length > 0 ? (
                    <ul className="space-y-3">
                      {graph.paths.slice(0, 3).map((path) => (
                        <li key={path.id}>
                          <Link
                            href="/graph"
                            className="block rounded-xl border border-[var(--border)] bg-[var(--elevated)] px-4 py-3 hover:border-[var(--accent)]"
                          >
                            <p className="text-sm text-[var(--ink)]">{path.title}</p>
                            <p className="mt-1 text-xs text-[var(--muted)]">
                              {path.reason}
                            </p>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-[var(--muted)]">
                      Individual findings are not enough. After a scan, VERIQ
                      correlates secrets, vendors and statutes into paths the
                      board can act on.
                    </p>
                  )}
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-display text-2xl">Scenarios</h2>
                <Link
                  href="/scenarios"
                  className="text-sm text-[var(--accent)] hover:underline"
                >
                  All scenarios
                </Link>
              </div>
              {topScenarios.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">
                  Run a scan to simulate vendor outage, breach and ransomware on the graph.
                </p>
              ) : (
                <ul className="space-y-3">
                  {topScenarios.map((item) => (
                    <li key={item.id}>
                      <Link
                        href={`/scenarios/${item.id}`}
                        className="flex items-start justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--elevated)] px-4 py-3 hover:border-[var(--accent)]"
                      >
                        <div>
                          <p className="text-sm text-[var(--ink)]">{item.question}</p>
                          <p className="mt-1 text-xs text-[var(--muted)]">
                            {item.chain.slice(0, 3).join(" → ")}
                          </p>
                        </div>
                        <SeverityBadge severity={item.severity} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-display text-2xl">For the board</h2>
                <div className="flex gap-3 text-sm">
                  <Link href="/reports/board" className="text-[var(--accent)] hover:underline">
                    Board
                  </Link>
                  <Link href="/reports/diligence" className="text-[var(--accent)] hover:underline">
                    Investor
                  </Link>
                  <Link href="/reports/credit" className="text-[var(--accent)] hover:underline">
                    Credit
                  </Link>
                </div>
              </div>
              {topScenarios.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">
                  Board questions appear after a scan. Print the report for the pack.
                </p>
              ) : (
                <ul className="space-y-3">
                  {topScenarios.map((item) => (
                    <li
                      key={`board-${item.id}`}
                      className="rounded-xl border border-[var(--border)] bg-[var(--elevated)] px-4 py-3"
                    >
                      <p className="text-sm text-[var(--ink)]">{item.question}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-display text-2xl">Finance</h2>
                <Link
                  href="/finance"
                  className="text-sm text-[var(--accent)] hover:underline"
                >
                  Financial signals
                </Link>
              </div>
              {!finance ? (
                <p className="text-sm text-[var(--muted)]">
                  Run a scan to interpret payment and concentration signals.
                </p>
              ) : (
                <div>
                  <div className="mb-4 grid gap-4 sm:grid-cols-3">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
                        Posture
                      </p>
                      <p className="mt-1 font-display text-3xl">{finance.posture}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
                        Payment rails
                      </p>
                      <p className="mt-1 text-lg">
                        {finance.paymentRails.length
                          ? finance.paymentRails.join(", ")
                          : "Unknown"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
                        Concentration
                      </p>
                      <p className="mt-1 text-lg capitalize">
                        {finance.paymentConcentration}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm leading-6 text-[var(--muted)]">{finance.summary}</p>
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-display text-2xl">AI</h2>
                <Link
                  href="/ai"
                  className="text-sm text-[var(--accent)] hover:underline"
                >
                  AI governance
                </Link>
              </div>
              {!ai ? (
                <p className="text-sm text-[var(--muted)]">
                  Run a scan to map models and SDKs. Oversight stays UNKNOWN until attested.
                </p>
              ) : (
                <div>
                  <div className="mb-4 grid gap-4 sm:grid-cols-3">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
                        Posture
                      </p>
                      <p className="mt-1 font-display text-3xl">{ai.posture}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
                        Systems
                      </p>
                      <p className="mt-1 text-lg">
                        {ai.systems.length
                          ? ai.systems.map((item) => item.name).join(", ")
                          : "Unknown"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
                        Unknowns
                      </p>
                      <p className="mt-1 text-lg">{ai.unknowns.length}</p>
                    </div>
                  </div>
                  <p className="text-sm leading-6 text-[var(--muted)]">{ai.summary}</p>
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-display text-2xl">External world</h2>
                <Link
                  href="/world"
                  className="text-sm text-[var(--accent)] hover:underline"
                >
                  Full watch
                </Link>
              </div>
              {!world ? (
                <p className="text-sm text-[var(--muted)]">
                  Run a scan to ask whether catalogued public conditions matter to this company.
                </p>
              ) : (
                <div>
                  <div className="mb-4 grid gap-4 sm:grid-cols-3">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
                        Material
                      </p>
                      <p className="mt-1 font-display text-3xl">{world.material}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
                        Watch
                      </p>
                      <p className="mt-1 font-display text-3xl">{world.watch}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
                        Unknown
                      </p>
                      <p className="mt-1 font-display text-3xl">{world.unknown}</p>
                    </div>
                  </div>
                  <p className="text-sm leading-6 text-[var(--muted)]">{world.summary}</p>
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-display text-2xl">Top risks</h2>
                <Link
                  href="/findings"
                  className="text-sm text-[var(--accent)] hover:underline"
                >
                  All findings
                </Link>
              </div>
              {orderedRisks.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">No open risks.</p>
              ) : (
                <ul className="divide-y divide-[var(--border)]">
                  {orderedRisks.slice(0, 5).map((risk) => (
                    <li key={risk.id} className="py-3 first:pt-0 last:pb-0">
                      <Link
                        href={`/findings/${risk.id}`}
                        className="flex items-start justify-between gap-4 hover:opacity-90"
                      >
                        <div>
                          <p className="text-sm font-medium text-[var(--ink)]">
                            {risk.title}
                          </p>
                          <p className="mt-1 line-clamp-2 text-xs text-[var(--muted)]">
                            {risk.why_it_matters}
                          </p>
                        </div>
                        <SeverityBadge severity={risk.severity} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-display text-2xl">What should we do?</h2>
                <Link
                  href="/actions"
                  className="text-sm text-[var(--accent)] hover:underline"
                >
                  All actions
                </Link>
              </div>
              {actions.length === 0 ? (
                <EmptyState
                  icon={ShieldAlert}
                  title="No open actions"
                  description="Actions appear when a scan produces a recommended next step."
                  className="border-0 bg-transparent py-8"
                />
              ) : (
                <ul className="space-y-3">
                  {actions.map((action) => (
                    <li
                      key={action.id}
                      className="rounded-xl border border-[var(--border)] bg-[var(--elevated)] px-4 py-3"
                    >
                      <p className="text-sm text-[var(--ink)]">{action.title}</p>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        {action.owner_role ?? "Unassigned"} · {action.priority}
                        {action.deadline ? ` · due ${formatDateTime(action.deadline)}` : ""}
                      </p>
                      {isOverdue(action.deadline, action.status) && (
                        <Badge variant="danger" className="mt-2">
                          Overdue
                        </Badge>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
