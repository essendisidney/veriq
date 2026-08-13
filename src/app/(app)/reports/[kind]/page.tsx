"use client";

import { useParams } from "next/navigation";
import { FileText } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ScanButton } from "@/components/scan-button";
import { DomainReportView } from "@/components/domain-report";
import { useReportBundle } from "@/lib/reports/use-report-bundle";
import { buildDomainReport, isDomainKind } from "@/lib/reports/domain";
import { countryLabel, industryLabel } from "@/lib/utils";

export default function DomainReportPage() {
  const params = useParams<{ kind: string }>();
  const kind = params.kind;
  const { currentOrg, bundle, loaded } = useReportBundle();

  if (!currentOrg) return null;
  if (!kind || !isDomainKind(kind)) {
    return (
      <EmptyState
        icon={FileText}
        title="Unknown report"
        description="Choose a report from the Reports list."
      />
    );
  }

  const report = bundle ? buildDomainReport(kind, currentOrg, bundle) : null;

  return (
    <div>
      <PageHeader
        title={report?.title ?? "Report"}
        description={`${industryLabel(currentOrg.industry)} · ${countryLabel(currentOrg.country)}`}
      />
      {!loaded ? (
        <p className="text-sm text-[var(--muted)]">Assembling the report…</p>
      ) : !report ? (
        <EmptyState
          icon={FileText}
          title="No scan to report"
          description="Run a scan first. VERIQ will not invent this pack."
          action={<ScanButton organizationId={currentOrg.id} />}
        />
      ) : (
        <DomainReportView report={report} />
      )}
    </div>
  );
}
