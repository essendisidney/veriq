import { SHARE_PREFIX } from "@/lib/api/keys";
import { loadCompanySnapshot } from "@/lib/api/serve";
import { reportFromSnapshot } from "@/lib/reports/from-snapshot";
import { InstitutionalReportView } from "@/components/institutional-report";

export const dynamic = "force-dynamic";

function Unavailable({ title }: { title: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8">
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--accent)]">
        VERIQ
      </p>
      <h1 className="mt-3 font-display text-3xl">{title}</h1>
      <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
        This pack is unavailable, expired, or has been revoked. Ask the company to send a new
        link. VERIQ will not invent a score.
      </p>
    </div>
  );
}

export default async function PublicSharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const value = decodeURIComponent(token);

  if (!value.startsWith(SHARE_PREFIX) || value.length < 24) {
    return <Unavailable title="Pack not found" />;
  }

  const { status, body } = await loadCompanySnapshot(value, null);
  if (status === 429) {
    return <Unavailable title="Too many requests" />;
  }
  if (status !== 200) {
    return <Unavailable title="Pack not found" />;
  }

  const pack = body.pack === "credit" ? "credit" : "diligence";
  const report = reportFromSnapshot(pack, body);
  if (!report) {
    return <Unavailable title="No scan to share" />;
  }

  return (
    <div>
      <p className="mb-6 text-xs text-[var(--muted)] print:hidden">
        Read-only snapshot for {report.audience.toLowerCase()}. Print to PDF if you need a file.
        This is intelligence, not a legal, audit, valuation or credit opinion.
      </p>
      <InstitutionalReportView report={report} publicView />
    </div>
  );
}
