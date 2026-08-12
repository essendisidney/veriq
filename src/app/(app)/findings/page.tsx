"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { SeverityBadge } from "@/components/ui/badge";
import type { Risk } from "@/lib/database.types";

export default function FindingsPage() {
  const { currentOrg } = useWorkspace();
  const [risks, setRisks] = useState<Risk[]>([]);

  useEffect(() => {
    if (!currentOrg) return;
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from("risks")
        .select("*")
        .eq("organization_id", currentOrg!.id)
        .order("created_at", { ascending: false });
      setRisks((data as Risk[]) ?? []);
    }
    void load();
  }, [currentOrg]);

  const rank = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
    informational: 4,
  };
  const sorted = [...risks].sort(
    (a, b) => rank[a.severity] - rank[b.severity],
  );

  return (
    <div>
      <PageHeader
        title="Findings"
        description="Evidence-backed risks. Every item has a claim, source and recommended action."
      />
      {sorted.length === 0 ? (
        <EmptyState
          icon={ShieldAlert}
          title="No findings yet"
          description="Run a scan to populate the risk register."
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[var(--border)] text-xs uppercase tracking-wide text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">Risk</th>
                <th className="px-4 py-3 font-medium">Severity</th>
                <th className="hidden px-4 py-3 font-medium md:table-cell">
                  Category
                </th>
                <th className="hidden px-4 py-3 font-medium md:table-cell">
                  Confidence
                </th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((risk) => (
                <tr
                  key={risk.id}
                  className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--elevated)]"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/findings/${risk.id}`}
                      className="font-medium text-[var(--ink)] hover:text-[var(--accent)]"
                    >
                      {risk.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <SeverityBadge severity={risk.severity} />
                  </td>
                  <td className="hidden px-4 py-3 capitalize text-[var(--muted)] md:table-cell">
                    {risk.category}
                  </td>
                  <td className="hidden px-4 py-3 text-[var(--muted)] md:table-cell">
                    {risk.confidence}%
                  </td>
                  <td className="px-4 py-3 capitalize text-[var(--muted)]">
                    {risk.status.replace("_", " ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
