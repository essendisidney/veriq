"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { PageHeader } from "@/components/ui/page-header";
import { Badge, SeverityBadge } from "@/components/ui/badge";
import { VENDOR_CATEGORY_LABELS } from "@/lib/vendors/catalog";
import type { VendorAssessment, VendorMap } from "@/lib/vendors/assess";
import { TRUST_LABELS } from "@/lib/utils";

export default function VendorDetailPage() {
  const params = useParams<{ id: string }>();
  const { currentOrg } = useWorkspace();
  const [vendor, setVendor] = useState<VendorAssessment | null>(null);

  useEffect(() => {
    if (!currentOrg) return;
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from("scans")
        .select("summary")
        .eq("organization_id", currentOrg!.id)
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(1);
      const summary = data?.[0]?.summary as { vendors?: VendorMap } | undefined;
      const id = decodeURIComponent(params.id);
      setVendor(summary?.vendors?.vendors.find((item) => item.id === id) ?? null);
    }
    void load();
  }, [currentOrg, params.id]);

  if (!vendor) {
    return (
      <p className="text-sm text-[var(--muted)]">
        No assessment for this vendor. Run a scan, or declare it and rescan.
      </p>
    );
  }

  return (
    <div>
      <Link
        href="/vendors"
        className="text-sm text-[var(--muted)] hover:text-[var(--accent)]"
      >
        ← Vendors
      </Link>
      <PageHeader
        title={vendor.name}
        description={vendor.reason}
        actions={<SeverityBadge severity={vendor.risk} />}
        className="mt-4"
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="space-y-4 lg:col-span-2">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h2 className="font-display text-xl">What we know</h2>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2 text-sm">
              <Row label="Category" value={VENDOR_CATEGORY_LABELS[vendor.category]} />
              <Row label="Criticality" value={vendor.criticality} />
              <Row label="Origin" value={vendor.origin} />
              <Row label="Trust" value={TRUST_LABELS[vendor.trustStatus]} />
              <Row
                label="Processes data"
                value={vendor.processesData ? "Yes (inferred)" : "No"}
              />
              <Row
                label="Production path"
                value={vendor.connectsToProduction ? "Yes (inferred)" : "No"}
              />
            </dl>
            {vendor.dataClasses.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {vendor.dataClasses.map((item) => (
                  <Badge key={item} variant="muted">
                    {item}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h2 className="font-display text-xl">Evidence</h2>
            {vendor.sources.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--muted)]">Declared only — not yet observed.</p>
            ) : (
              <ul className="mt-4 space-y-2">
                {vendor.sources.map((source, index) => (
                  <li
                    key={`${source.kind}-${source.reference}-${index}`}
                    className="rounded-xl border border-[var(--border)] bg-[var(--elevated)] px-4 py-3"
                  >
                    <p className="text-sm text-[var(--ink)]">{source.reference}</p>
                    <p className="mt-1 text-xs text-[var(--muted)]">{source.kind}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h2 className="font-display text-xl">Open questions</h2>
            <ul className="mt-4 space-y-2">
              {vendor.questions.map((item) => (
                <li
                  key={item.key}
                  className="flex items-start justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--elevated)] px-4 py-3"
                >
                  <p className="text-sm text-[var(--ink)]">{item.label}</p>
                  <Badge
                    variant={
                      item.status === "yes"
                        ? "accent"
                        : item.status === "no"
                          ? "muted"
                          : "warning"
                    }
                  >
                    {item.status}
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h2 className="font-display text-xl">If this vendor fails</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              {vendor.connectsToProduction
                ? "Production or customer-facing systems may stop or degrade."
                : "Customer experience or analytics may degrade; production is not inferred on this path."}
              {vendor.processesData
                ? " Customer or operational data may be in scope for notification."
                : ""}
            </p>
            <p className="mt-4 text-xs text-[var(--muted)]">
              Replacement and notification remain UNKNOWN until attested. VERIQ will not invent a
              contract or a backup vendor.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <Link
                href={`/scenarios/v-outage-${vendor.id}`}
                className="text-sm text-[var(--accent)] hover:underline"
              >
                Simulate 48-hour outage
              </Link>
              {vendor.processesData && (
                <Link
                  href={`/scenarios/v-breach-${vendor.id}`}
                  className="text-sm text-[var(--accent)] hover:underline"
                >
                  Simulate a breach
                </Link>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-[var(--muted)]">{label}</dt>
      <dd className="capitalize">{value}</dd>
    </div>
  );
}
