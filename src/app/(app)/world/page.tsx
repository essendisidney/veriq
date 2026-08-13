"use client";

import { useEffect, useState } from "react";
import { Globe } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { ScanButton } from "@/components/scan-button";
import { TRUST_LABELS } from "@/lib/utils";
import {
  WORLD_KIND_LABELS,
  type WorldAssessment,
  type WorldRelevance,
} from "@/lib/world/assess";

const RELEVANCE: Record<
  WorldRelevance,
  { label: string; variant: "danger" | "warning" | "muted" | "accent" }
> = {
  material: { label: "Matters", variant: "danger" },
  watch: { label: "Watch", variant: "warning" },
  unknown: { label: "Unknown", variant: "muted" },
  none: { label: "None", variant: "muted" },
};

export default function WorldPage() {
  const { currentOrg } = useWorkspace();
  const [world, setWorld] = useState<WorldAssessment | null>(null);

  useEffect(() => {
    if (!currentOrg) return;
    async function load() {
      const supabase = createClient();
      const { data: scans } = await supabase
        .from("scans")
        .select("summary")
        .eq("organization_id", currentOrg!.id)
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(1);
      const summary = scans?.[0]?.summary as { world?: WorldAssessment } | undefined;
      setWorld(summary?.world ?? null);
    }
    void load();
  }, [currentOrg]);

  if (!currentOrg) return null;

  return (
    <div>
      <PageHeader
        title="External world"
        description="Does this public condition matter to this company? VERIQ matches standing statutes, vendor classes and internet conditions — it will not invent a headline or an incident."
        actions={<ScanButton organizationId={currentOrg.id} label="Rescan" />}
      />

      {!world ? (
        <EmptyState
          icon={Globe}
          title="No external watch yet"
          description="Run a scan. Relevance is inferred from country, industry, vendors, AI and exposure."
        />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat label="Material" value={String(world.material)} />
            <Stat label="Watch" value={String(world.watch)} />
            <Stat label="Unknown" value={String(world.unknown)} />
          </div>
          <p className="text-sm leading-6 text-[var(--muted)]">{world.summary}</p>

          {world.events.length === 0 ? (
            <EmptyState
              icon={Globe}
              title="Nothing matched"
              description="The catalogued public conditions did not match this company model."
              className="py-10"
            />
          ) : (
            <div className="grid gap-4">
              {world.events.map((event) => {
                const relevance = RELEVANCE[event.relevance];
                return (
                  <article
                    key={event.id}
                    className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-display text-xl">{event.title}</h2>
                      <Badge variant={relevance.variant}>{relevance.label}</Badge>
                      <Badge variant="muted">{WORLD_KIND_LABELS[event.kind]}</Badge>
                      <Badge variant="muted">{TRUST_LABELS[event.trustStatus]}</Badge>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{event.summary}</p>
                    <p className="mt-3 text-sm text-[var(--ink)]">{event.reason}</p>
                    {(event.matchedVendors.length > 0 || event.matchedRegulations.length > 0) && (
                      <p className="mt-2 text-xs text-[var(--muted)]">
                        {event.matchedVendors.length
                          ? `Vendors: ${event.matchedVendors.join(", ")}`
                          : ""}
                        {event.matchedVendors.length && event.matchedRegulations.length
                          ? " · "
                          : ""}
                        {event.matchedRegulations.length
                          ? `Statutes: ${event.matchedRegulations.join(", ")}`
                          : ""}
                      </p>
                    )}
                  </article>
                );
              })}
            </div>
          )}
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
