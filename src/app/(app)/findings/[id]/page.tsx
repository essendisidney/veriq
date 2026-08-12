"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/ui/page-header";
import { SeverityBadge } from "@/components/ui/badge";
import { Badge } from "@/components/ui/badge";
import { TRUST_LABELS, formatDateTime } from "@/lib/utils";
import type { Action, Evidence, Risk } from "@/lib/database.types";

export default function FindingDetailPage() {
  const params = useParams<{ id: string }>();
  const [risk, setRisk] = useState<Risk | null>(null);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [actions, setActions] = useState<Action[]>([]);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const [{ data: riskRow }, { data: evidenceRows }, { data: actionRows }] =
        await Promise.all([
          supabase.from("risks").select("*").eq("id", params.id).single(),
          supabase
            .from("evidence")
            .select("*")
            .eq("risk_id", params.id)
            .order("observed_at", { ascending: false }),
          supabase.from("actions").select("*").eq("risk_id", params.id),
        ]);
      setRisk((riskRow as Risk) ?? null);
      setEvidence((evidenceRows as Evidence[]) ?? []);
      setActions((actionRows as Action[]) ?? []);
    }
    void load();
  }, [params.id]);

  if (!risk) {
    return <p className="text-sm text-[var(--muted)]">Loading finding…</p>;
  }

  return (
    <div>
      <Link
        href="/findings"
        className="text-sm text-[var(--muted)] hover:text-[var(--accent)]"
      >
        ← Findings
      </Link>
      <PageHeader
        title={risk.title}
        description={risk.description}
        actions={<SeverityBadge severity={risk.severity} />}
        className="mt-4"
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="space-y-4 lg:col-span-2">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h2 className="font-display text-xl">Why this matters</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              {risk.why_it_matters}
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h2 className="font-display text-xl">Evidence</h2>
            <ul className="mt-4 space-y-3">
              {evidence.map((item) => (
                <li
                  key={item.id}
                  className="rounded-xl border border-[var(--border)] bg-[var(--elevated)] p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge>{item.source_type}</Badge>
                    <Badge variant="muted">
                      {TRUST_LABELS[item.trust_status]}
                    </Badge>
                    <span className="text-xs text-[var(--muted)]">
                      {item.confidence}% · {formatDateTime(item.observed_at)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-[var(--ink)]">{item.content}</p>
                  {item.source_reference && (
                    <p className="mt-2 break-all text-xs text-[var(--muted)]">
                      {item.source_reference}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h2 className="font-display text-xl">Recommended action</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              {risk.recommendation}
            </p>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--muted)]">Owner</dt>
                <dd>{risk.owner_role ?? "Unassigned"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--muted)]">Likelihood</dt>
                <dd>{risk.likelihood}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--muted)]">Impact</dt>
                <dd>{risk.impact}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--muted)]">Confidence</dt>
                <dd>{risk.confidence}%</dd>
              </div>
            </dl>
          </div>
          {actions.map((action) => (
            <div
              key={action.id}
              className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6"
            >
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                Action
              </p>
              <p className="mt-2 text-sm text-[var(--ink)]">{action.title}</p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                {action.owner_role} · {action.priority} · {action.status}
              </p>
            </div>
          ))}
        </aside>
      </div>
    </div>
  );
}
