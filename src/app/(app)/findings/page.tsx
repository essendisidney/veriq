"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { CertaintyBadge, SeverityBadge } from "@/components/ui/badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { downloadTextFile, slugFile, toCsv } from "@/lib/reports/export";
import type { Certainty, Risk, RiskStatus, Severity } from "@/lib/database.types";
import {
  STAGE_LABELS,
  VALIDATION_LABELS,
  VALIDATION_STATUSES,
  type ValidationStatus,
} from "@/lib/risk/validate";

const RANK: Record<Severity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  informational: 4,
};

export default function FindingsPage() {
  const { currentOrg } = useWorkspace();
  const [risks, setRisks] = useState<Risk[]>([]);
  const [severity, setSeverity] = useState<Severity | "all">("all");
  const [status, setStatus] = useState<RiskStatus | "all">("open");
  const [certainty, setCertainty] = useState<Certainty | "all">("all");
  const [validation, setValidation] = useState<ValidationStatus | "all">("all");

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

  const filtered = useMemo(() => {
    return [...risks]
      .filter((risk) => (severity === "all" ? true : risk.severity === severity))
      .filter((risk) => (status === "all" ? true : risk.status === status))
      .filter((risk) =>
        certainty === "all"
          ? true
          : (risk.certainty ?? "potential") === certainty,
      )
      .filter((risk) =>
        validation === "all"
          ? true
          : (risk.validation_status ?? "pending") === validation,
      )
      .sort((a, b) => RANK[a.severity] - RANK[b.severity]);
  }, [risks, severity, status, certainty, validation]);

  return (
    <div>
      <PageHeader
        title="Findings"
        description="Signal, finding, then validated finding. VERIQ will not treat a scan observation as a conclusion until it is validated."
        actions={
          filtered.length > 0 ? (
            <Button
              variant="secondary"
              onClick={() =>
                downloadTextFile(
                  `${slugFile(currentOrg?.name ?? "veriq")}-findings.csv`,
                  toCsv([
                    [
                      "Title",
                      "Severity",
                      "Certainty",
                      "Category",
                      "Confidence",
                      "Owner",
                      "Status",
                      "Why it matters",
                    ],
                    ...filtered.map((risk) => [
                      risk.title,
                      risk.severity,
                      risk.certainty ?? "potential",
                      risk.category,
                      String(risk.confidence),
                      risk.owner_role ?? "",
                      risk.status,
                      risk.why_it_matters ?? "",
                    ]),
                  ]),
                  "text/csv",
                )
              }
            >
              Export CSV
            </Button>
          ) : null
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as RiskStatus | "all")}
          className="h-9 rounded-lg border border-[var(--border)] bg-[var(--elevated)] px-2 text-xs text-[var(--ink)]"
        >
          <option value="all">All statuses</option>
          <option value="open">Open</option>
          <option value="acknowledged">Acknowledged</option>
          <option value="in_progress">In progress</option>
          <option value="resolved">Resolved</option>
          <option value="accepted">Accepted</option>
        </select>
        <select
          value={severity}
          onChange={(e) => setSeverity(e.target.value as Severity | "all")}
          className="h-9 rounded-lg border border-[var(--border)] bg-[var(--elevated)] px-2 text-xs text-[var(--ink)]"
        >
          <option value="all">All severities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
          <option value="informational">Informational</option>
        </select>
        <select
          value={certainty}
          onChange={(e) => setCertainty(e.target.value as Certainty | "all")}
          className="h-9 rounded-lg border border-[var(--border)] bg-[var(--elevated)] px-2 text-xs text-[var(--ink)]"
        >
          <option value="all">All evidence grades</option>
          <option value="confirmed">Confirmed</option>
          <option value="potential">Potential</option>
          <option value="informational">Informational</option>
        </select>
        <select
          value={validation}
          onChange={(e) => setValidation(e.target.value as ValidationStatus | "all")}
          className="h-9 rounded-lg border border-[var(--border)] bg-[var(--elevated)] px-2 text-xs text-[var(--ink)]"
        >
          <option value="all">All validation</option>
          {VALIDATION_STATUSES.map((item) => (
            <option key={item} value={item}>
              {VALIDATION_LABELS[item]}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={ShieldAlert}
          title="No findings in this view"
          description="Run a scan, or clear the filters to see the full register."
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[var(--border)] text-xs uppercase tracking-wide text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">Risk</th>
                <th className="px-4 py-3 font-medium">Severity</th>
                <th className="hidden px-4 py-3 font-medium md:table-cell">
                  Evidence
                </th>
                <th className="hidden px-4 py-3 font-medium lg:table-cell">
                  Owner
                </th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((risk) => (
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
                    <p className="mt-1 text-xs capitalize text-[var(--muted)]">
                      {risk.category} · {risk.confidence}% ·{" "}
                      {STAGE_LABELS[risk.intelligence_stage ?? "finding"]}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <SeverityBadge severity={risk.severity} />
                  </td>
                  <td className="hidden px-4 py-3 md:table-cell">
                    <CertaintyBadge certainty={risk.certainty ?? "potential"} />
                  </td>
                  <td className="hidden px-4 py-3 text-[var(--muted)] lg:table-cell">
                    {risk.owner_role ?? "Unassigned"}
                  </td>
                  <td className="px-4 py-3 capitalize text-[var(--muted)]">
                    <Badge variant="muted">
                      {VALIDATION_LABELS[risk.validation_status ?? "pending"]}
                    </Badge>
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
