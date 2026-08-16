"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Fingerprint } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ScanButton } from "@/components/scan-button";
import { TrustPassport } from "@/components/trust-passport";
import { attestClaims } from "@/lib/actions/claims";
import {
  CLAIM_VERDICT_HINTS,
  CLAIM_VERDICT_LABELS,
  DIRECTOR_BANDS,
  EMPLOYEE_BANDS,
  PRESENCE_BANDS,
  REVENUE_BANDS,
  REVENUE_BAND_LABELS,
  normalizeVerdict,
  type ClaimVerdict,
  type TriState,
} from "@/lib/claims/catalog";
import {
  parseAttestedClaims,
  type AttestedClaims,
  type ClaimsAssessment,
} from "@/lib/claims/assess";
import { buildTrustProfile, type TrustProfile } from "@/lib/truth/profile";
import { formatDate } from "@/lib/utils";
import { MissingEvidencePanel } from "@/components/missing-evidence";

const TRI: { value: TriState; label: string }[] = [
  { value: "unknown", label: "Unknown" },
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
];

const VERDICT_VARIANT: Record<ClaimVerdict, "accent" | "danger" | "warning" | "muted" | "low"> = {
  verified: "accent",
  corroborated: "accent",
  unverified: "warning",
  contradicted: "danger",
  unknown: "muted",
};

export default function TruthPage() {
  const { currentOrg } = useWorkspace();
  const [claims, setClaims] = useState<ClaimsAssessment | null>(null);
  const [trust, setTrust] = useState<TrustProfile | null>(null);
  const [attested, setAttested] = useState<AttestedClaims | null>(null);
  const [risk, setRisk] = useState(0);
  const [assessedAt, setAssessedAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    if (!currentOrg) return;
    const supabase = createClient();
    const [{ data: scans }, { data: asset }, { data: scores }, { data: risks }] =
      await Promise.all([
        supabase
          .from("scans")
          .select("summary, completed_at")
          .eq("organization_id", currentOrg.id)
          .eq("status", "completed")
          .order("created_at", { ascending: false })
          .limit(1),
        supabase
          .from("assets")
          .select("metadata")
          .eq("organization_id", currentOrg.id)
          .eq("type", "company_claims")
          .eq("name", "Company claims")
          .maybeSingle(),
        supabase
          .from("scores")
          .select("overall")
          .eq("organization_id", currentOrg.id)
          .order("created_at", { ascending: false })
          .limit(1),
        supabase
          .from("risks")
          .select("title, severity, fingerprint, why_it_matters, validation_status, intelligence_stage")
          .eq("organization_id", currentOrg.id)
          .in("status", ["open", "in_progress", "acknowledged"]),
      ]);
    const summary = scans?.[0]?.summary as
      | { claims?: ClaimsAssessment; trust?: TrustProfile }
      | undefined;
    const nextClaims = summary?.claims ?? null;
    const overall = scores?.[0]?.overall ?? 0;
    setClaims(nextClaims);
    setRisk(overall);
    setAssessedAt(scans?.[0]?.completed_at ?? null);
    setAttested(parseAttestedClaims(asset?.metadata));
    setTrust(
      buildTrustProfile({
        risk: overall,
        claims: nextClaims,
        risks: risks ?? [],
      }),
    );
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrg]);

  async function onSave(formData: FormData) {
    if (!currentOrg) return;
    setSaving(true);
    setMessage(null);
    const result = await attestClaims({
      organizationId: currentOrg.id,
      employeeBand: String(formData.get("employeeBand") ?? "unknown"),
      directorBand: String(formData.get("directorBand") ?? "unknown"),
      licensedOperator: String(formData.get("licensedOperator") ?? "unknown"),
      africaPresence: String(formData.get("africaPresence") ?? "unknown"),
      relatedPartySuppliers: String(formData.get("relatedPartySuppliers") ?? "unknown"),
      revenueBand: String(formData.get("revenueBand") ?? "unknown"),
    });
    setSaving(false);
    setMessage(result.error ?? "Saved. Rescan to test the story against evidence.");
    await load();
  }

  if (!currentOrg) return null;

  return (
    <div>
      <PageHeader
        title="Company truth"
        description="VERIQ does not tell you what to believe. It shows you what can be proven. Evidence is the product. AI is the engine."
        actions={
          <div className="flex items-center gap-3">
            <Link href="/challenge" className="text-sm text-[var(--accent)] hover:underline">
              Challenge this company
            </Link>
            <ScanButton organizationId={currentOrg.id} label="Rescan" />
          </div>
        }
      />

      {trust && (
        <div className="mb-6">
          <TrustPassport
            company={currentOrg.name}
            assessedAt={assessedAt ? formatDate(assessedAt) : "No completed scan"}
            profile={trust}
          />
        </div>
      )}

      {trust && trust.missing.length > 0 && (
        <div className="mb-6">
          <MissingEvidencePanel items={trust.missing} href="/truth" />
        </div>
      )}

      {trust && (
        <section className="mb-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
          <h2 className="font-display text-2xl">Claims tested</h2>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-5">
            <Stat label="Verified" value={String(trust.verified)} />
            <Stat label="Corroborated" value={String(trust.corroborated)} />
            <Stat label="Unverified" value={String(trust.unverified)} />
            <Stat label="Contradicted" value={String(trust.contradicted)} />
            <Stat label="Unknown" value={String(trust.unknown)} />
          </div>
          <p className="mt-4 text-sm leading-6 text-[var(--muted)]">{trust.summary}</p>
          {trust.material.length > 0 && (
            <ul className="mt-4 space-y-2">
              {trust.material.map((item) => (
                <li key={item.title}>
                  <Link href={item.href} className="text-sm text-[var(--accent)] hover:underline">
                    {item.title}
                  </Link>
                  <p className="text-sm text-[var(--muted)]">{item.why}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <form
          action={onSave}
          className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6"
        >
          <h2 className="font-display text-xl">What management claims</h2>
          <Field
            id="employeeBand"
            label="Headcount band"
            defaultValue={attested?.employeeBand ?? "unknown"}
            options={EMPLOYEE_BANDS.map((item) => ({
              value: item,
              label: item === "unknown" ? "Unknown" : item,
            }))}
          />
          <Field
            id="directorBand"
            label="Directors (attested)"
            defaultValue={attested?.directorBand ?? "unknown"}
            options={DIRECTOR_BANDS.map((item) => ({
              value: item,
              label: item === "unknown" ? "Unknown" : item,
            }))}
          />
          <Field
            id="licensedOperator"
            label="Licensed operator (CBK / CMA / IRA / CA / other)"
            defaultValue={attested?.licensedOperator ?? "unknown"}
            options={TRI}
          />
          <Field
            id="africaPresence"
            label="Geographic presence claimed"
            defaultValue={attested?.africaPresence ?? "unknown"}
            options={PRESENCE_BANDS.map((item) => ({
              value: item,
              label: item === "unknown" ? "Unknown" : item,
            }))}
          />
          <Field
            id="relatedPartySuppliers"
            label="Related-party suppliers or partners"
            defaultValue={attested?.relatedPartySuppliers ?? "unknown"}
            options={TRI}
          />
          <Field
            id="revenueBand"
            label="Revenue band (attested — not extracted)"
            defaultValue={attested?.revenueBand ?? "unknown"}
            options={REVENUE_BANDS.map((item) => ({
              value: item,
              label: REVENUE_BAND_LABELS[item],
            }))}
          />
          {message && <p className="text-sm text-[var(--muted)]">{message}</p>}
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save claims"}
          </Button>
        </form>

        <div className="space-y-4">
          {!claims ? (
            <EmptyState
              icon={Fingerprint}
              title="No truth snapshot yet"
              description="Attest the story, then rescan. Contradictions become findings. Unknown stays unknown."
            />
          ) : (
            <section className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
              <h2 className="font-display text-xl">Claim ledger</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Claim → evidence → cross-check → validation. An inference is labelled. Risk score
                this scan: {risk}/100.
              </p>
              <table className="mt-4 w-full min-w-[36rem] text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-[var(--muted)]">
                  <tr>
                    <th className="pb-2 font-medium">Claim</th>
                    <th className="pb-2 font-medium">Evidence</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium">Conf.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {claims.claims.map((item) => {
                    const verdict = normalizeVerdict(item.verdict);
                    return (
                      <tr key={item.id}>
                        <td className="py-3 align-top">
                          <p className="font-medium text-[var(--ink)]">{item.title}</p>
                          <p className="text-[var(--muted)]">{item.claim}</p>
                        </td>
                        <td className="py-3 align-top text-[var(--muted)]">
                          {item.supporting[0] ?? item.conflicting[0] ?? "None observed"}
                          {item.inference && (
                            <p className="mt-1 text-xs">Inference — not a fact</p>
                          )}
                        </td>
                        <td className="py-3 align-top">
                          <Badge variant={VERDICT_VARIANT[verdict]}>
                            {CLAIM_VERDICT_LABELS[verdict]}
                          </Badge>
                          <p className="mt-1 text-xs text-[var(--muted)]">
                            {CLAIM_VERDICT_HINTS[verdict]}
                          </p>
                        </td>
                        <td className="py-3 align-top">{item.confidence}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-[var(--muted)]">{label}</p>
      <p className="mt-1 font-display text-3xl">{value}</p>
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
        className="mt-1 h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--elevated)] px-3 text-sm"
      >
        {options.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
    </div>
  );
}
