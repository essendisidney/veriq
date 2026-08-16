"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Share2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { RiskGraphView } from "@/components/risk-graph";
import type { RiskGraph } from "@/lib/graph/build";

export default function GraphPage() {
  const { currentOrg } = useWorkspace();
  const [graph, setGraph] = useState<RiskGraph | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!currentOrg) return;
    async function load() {
      const supabase = createClient();
      const [{ data: scans }, { data: risks }] = await Promise.all([
        supabase
          .from("scans")
          .select("summary")
          .eq("organization_id", currentOrg!.id)
          .eq("status", "completed")
          .order("created_at", { ascending: false })
          .limit(1),
        supabase
          .from("risks")
          .select("id, fingerprint")
          .eq("organization_id", currentOrg!.id)
          .eq("status", "open"),
      ]);
      const summary = scans?.[0]?.summary as { graph?: RiskGraph } | undefined;
      const next = summary?.graph ?? null;
      if (next) {
        const byFingerprint = new Map(
          (risks ?? []).map((row) => [row.fingerprint, row.id]),
        );
        setGraph({
          ...next,
          nodes: next.nodes.map((node) => {
            if (node.type !== "risk") return node;
            const fingerprint = node.id.replace(/^risk:/, "");
            const id = byFingerprint.get(fingerprint);
            return id ? { ...node, href: `/findings/${id}` } : node;
          }),
        });
      } else {
        setGraph(null);
      }
      setLoaded(true);
    }
    void load();
  }, [currentOrg]);

  return (
    <div>
      <PageHeader
        title="Risk Graph"
        description="How the company, claims, vendors, regulations and findings connect. Individual findings are not enough — VERIQ correlates them."
        actions={
          <Link
            href="/scenarios"
            className="text-sm text-[var(--accent)] hover:underline"
          >
            Simulate scenarios
          </Link>
        }
      />
      {!loaded ? (
        <p className="text-sm text-[var(--muted)]">Loading graph…</p>
      ) : !graph || graph.nodes.length === 0 ? (
        <EmptyState
          icon={Share2}
          title="No graph yet"
          description="Run a scan to build the company risk graph from observed evidence."
        />
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            <Stat label="Entities" value={String(graph.nodes.length)} />
            <Stat label="Relationships" value={String(graph.edges.length)} />
            <Stat label="Correlated paths" value={String(graph.paths.length)} />
          </div>
          <RiskGraphView graph={graph} />
        </>
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
