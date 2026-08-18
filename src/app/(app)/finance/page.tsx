"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Banknote } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { attestFinance } from "@/lib/actions/finance";
import {
  assessFinance,
  parseAttested,
  type AttestedFinance,
  type ConcentrationBand,
  type FinanceAssessment,
  type LiquidityBand,
  type RevenueMix,
  type TriState,
} from "@/lib/finance/assess";
import type { VendorMap } from "@/lib/vendors/assess";
import { TRUST_LABELS } from "@/lib/utils";

const CONCENTRATION: { value: ConcentrationBand; label: string }[] = [
  { value: "unknown", label: "Unknown" },
  { value: "low", label: "Low" },
  { value: "moderate", label: "Moderate" },
  { value: "high", label: "High" },
];

const LIQUIDITY: { value: LiquidityBand; label: string }[] = [
  { value: "unknown", label: "Unknown" },
  { value: "tight", label: "Tight" },
  { value: "adequate", label: "Adequate" },
  { value: "strong", label: "Strong" },
];

const MIX: { value: RevenueMix; label: string }[] = [
  { value: "unknown", label: "Unknown" },
  { value: "transactions", label: "Transactions" },
  { value: "subscriptions", label: "Subscriptions" },
  { value: "mixed", label: "Mixed" },
];

const TRI: { value: TriState; label: string }[] = [
  { value: "unknown", label: "Unknown" },
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
];

export default function FinancePage() {
  const { currentOrg } = useWorkspace();
  const [finance, setFinance] = useState<FinanceAssessment | null>(null);
  const [attested, setAttested] = useState<AttestedFinance | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    if (!currentOrg) return;
    const supabase = createClient();
    const [{ data: scans }, { data: asset }] = await Promise.all([
      supabase
        .from("scans")
        .select("summary")
        .eq("organization_id", currentOrg.id)
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(1),
      supabase
        .from("assets")
        .select("metadata")
        .eq("organization_id", currentOrg.id)
        .eq("type", "finance")
        .eq("name", "Financial signals")
        .maybeSingle(),
    ]);
    const summary = scans?.[0]?.summary as
      | { finance?: FinanceAssessment; vendors?: VendorMap }
      | undefined;
    const nextAttested = parseAttested(asset?.metadata);
    setAttested(nextAttested);
    setFinance(
      assessFinance({
        vendors: summary?.vendors ?? null,
        industry: currentOrg.industry,
        attested: nextAttested,
      }),
    );
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrg]);

  async function onAttest(formData: FormData) {
    if (!currentOrg) return;
    setSaving(true);
    setMessage(null);
    const result = await attestFinance({
      organizationId: currentOrg.id,
      customerConcentration: String(formData.get("customerConcentration") ?? "unknown"),
      liquidity: String(formData.get("liquidity") ?? "unknown"),
      revenueMix: String(formData.get("revenueMix") ?? "unknown"),
      singleSite: String(formData.get("singleSite") ?? "unknown"),
      secondaryPaymentRail: String(formData.get("secondaryPaymentRail") ?? "unknown"),
      keyPerson: String(formData.get("keyPerson") ?? "unknown"),
    });
    setSaving(false);
    if (result.error) {
      setMessage(result.error);
      return;
    }
    setMessage("Saved. Rescan to fold this into the VERIQ Score.");
    await load();
  }

  if (!currentOrg) return null;

  return (
    <div>
      <PageHeader
        title="Finance"
        description="Payment and concentration signals. VERIQ does not replace the ledger and will not invent a shilling figure."
      />

      {!finance ? (
        <EmptyState
          icon={Banknote}
          title="No financial signals yet"
          description="Run a scan, then attest concentration bands. Amounts stay UNKNOWN."
        />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-4">
            <Stat label="Posture" value={String(finance.posture)} />
            <Stat
              label="Payment rails"
              value={finance.paymentRails.length ? String(finance.paymentRails.length) : "—"}
            />
            <Stat label="Payment concentration" value={finance.paymentConcentration} />
            <Stat label="Unknowns" value={String(finance.unknowns.length)} />
          </div>

          <p className="text-sm leading-6 text-[var(--muted)]">{finance.summary}</p>

          {finance.health && (
            <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
              <h2 className="font-display text-2xl italic">{finance.health.packTitle}</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{finance.health.summary}</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {finance.health.ratios.map((row) => (
                  <div key={row.id} className="flex justify-between gap-3 text-sm">
                    <span className="text-[var(--muted)]">{row.label}</span>
                    <span className="font-medium text-[var(--ink)]">{row.display}</span>
                  </div>
                ))}
              </div>
              {finance.health.anomalies.length > 0 && (
                <ul className="mt-4 space-y-2">
                  {finance.health.anomalies.map((row) => (
                    <li key={row.id} className="text-sm leading-6 text-[var(--muted)]">
                      {row.title}. {row.why}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          <div className="grid gap-4">
            {finance.signals.map((signal) => (
              <div
                key={signal.id}
                className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-display text-xl">{signal.label}</h2>
                  <Badge>{signal.value}</Badge>
                  <Badge variant="muted">{TRUST_LABELS[signal.trustStatus]}</Badge>
                </div>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{signal.note}</p>
              </div>
            ))}
          </div>

          {finance.paymentVendors[0] && (
            <Link
              href={`/scenarios/v-outage-${finance.paymentVendors[0].id}`}
              className="inline-block text-sm text-[var(--accent)] hover:underline"
            >
              Simulate a 48-hour outage of {finance.paymentVendors[0].name}
            </Link>
          )}

          <form
            action={onAttest}
            className="grid gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 sm:grid-cols-2"
          >
            <h2 className="font-display text-xl sm:col-span-2">Attest bands</h2>
            <p className="sm:col-span-2 text-sm text-[var(--muted)]">
              Qualitative only. Do not enter amounts, customer names or account data.
            </p>
            <Field
              id="customerConcentration"
              label="Customer concentration"
              options={CONCENTRATION}
              defaultValue={attested?.customerConcentration ?? "unknown"}
            />
            <Field
              id="liquidity"
              label="Liquidity posture"
              options={LIQUIDITY}
              defaultValue={attested?.liquidity ?? "unknown"}
            />
            <Field
              id="revenueMix"
              label="Revenue mix"
              options={MIX}
              defaultValue={attested?.revenueMix ?? "unknown"}
            />
            <Field
              id="singleSite"
              label="Single site for critical operations"
              options={TRI}
              defaultValue={attested?.singleSite ?? "unknown"}
            />
            <Field
              id="secondaryPaymentRail"
              label="Secondary payment / collection rail exists"
              options={TRI}
              defaultValue={attested?.secondaryPaymentRail ?? "unknown"}
            />
            <Field
              id="keyPerson"
              label="Key-person dependency"
              options={TRI}
              defaultValue={attested?.keyPerson ?? "unknown"}
            />
            {message && (
              <p className="sm:col-span-2 text-sm text-[var(--muted)]">{message}</p>
            )}
            <div className="sm:col-span-2">
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save attested bands"}
              </Button>
            </div>
          </form>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h2 className="font-display text-xl">Still UNKNOWN</h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {finance.unknowns.map((item) => (
                <li key={item}>
                  <Badge variant="muted">{item}</Badge>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <p className="text-xs uppercase tracking-wide text-[var(--muted)]">{label}</p>
      <p className="mt-1 font-display text-3xl capitalize">{value}</p>
    </div>
  );
}

function Field({
  id,
  label,
  options,
  defaultValue,
}: {
  id: string;
  label: string;
  options: { value: string; label: string }[];
  defaultValue: string;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        name={id}
        defaultValue={defaultValue}
        className="flex h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--elevated)] px-3 text-sm"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
