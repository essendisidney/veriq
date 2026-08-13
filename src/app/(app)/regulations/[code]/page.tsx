"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import type { RegulationAssessment } from "@/lib/regulations/assess";

export default function RegulationDetailPage() {
  const params = useParams<{ code: string }>();
  const { currentOrg } = useWorkspace();
  const [reg, setReg] = useState<RegulationAssessment | null>(null);

  useEffect(() => {
    if (!currentOrg) return;
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from("scans")
        .select("summary")
        .eq("organization_id", currentOrg!.id)
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(1);
      const summary = data?.[0]?.summary as
        | { regulatory?: RegulationAssessment[] }
        | undefined;
      const code = decodeURIComponent(params.code);
      setReg(summary?.regulatory?.find((item) => item.code === code) ?? null);
    }
    void load();
  }, [currentOrg, params.code]);

  if (!reg) {
    return (
      <p className="text-sm text-[var(--muted)]">
        No assessment for this regulation. Run a scan first.
      </p>
    );
  }

  const present = reg.evidence.filter((item) => item.status === "present");
  const gaps = reg.evidence.filter((item) => item.status === "gap");
  const unknown = reg.evidence.filter((item) => item.status === "unknown");

  return (
    <div>
      <Link
        href="/regulations"
        className="text-sm text-[var(--muted)] hover:text-[var(--accent)]"
      >
        ← Regulations
      </Link>
      <PageHeader
        title={reg.name}
        description={reg.summary}
        actions={
          <Badge variant={reg.coverage >= 70 ? "accent" : "warning"}>
            {reg.coverage}% observed
          </Badge>
        }
        className="mt-4"
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="space-y-4 lg:col-span-2">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h2 className="font-display text-xl">Controls</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {reg.controls.map((control) => (
                <Badge
                  key={control.id}
                  variant={
                    control.status === "covered"
                      ? "accent"
                      : control.status === "gap"
                        ? "danger"
                        : "muted"
                  }
                >
                  {control.name} · {control.status}
                </Badge>
              ))}
            </div>
          </div>

          <EvidenceList title="Current evidence" items={present} empty="None observed in this scan." />
          <EvidenceList title="Gaps" items={gaps} empty="No observable gaps." />
          <EvidenceList
            title="Missing evidence"
            items={unknown}
            empty="No attested artefacts outstanding."
          />
        </section>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h2 className="font-display text-xl">Company impact</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{reg.impact}</p>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--muted)]">Jurisdiction</dt>
                <dd>{reg.jurisdiction}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--muted)]">Category</dt>
                <dd className="capitalize">{reg.category}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--muted)]">Code</dt>
                <dd>{reg.code}</dd>
              </div>
            </dl>
            <p className="mt-4 text-xs text-[var(--muted)]">
              VERIQ is not a lawyer, auditor or regulator. Final legal decisions stay with authorised professionals.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function EvidenceList({
  title,
  items,
  empty,
}: {
  title: string;
  items: RegulationAssessment["evidence"];
  empty: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
      <h2 className="font-display text-xl">{title}</h2>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-[var(--muted)]">{empty}</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {items.map((item) => (
            <li
              key={item.key}
              className="flex items-start justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--elevated)] px-4 py-3"
            >
              <div>
                <p className="text-sm text-[var(--ink)]">{item.label}</p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {item.kind === "observable" ? "Observed" : "Attested"} · {item.control}
                  {item.source ? ` · ${item.source}` : ""}
                </p>
              </div>
              <Badge
                variant={
                  item.status === "present"
                    ? "accent"
                    : item.status === "gap"
                      ? "danger"
                      : "muted"
                }
              >
                {item.status}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
