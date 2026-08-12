"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Radar, ShieldAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { SeverityBadge } from "@/components/ui/badge";
import { ScanButton } from "@/components/scan-button";
import {
  SCORE_DIMENSIONS,
  countryLabel,
  formatDateTime,
  industryLabel,
  scoreTone,
} from "@/lib/utils";
import type { Action, Risk, Score } from "@/lib/database.types";

export default function DashboardPage() {
  const { currentOrg } = useWorkspace();
  const [score, setScore] = useState<Score | null>(null);
  const [previous, setPrevious] = useState<Score | null>(null);
  const [risks, setRisks] = useState<Risk[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentOrg) return;

    async function load() {
      const supabase = createClient();
      const orgId = currentOrg!.id;
      const [{ data: scores }, { data: topRisks }, { data: openActions }] =
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
        ]);

      setScore(scores?.[0] ?? null);
      setPrevious(scores?.[1] ?? null);
      setRisks((topRisks as Risk[]) ?? []);
      setActions((openActions as Action[]) ?? []);
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

  return (
    <div>
      <PageHeader
        title="What can hurt us?"
        description={`${currentOrg.name} · ${industryLabel(currentOrg.industry)} · ${countryLabel(currentOrg.country)}`}
        actions={<ScanButton organizationId={currentOrg.id} label="Rescan" />}
      />

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
                      </p>
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
