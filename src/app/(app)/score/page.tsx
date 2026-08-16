"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Scale } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { SeverityBadge, Badge } from "@/components/ui/badge";
import { ScanButton } from "@/components/scan-button";
import { SCORE_DIMENSIONS, scoreTone } from "@/lib/utils";
import type { Risk, Score } from "@/lib/database.types";
import { explainScore, STAGE_LABELS, VALIDATION_LABELS } from "@/lib/risk/validate";
import { buildTrustProfile, DECISION_POSTURE_LABELS, type TrustProfile } from "@/lib/truth/profile";
import type { ClaimsAssessment } from "@/lib/claims/assess";
import type { IntegrityAssessment } from "@/lib/integrity/assess";

export default function ScorePage() {
  const { currentOrg } = useWorkspace();
  const [score, setScore] = useState<Score | null>(null);
  const [risks, setRisks] = useState<Risk[]>([]);
  const [trust, setTrust] = useState<TrustProfile | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!currentOrg) return;
    async function load() {
      const supabase = createClient();
      const [{ data: scores }, { data: openRisks }, { data: scans }] = await Promise.all([
        supabase
          .from("scores")
          .select("*")
          .eq("organization_id", currentOrg!.id)
          .order("created_at", { ascending: false })
          .limit(1),
        supabase
          .from("risks")
          .select("*")
          .eq("organization_id", currentOrg!.id)
          .in("status", ["open", "in_progress", "acknowledged"]),
        supabase
          .from("scans")
          .select("summary")
          .eq("organization_id", currentOrg!.id)
          .eq("status", "completed")
          .order("created_at", { ascending: false })
          .limit(1),
      ]);
      const nextScore = (scores?.[0] as Score) ?? null;
      const nextRisks = (openRisks as Risk[]) ?? [];
      const summary = scans?.[0]?.summary as
        | { claims?: ClaimsAssessment; integrity?: IntegrityAssessment; trust?: TrustProfile }
        | undefined;
      setScore(nextScore);
      setRisks(nextRisks);
      setTrust(
        summary?.trust ??
          (nextScore
            ? buildTrustProfile({
                risk: nextScore.overall,
                claims: summary?.claims ?? null,
                integrity: summary?.integrity ?? null,
                risks: nextRisks,
              })
            : null),
      );
      setLoaded(true);
    }
    void load();
  }, [currentOrg]);

  if (!currentOrg) return null;

  const explained = score ? explainScore({ overall: score.overall, risks }) : null;
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
        title="Why this score"
        description="Risk is not evidence. A company can look low-risk and still be poorly evidenced. Every inference is labelled. No evidence = no conclusion."
        actions={<ScanButton organizationId={currentOrg.id} label="Rescan" />}
      />

      {!loaded ? (
        <p className="text-sm text-[var(--muted)]">Loading score…</p>
      ) : !score || !explained ? (
        <EmptyState
          icon={Scale}
          title="No score yet"
          description="Run a scan. VERIQ will not invent an integrity number."
          action={<ScanButton organizationId={currentOrg.id} />}
        />
      ) : (
        <div className="space-y-6">
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              Risk score
            </p>
            <p className="mt-3 font-display text-7xl leading-none" style={{ color: toneColor }}>
              {score.overall}
            </p>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{explained.summary}</p>
            {trust && (
              <>
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <Stat label="Evidence quality" value={String(trust.evidence)} />
                  <Stat label="Decision confidence" value={`${trust.confidence}%`} />
                </div>
                <p className="mt-4 text-sm font-medium text-[var(--ink)]">
                  {DECISION_POSTURE_LABELS[trust.posture]}
                </p>
                <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{trust.disclaimer}</p>
              </>
            )}
            <div className="mt-6 grid gap-4 sm:grid-cols-4">
              <Stat label="Findings" value={String(explained.counts.findings)} />
              <Stat label="Validated" value={String(explained.counts.validated)} />
              <Stat label="Pending" value={String(explained.counts.pending)} />
              <Stat label="Signals" value={String(explained.counts.signals)} />
            </div>
          </section>

          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h2 className="font-display text-2xl">Dimensions</h2>
            <div className="mt-4 space-y-3">
              {SCORE_DIMENSIONS.map((dim) => (
                <div key={dim.key}>
                  <div className="mb-1 flex justify-between text-xs text-[var(--muted)]">
                    <span>{dim.label}</span>
                    <span>{score[dim.key]}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-[var(--elevated)]">
                    <div
                      className="h-full rounded-full bg-[var(--accent)]"
                      style={{ width: `${score[dim.key]}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h2 className="font-display text-2xl">Material gaps</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Critical and high findings that have not been disproved. Click through for evidence and validation.
            </p>
            {explained.material.length === 0 ? (
              <p className="mt-4 text-sm text-[var(--muted)]">No open critical or high findings.</p>
            ) : (
              <ul className="mt-4 divide-y divide-[var(--border)]">
                {explained.material.map((risk) => (
                  <li key={risk.id}>
                    <Link
                      href={`/findings/${risk.id}`}
                      className="flex items-start justify-between gap-4 py-4 hover:opacity-90"
                    >
                      <div>
                        <p className="text-sm text-[var(--ink)]">{risk.title}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Badge variant="muted">
                            {STAGE_LABELS[risk.intelligence_stage ?? "finding"]}
                          </Badge>
                          <Badge variant="muted">
                            {VALIDATION_LABELS[risk.validation_status ?? "pending"]}
                          </Badge>
                        </div>
                      </div>
                      <SeverityBadge severity={risk.severity} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-[var(--muted)]">{label}</p>
      <p className="mt-1 font-display text-3xl">{value}</p>
    </div>
  );
}
