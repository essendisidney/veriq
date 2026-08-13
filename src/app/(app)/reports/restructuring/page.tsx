"use client";

import { Scale } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ScanButton } from "@/components/scan-button";
import { InstitutionalReportView } from "@/components/institutional-report";
import { SharePack } from "@/components/share-pack";
import { useReportBundle } from "@/lib/reports/use-report-bundle";
import { buildRestructuringReport } from "@/lib/reports/institutional";
import { countryLabel, industryLabel } from "@/lib/utils";

export default function RestructuringReportPage() {
  const { currentOrg, bundle, loaded } = useReportBundle();
  if (!currentOrg) return null;
  const report = bundle ? buildRestructuringReport(currentOrg, bundle) : null;

  return (
    <div>
      <PageHeader
        title="Restructuring / insolvency intelligence"
        description={`${industryLabel(currentOrg.industry)} · ${countryLabel(currentOrg.country)} · Operating continuity for counsel and insolvency practitioners. Not a legal opinion.`}
      />
      {!loaded ? (
        <p className="text-sm text-[var(--muted)]">Assembling the pack…</p>
      ) : !report ? (
        <EmptyState
          icon={Scale}
          title="No scan to share with counsel"
          description="Run a scan first. VERIQ will not invent a solvency opinion, creditor list or statement of affairs."
          action={<ScanButton organizationId={currentOrg.id} />}
        />
      ) : (
        <div className="space-y-6">
          <SharePack organizationId={currentOrg.id} kind="restructuring" />
          <InstitutionalReportView report={report} />
        </div>
      )}
    </div>
  );
}
