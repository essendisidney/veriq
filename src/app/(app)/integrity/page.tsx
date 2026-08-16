"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Landmark } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { ScanButton } from "@/components/scan-button";
import { TRUST_LABELS } from "@/lib/utils";
import {
  INTEGRITY_KIND_LABELS,
  type IntegrityAssessment,
  type IntegrityRecord,
} from "@/lib/integrity/assess";
import type { ChangeSet } from "@/lib/changes/diff";
import { isScanDue } from "@/lib/webhooks/cadence";

const STATUS: Record<
  IntegrityRecord["status"],
  { label: string; variant: "accent" | "warning" | "muted" }
> = {
  observed: { label: "Observed", variant: "accent" },
  watch: { label: "Watch", variant: "warning" },
  unknown: { label: "Unknown", variant: "muted" },
};

export default function IntegrityPage() {
  const { currentOrg } = useWorkspace();
  const [integrity, setIntegrity] = useState<IntegrityAssessment | null>(null);
  const [changes, setChanges] = useState<ChangeSet | null>(null);
  const [scanDue, setScanDue] = useState(false);

  useEffect(() => {
    if (!currentOrg) return;
    async function load() {
      const supabase = createClient();
      const [{ data: scans }, { data: monitoring }] = await Promise.all([
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
      const summary = scans?.[0]?.summary as
        | { integrity?: IntegrityAssessment; changes?: ChangeSet }
        | undefined;
      setIntegrity(summary?.integrity ?? null);
      setChanges(summary?.changes ?? null);
      setScanDue(isScanDue(monitoring?.metadata as { cadence?: string; nextDueAt?: string } | null));
    }
    void load();
  }, [currentOrg]);

  if (!currentOrg) return null;

  return (
    <div>
      <PageHeader
        title="Integrity"
        description="Public records as observed, not attested. Contradictions, not more alerts. VERIQ will not invent a shell company, an unlicensed rail, or that anyone is corrupt."
        actions={<ScanButton organizationId={currentOrg.id} label="Rescan" />}
      />

      {!integrity ? (
        <EmptyState
          icon={Landmark}
          title="No integrity snapshot yet"
          description="Run a scan. Kenya company registry, ODPC, CBK/NPS and LSK stay UNKNOWN until they are actually public to VERIQ. Attestation is for what is not public."
        />
      ) : (
        <div className="space-y-6">
          {scanDue && (
            <p className="rounded-2xl border border-[var(--border)] bg-[var(--elevated)] px-4 py-3 text-sm text-[var(--ink)]">
              A rescan is due. Hard things are often new — cadence plus what changed is the discovery engine.
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-4">
            <Stat label="Observed" value={String(integrity.observed)} />
            <Stat label="Unknown" value={String(integrity.unknown)} />
            <Stat label="Watch" value={String(integrity.watch)} />
            <Stat
              label="Contradictions"
              value={String(integrity.contradictions.length)}
            />
          </div>
          <p className="text-sm leading-6 text-[var(--muted)]">{integrity.summary}</p>

          {integrity.contradictions.length > 0 && (
            <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
              <h2 className="font-display text-2xl">Contradictions</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Statement versus observation. These are the findings a human would be proud of.
              </p>
              <ul className="mt-4 space-y-2">
                {integrity.contradictions.map((item) => (
                  <li key={item.fingerprint}>
                    <Link
                      href="/findings"
                      className="block rounded-xl border border-[var(--border)] bg-[var(--elevated)] px-4 py-3 text-sm text-[var(--ink)] hover:border-[var(--accent)]"
                    >
                      {item.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h2 className="font-display text-2xl">What changed</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Rescan is the discovery engine. Background workers come after a design partner actually rescans.
            </p>
            {!changes ? (
              <p className="mt-4 text-sm text-[var(--muted)]">
                Run a second scan to compare this snapshot.
              </p>
            ) : (
              <div className="mt-4">
                <p className="text-sm leading-6 text-[var(--muted)]">{changes.summary}</p>
                <p className="mt-2 text-sm text-[var(--ink)]">
                  {changes.added} added · {changes.removed} removed · {changes.changed} changed
                </p>
                <Link
                  href="/changes"
                  className="mt-3 inline-block text-sm text-[var(--accent)] hover:underline"
                >
                  Full changelog
                </Link>
              </div>
            )}
          </section>

          <section className="space-y-3">
            {integrity.records.map((record) => {
              const tone = STATUS[record.status];
              return (
                <article
                  key={record.id}
                  className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-display text-xl text-[var(--ink)]">{record.title}</h3>
                    <Badge variant={tone.variant}>{tone.label}</Badge>
                    <Badge variant="muted">{INTEGRITY_KIND_LABELS[record.kind]}</Badge>
                    <Badge variant="muted">{TRUST_LABELS[record.trustStatus]}</Badge>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{record.summary}</p>
                  <p className="mt-2 text-sm leading-6 text-[var(--ink)]">{record.reason}</p>
                  <p className="mt-3 text-xs uppercase tracking-wide text-[var(--muted)]">
                    {record.source}
                    {record.sourceUrl ? (
                      <>
                        {" · "}
                        <a
                          href={record.sourceUrl}
                          className="normal-case tracking-normal text-[var(--accent)] hover:underline"
                          target="_blank"
                          rel="noreferrer"
                        >
                          Public source
                        </a>
                      </>
                    ) : null}
                  </p>
                </article>
              );
            })}
          </section>

          <p className="text-xs leading-5 text-[var(--muted)]">
            ACECA, EACC and procurement mapping are standing public regimes. They are not a finding
            that this company, a director or a counterparty is corrupt, under investigation, or a PEP.
          </p>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <p className="text-xs uppercase tracking-wide text-[var(--muted)]">{label}</p>
      <p className="mt-1 font-display text-3xl">{value}</p>
    </div>
  );
}
