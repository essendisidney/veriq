"use client";

import { useEffect, useState } from "react";
import { Activity } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ScanButton } from "@/components/scan-button";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";
import type { Scan } from "@/lib/database.types";

export default function ScansPage() {
  const { currentOrg } = useWorkspace();
  const [scans, setScans] = useState<Scan[]>([]);

  useEffect(() => {
    if (!currentOrg) return;
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from("scans")
        .select("*")
        .eq("organization_id", currentOrg!.id)
        .order("created_at", { ascending: false });
      setScans((data as Scan[]) ?? []);
    }
    void load();
  }, [currentOrg]);

  return (
    <div>
      <PageHeader
        title="Scans"
        description="Each scan snapshots the company model and compares evidence over time."
        actions={
          currentOrg ? (
            <ScanButton organizationId={currentOrg.id} label="Run scan" />
          ) : null
        }
      />
      {scans.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="No scans yet"
          description="Start with an initial scan of the website and GitHub source."
        />
      ) : (
        <ul className="space-y-3">
          {scans.map((scan) => {
            const summary = scan.summary as {
              overall?: number;
              risks?: number;
              repos?: number;
              changes?: { summary?: string; added?: number; removed?: number };
            };
            return (
              <li
                key={scan.id}
                className="flex flex-col gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-medium capitalize text-[var(--ink)]">
                    {scan.type.replace("_", " ")} scan
                  </p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {formatDateTime(scan.created_at)}
                    {typeof summary.overall === "number"
                      ? ` · score ${summary.overall}`
                      : ""}
                    {typeof summary.risks === "number"
                      ? ` · ${summary.risks} risks`
                      : ""}
                    {summary.changes?.summary
                      ? ` · ${summary.changes.summary}`
                      : ""}
                  </p>
                  {scan.error && (
                    <p className="mt-1 text-xs text-[var(--critical)]">
                      {scan.error}
                    </p>
                  )}
                </div>
                <Badge
                  variant={
                    scan.status === "completed"
                      ? "accent"
                      : scan.status === "failed"
                        ? "danger"
                        : "muted"
                  }
                >
                  {scan.status}
                </Badge>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
