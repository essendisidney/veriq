"use client";

import { Landmark } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ScanButton } from "@/components/scan-button";
import { InstitutionalReportView } from "@/components/institutional-report";
import { SharePack } from "@/components/share-pack";
import { useReportBundle } from "@/lib/reports/use-report-bundle";
import { buildDiligenceReport } from "@/lib/reports/institutional";
import { countryLabel, industryLabel } from "@/lib/utils";

export default function DiligenceReportPage() {
  const { currentOrg, bundle, loaded } = useReportBundle();
  if (!currentOrg) return null;
  const report = bundle ? buildDiligenceReport(currentOrg, bundle) : null;

  return (
    <div>
      <PageHeader
        title="Investor due diligence"
        description={`${industryLabel(currentOrg.industry)} · ${countryLabel(currentOrg.country)} · Company Health Score from evidence, not a valuation.`}
      />
      {!loaded ? (
        <p className="text-sm text-[var(--muted)]">Assembling the pack…</p>
      ) : !report ? (
        <EmptyState
          icon={Landmark}
          title="No scan to diligence"
          description="Run a scan first. VERIQ will not invent a health score, cap table or forecast."
          action={<ScanButton organizationId={currentOrg.id} />}
        />
      ) : (
        <div className="space-y-6">
          <SharePack organizationId={currentOrg.id} kind="diligence" />
          <InstitutionalReportView report={report} />
        </div>
      )}
    </div>
  );
}
