"use client";

import { Landmark } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ScanButton } from "@/components/scan-button";
import { InstitutionalReportView } from "@/components/institutional-report";
import { useReportBundle } from "@/lib/reports/use-report-bundle";
import { buildCreditReport } from "@/lib/reports/institutional";
import { countryLabel, industryLabel } from "@/lib/utils";

export default function CreditReportPage() {
  const { currentOrg, bundle, loaded } = useReportBundle();
  if (!currentOrg) return null;
  const report = bundle ? buildCreditReport(currentOrg, bundle) : null;

  return (
    <div>
      <PageHeader
        title="Bank / credit intelligence"
        description={`${industryLabel(currentOrg.industry)} · ${countryLabel(currentOrg.country)} · Business risk profile. Not a credit rating. Amounts UNKNOWN.`}
      />
      {!loaded ? (
        <p className="text-sm text-[var(--muted)]">Assembling the profile…</p>
      ) : !report ? (
        <EmptyState
          icon={Landmark}
          title="No scan to profile"
          description="Run a scan first. VERIQ will not invent a credit score, PD or cash figure."
          action={<ScanButton organizationId={currentOrg.id} />}
        />
      ) : (
        <InstitutionalReportView report={report} />
      )}
    </div>
  );
}
