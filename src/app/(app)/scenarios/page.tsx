"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FlaskConical } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge, SeverityBadge } from "@/components/ui/badge";
import { simulateScenarios, type ScenarioResult } from "@/lib/scenarios/simulate";
import type { RiskGraph } from "@/lib/graph/build";
import type { VendorMap } from "@/lib/vendors/assess";
import type { RegulationAssessment } from "@/lib/regulations/assess";

export default function ScenariosPage() {
  const { currentOrg } = useWorkspace();
  const [scenarios, setScenarios] = useState<ScenarioResult[]>([]);
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
      setScenarios(
        simulateScenarios({
          graph: summary?.graph ?? null,
          vendors: summary?.vendors ?? null,
          assessments: summary?.regulatory ?? [],
        }),
      );
      setLoaded(true);
    }
    void load();
  }, [currentOrg]);

  return (
    <div>
      <PageHeader
        title="Scenarios"
        description="What-if simulation on the risk graph. Impact is inferred. Financial figures stay UNKNOWN until attested."
      />
      {!loaded ? (
        <p className="text-sm text-[var(--muted)]">Loading scenarios…</p>
      ) : scenarios.length === 0 ? (
        <EmptyState
          icon={FlaskConical}
          title="No scenarios yet"
          description="Run a scan so VERIQ can simulate vendor outage, breach, regulation and ransomware against the company model."
        />
      ) : (
        <div className="grid gap-4">
          {scenarios.map((item) => (
            <Link
              key={item.id}
              href={`/scenarios/${item.id}`}
              className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 hover:border-[var(--accent)]"
            >
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-2xl">{item.title}</h2>
                <SeverityBadge severity={item.severity} />
                <Badge variant="muted">{item.duration}</Badge>
              </div>
              <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{item.question}</p>
              <p className="mt-2 text-xs text-[var(--muted)]">
                {item.chain.slice(0, 4).join(" → ")}
                {item.chain.length > 4 ? " → …" : ""}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
