"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BookOpen } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import type { RegulationAssessment } from "@/lib/regulations/assess";

export default function RegulationsPage() {
  const { currentOrg } = useWorkspace();
  const [assessments, setAssessments] = useState<RegulationAssessment[]>([]);

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
      setAssessments(summary?.regulatory ?? []);
    }
    void load();
  }, [currentOrg]);

  return (
    <div>
      <PageHeader
        title="Regulations"
        description="Mapped through a control ontology from country and industry. Attest missing artefacts, then rescan. Intelligence, not a legal opinion."
      />
      {assessments.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No regulations mapped"
          description="Run a scan after setting country and industry."
        />
      ) : (
        <div className="grid gap-4">
          {assessments.map((reg) => (
            <Link
              key={reg.code}
              href={`/regulations/${reg.code}`}
              className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 hover:border-[var(--accent)]"
            >
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-2xl">{reg.name}</h2>
                <Badge>{reg.code}</Badge>
                <Badge variant="muted">{reg.jurisdiction}</Badge>
                <Badge variant={reg.coverage >= 70 ? "accent" : "warning"}>
                  {reg.coverage}% observed
                </Badge>
              </div>
              <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
                {reg.summary}
              </p>
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
                    {control.name}
                  </Badge>
                ))}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
