"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { PageHeader } from "@/components/ui/page-header";
import { Badge, SeverityBadge } from "@/components/ui/badge";
import { scenarioById, type ScenarioResult } from "@/lib/scenarios/simulate";
import type { RiskGraph } from "@/lib/graph/build";
import type { VendorMap } from "@/lib/vendors/assess";
import type { RegulationAssessment } from "@/lib/regulations/assess";
import { TRUST_LABELS } from "@/lib/utils";

export default function ScenarioDetailPage() {
  const params = useParams<{ id: string }>();
  const { currentOrg } = useWorkspace();
  const [scenario, setScenario] = useState<ScenarioResult | null>(null);
  const [loaded, setLoaded] = useState(false);

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
        | {
            graph?: RiskGraph;
            vendors?: VendorMap;
            regulatory?: RegulationAssessment[];
          }
        | undefined;
      const id = decodeURIComponent(params.id);
      setScenario(
        scenarioById(id, {
          graph: summary?.graph ?? null,
          vendors: summary?.vendors ?? null,
          assessments: summary?.regulatory ?? [],
        }),
      );
      setLoaded(true);
    }
    void load();
  }, [currentOrg, params.id]);

  if (!loaded) {
    return <p className="text-sm text-[var(--muted)]">Running simulation…</p>;
  }

  if (!scenario) {
    return (
      <p className="text-sm text-[var(--muted)]">
        No simulation for this scenario. Run a scan first.
      </p>
    );
  }

  return (
    <div>
      <Link
        href="/scenarios"
        className="text-sm text-[var(--muted)] hover:text-[var(--accent)]"
      >
        ← Scenarios
      </Link>
      <PageHeader
        title={scenario.title}
        description={scenario.question}
        actions={<SeverityBadge severity={scenario.severity} />}
        className="mt-4"
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="space-y-4 lg:col-span-2">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h2 className="font-display text-xl">Cascade</h2>
            <ol className="mt-4 space-y-0">
              {scenario.chain.map((step, index) => (
                <li key={`${step}-${index}`} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span className="mt-1 h-2.5 w-2.5 rounded-full bg-[var(--accent)]" />
                    {index < scenario.chain.length - 1 && (
                      <span className="w-px flex-1 bg-[var(--border)]" />
                    )}
                  </div>
                  <p className="pb-4 text-sm text-[var(--ink)]">{step}</p>
                </li>
              ))}
            </ol>
          </div>

          <ImpactList title="Affected systems" items={scenario.affectedSystems} />
          <ImpactList title="Affected vendors" items={scenario.affectedVendors} />
          <ImpactList title="Applicable regulations" items={scenario.affectedRegulations} />
          <ImpactList title="Related findings" items={scenario.affectedFindings} />

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h2 className="font-display text-xl">Recommended mitigations</h2>
            <ul className="mt-4 space-y-2">
              {scenario.mitigations.map((item) => (
                <li
                  key={item}
                  className="rounded-xl border border-[var(--border)] bg-[var(--elevated)] px-4 py-3 text-sm text-[var(--ink)]"
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h2 className="font-display text-xl">Impact</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-[var(--muted)]">Operational</dt>
                <dd className="mt-1 leading-6 text-[var(--ink)]">{scenario.operational}</dd>
              </div>
              <div>
                <dt className="text-[var(--muted)]">Estimated financial impact</dt>
                <dd className="mt-1 leading-6 text-[var(--ink)]">{scenario.financial}</dd>
              </div>
              <div>
                <dt className="text-[var(--muted)]">Alternative</dt>
                <dd className="mt-1 leading-6 text-[var(--ink)]">{scenario.alternative}</dd>
              </div>
              <div>
                <dt className="text-[var(--muted)]">Notification</dt>
                <dd className="mt-1 leading-6 text-[var(--ink)]">{scenario.notification}</dd>
              </div>
            </dl>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge variant="muted">{TRUST_LABELS[scenario.trustStatus]}</Badge>
              <Badge variant="muted">{scenario.confidence}% confidence</Badge>
              <Badge variant="muted">{scenario.duration}</Badge>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h2 className="font-display text-xl">Still UNKNOWN</h2>
            <ul className="mt-3 space-y-2">
              {scenario.unknowns.map((item) => (
                <li
                  key={item}
                  className="rounded-xl border border-[var(--border)] bg-[var(--elevated)] px-3 py-2 text-sm text-[var(--muted)]"
                >
                  {item}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-[var(--muted)]">
              Simulation is not a prediction of loss. Final operational and financial decisions stay
              with authorised professionals.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function ImpactList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
      <h2 className="font-display text-xl">{title}</h2>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-[var(--muted)]">None observed on this path.</p>
      ) : (
        <ul className="mt-3 flex flex-wrap gap-2">
          {items.map((item) => (
            <li key={item}>
              <Badge variant="muted">{item}</Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
