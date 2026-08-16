import { SHARE_PREFIX } from "@/lib/api/keys";
import { loadCompanySnapshot } from "@/lib/api/serve";
import { bundleFromSnapshot, reportFromSnapshot } from "@/lib/reports/from-snapshot";
import { parsePackKind } from "@/lib/reports/pack";
import { InstitutionalReportView } from "@/components/institutional-report";
import { TrustPassport } from "@/components/trust-passport";
import { Badge } from "@/components/ui/badge";
import { buildPassport, PASSPORT_BAND_LABELS } from "@/lib/truth/passport";
import { TRUST_CALL_LABELS } from "@/lib/truth/call";
import { formatDate } from "@/lib/utils";

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
  if (status === 503) {
    return <Unavailable title="Pack temporarily unavailable" />;
  }
  if (status !== 200) {
    return <Unavailable title="Pack not found" />;
  }

  if (body.pack === "passport") {
    const bundle = bundleFromSnapshot(body);
    if (!bundle || !body.company) {
      return <Unavailable title="No scan to share" />;
    }
    const passport = buildPassport({
      trust: bundle.trust,
      claims: bundle.claims,
      integrity: bundle.integrity,
      websiteReachable: Boolean(bundle.exposure || bundle.snapshot?.website),
      lastVerified: body.scanned_at ?? null,
      critical: bundle.risks.filter((item) => item.severity === "critical").length,
    });
    return (
      <div className="space-y-6">
        <p className="text-xs text-[var(--muted)] print:hidden">
          Read-only VERIQ Passport. Not a certificate that this company is safe, licensed or
          creditworthy.
        </p>
        {bundle.trust && (
          <TrustPassport
            company={body.company.name}
            assessedAt={body.scanned_at ? formatDate(body.scanned_at) : "Unknown"}
            profile={bundle.trust}
          />
        )}
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
          <p className="font-display text-4xl">{TRUST_CALL_LABELS[passport.call]}</p>
          <ul className="mt-6 space-y-3">
            {passport.dimensions.map((item) => (
              <li key={item.id} className="rounded-xl border border-[var(--border)] bg-[var(--elevated)] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium">{item.label}</p>
                  <Badge variant="muted">{PASSPORT_BAND_LABELS[item.band]}</Badge>
                </div>
                <p className="mt-1 text-sm text-[var(--muted)]">{item.note}</p>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-[var(--muted)]">{passport.disclaimer}</p>
        </section>
      </div>
    );
  }

  const pack = parsePackKind(body.pack);
  const report = reportFromSnapshot(pack, body);
  if (!report) {
    return <Unavailable title="No scan to share" />;
  }

  return (
    <div>
      <p className="mb-6 text-xs text-[var(--muted)] print:hidden">
        Read-only snapshot for {report.audience.toLowerCase()}
        {report.scannedAt ? ` · as of ${formatDate(report.scannedAt)}` : ""}
        . Print to PDF if you need a file. This is intelligence, not a legal, audit, valuation,
        credit or insolvency opinion.
      </p>
      {report.staleDays != null && (
        <p className="mb-6 rounded-2xl border border-[var(--high)] bg-[rgba(255,138,76,0.08)] px-4 py-3 text-sm text-[var(--ink)] print:hidden">
          This pack is {report.staleDays} day{report.staleDays === 1 ? "" : "s"} old. Ask the company
          to rescan. A share link always shows the latest completed scan.
        </p>
      )}
      <InstitutionalReportView report={report} publicView />
    </div>
  );
}
