"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Sunrise } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ScanButton } from "@/components/scan-button";
import { significantChanges, type ChangeSet } from "@/lib/changes/diff";
import type { Action, Risk } from "@/lib/database.types";
import { isOverdue } from "@/lib/risk/certainty";
import { isScanDue } from "@/lib/webhooks/cadence";

export default function BriefPage() {
  const { currentOrg } = useWorkspace();
  const [critical, setCritical] = useState<Risk[]>([]);
  const [emerging, setEmerging] = useState<Risk[]>([]);
  const [review, setReview] = useState(0);
  const [overdue, setOverdue] = useState(0);
  const [changes, setChanges] = useState<ChangeSet | null>(null);
  const [scanDue, setScanDue] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!currentOrg) return;
    async function load() {
      const supabase = createClient();
      const [{ data: risks }, { data: actions }, { data: scans }, { data: monitoring }] =
        await Promise.all([
          supabase
            .from("risks")
            .select("*")
            .eq("organization_id", currentOrg!.id)
            .in("status", ["open", "in_progress", "acknowledged"]),
          supabase
            .from("actions")
            .select("*")
            .eq("organization_id", currentOrg!.id)
            .eq("status", "open"),
          supabase
            .from("scans")
            .select("summary")
            .eq("organization_id", currentOrg!.id)
            .eq("status", "completed")
            .order("created_at", { ascending: false })
            .limit(1),
          supabase
            .from("assets")
            .select("metadata")
            .eq("organization_id", currentOrg!.id)
            .eq("type", "monitoring")
            .eq("name", "Monitoring")
            .maybeSingle(),
        ]);
      const open = (risks as Risk[]) ?? [];
      setCritical(open.filter((item) => item.severity === "critical"));
      setEmerging(open.filter((item) => item.severity === "high"));
      setReview(open.filter((item) => item.severity === "medium").length);
      setOverdue(((actions as Action[]) ?? []).filter((item) => isOverdue(item.deadline, item.status)).length);
      const summary = scans?.[0]?.summary as { changes?: ChangeSet } | undefined;
      setChanges(summary?.changes ?? null);
      const meta = (monitoring?.metadata ?? null) as { cadence?: string; nextDueAt?: string } | null;
      setScanDue(isScanDue(meta));
      setLoaded(true);
    }
    void load();
  }, [currentOrg]);

  if (!currentOrg) return null;
  const top = significantChanges(changes ?? { previousScanId: null, summary: "", added: 0, removed: 0, changed: 0, items: [] }, 5);

  return (
    <div>
      <PageHeader
        title="Morning brief"
        description={`Good morning. This is ${currentOrg.name} as of the last scan in this session — not a background worker watching 2,000 companies overnight.`}
        actions={<ScanButton organizationId={currentOrg.id} label="Rescan" />}
      />
      {!loaded ? (
        <p className="text-sm text-[var(--muted)]">Assembling the brief…</p>
      ) : (
        <div className="space-y-6">
          {scanDue && (
            <p className="rounded-2xl border border-[var(--accent)] bg-[var(--accent-dim)] px-5 py-4 text-sm">
              A scheduled scan is due. VERIQ does not scan while you sleep.
            </p>
          )}
          <section className="grid gap-4 sm:grid-cols-4">
            <Stat tone="var(--critical)" label="Critical" value={String(critical.length)} />
            <Stat tone="var(--high)" label="Emerging" value={String(emerging.length)} />
            <Stat tone="var(--medium)" label="Needs review" value={String(review + overdue)} />
            <Stat tone="var(--good)" label="Open findings" value={String(critical.length + emerging.length + review)} />
          </section>
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h2 className="font-display text-2xl">Top things to know</h2>
            {top.length === 0 && critical.length === 0 ? (
              <EmptyState
                icon={Sunrise}
                title="Nothing material since the last scan"
                description="Unchanged is a finding. It is not a clearance."
              />
            ) : (
              <ul className="mt-4 space-y-3">
                {critical.slice(0, 3).map((item) => (
                  <li key={item.id}>
                    <Link href={`/findings/${item.id}`} className="text-sm text-[var(--accent)] hover:underline">
                      {item.title}
                    </Link>
                  </li>
                ))}
                {top.map((item) => (
                  <li key={item.id} className="text-sm text-[var(--ink)]">
                    {item.title}
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

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <p className="text-xs uppercase tracking-wide text-[var(--muted)]">{label}</p>
      <p className="mt-2 font-display text-4xl" style={{ color: tone }}>
        {value}
      </p>
    </div>
  );
}
