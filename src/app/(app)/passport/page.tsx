"use client";

import { useEffect, useState } from "react";
import { Fingerprint } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { ScanButton } from "@/components/scan-button";
import { SharePack } from "@/components/share-pack";
import { TrustPassport } from "@/components/trust-passport";
import { buildTrustProfile, type TrustProfile } from "@/lib/truth/profile";
import {
  PASSPORT_BAND_LABELS,
  buildPassport,
  type CompanyPassport,
  type PassportBand,
} from "@/lib/truth/passport";
import { TRUST_CALL_LABELS } from "@/lib/truth/call";
import type { ClaimsAssessment } from "@/lib/claims/assess";
import type { IntegrityAssessment } from "@/lib/integrity/assess";
import type { Risk, Score } from "@/lib/database.types";
import { formatDate } from "@/lib/utils";

const BAND_VARIANT: Record<PassportBand, "accent" | "warning" | "muted" | "danger"> = {
  verified: "accent",
  partial: "warning",
  unknown: "muted",
  attention: "danger",
};

export default function PassportPage() {
  const { currentOrg } = useWorkspace();
  const [passport, setPassport] = useState<CompanyPassport | null>(null);
  const [trust, setTrust] = useState<TrustProfile | null>(null);
  const [assessedAt, setAssessedAt] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!currentOrg) return;
    async function load() {
      const supabase = createClient();
      const [{ data: scans }, { data: scores }, { data: risks }] = await Promise.all([
        supabase
          .from("scans")
          .select("summary, completed_at")
          .eq("organization_id", currentOrg!.id)
          .eq("status", "completed")
          .order("created_at", { ascending: false })
          .limit(1),
        supabase
          .from("scores")
          .select("overall")
          .eq("organization_id", currentOrg!.id)
          .order("created_at", { ascending: false })
          .limit(1),
        supabase
          .from("risks")
          .select("title, severity, fingerprint, why_it_matters, validation_status, intelligence_stage")
          .eq("organization_id", currentOrg!.id)
          .in("status", ["open", "in_progress", "acknowledged"]),
      ]);
      const summary = scans?.[0]?.summary as
        | { claims?: ClaimsAssessment; integrity?: IntegrityAssessment; trust?: TrustProfile; website?: string | null }
        | undefined;
      const overall = (scores?.[0] as Score | undefined)?.overall ?? 0;
      const nextTrust =
        summary?.trust ??
        buildTrustProfile({
          risk: overall,
          claims: summary?.claims ?? null,
          integrity: summary?.integrity ?? null,
          risks: (risks as Risk[]) ?? [],
        });
      setTrust(nextTrust);
      setAssessedAt(scans?.[0]?.completed_at ?? null);
      setPassport(
        buildPassport({
          trust: nextTrust,
          claims: summary?.claims ?? null,
          integrity: summary?.integrity ?? null,
          websiteReachable: Boolean(summary?.website),
          lastVerified: scans?.[0]?.completed_at ?? null,
          critical: ((risks as Risk[]) ?? []).filter((item) => item.severity === "critical").length,
        }),
      );
      setLoaded(true);
    }
    void load();
  }, [currentOrg]);

  if (!currentOrg) return null;

  return (
    <div>
      <PageHeader
        title="VERIQ Passport"
        description="A living evidence picture you can send to a bank, investor or procurement team. Green is not a KYB hit. Share the Passport — do not stamp 'VERIQ Verified' as if the company is safe."
        actions={<ScanButton organizationId={currentOrg.id} label="Rescan" />}
      />
      {!loaded ? (
        <p className="text-sm text-[var(--muted)]">Assembling passport…</p>
      ) : !passport || !trust ? (
        <EmptyState
          icon={Fingerprint}
          title="No passport yet"
          description="Run a scan. A Passport without evidence is a blank card."
          action={<ScanButton organizationId={currentOrg.id} />}
        />
      ) : (
        <div className="space-y-6">
          <TrustPassport
            company={currentOrg.name}
            assessedAt={assessedAt ? formatDate(assessedAt) : "No completed scan"}
            profile={trust}
          />
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <p className="eyebrow">Decision</p>
            <p className="mt-3 font-display text-5xl italic">{TRUST_CALL_LABELS[passport.call]}</p>
            <ul className="mt-6 space-y-3">
              {passport.dimensions.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-col gap-2 rounded-xl border border-[var(--border)] bg-[var(--elevated)] p-4 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-medium text-[var(--ink)]">{item.label}</p>
                    <p className="mt-1 text-sm text-[var(--muted)]">{item.note}</p>
                  </div>
                  <Badge variant={BAND_VARIANT[item.band]}>{PASSPORT_BAND_LABELS[item.band]}</Badge>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs leading-5 text-[var(--muted)]">{passport.disclaimer}</p>
          </section>
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h2 className="font-display text-xl">Share this Passport</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Send the link. “Please send me your VERIQ” should be enough.
            </p>
            <div className="mt-4">
              <SharePack organizationId={currentOrg.id} kind="passport" />
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
