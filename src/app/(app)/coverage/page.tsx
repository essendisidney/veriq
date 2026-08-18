"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ScanButton } from "@/components/scan-button";
import { ingestVaultDocument } from "@/lib/actions/acquire";
import {
  KENYA_SOURCE_REGISTRY,
  REGISTRY_LIGHT_LABELS,
  type RegistryLight,
} from "@/lib/acquire/connectors";
import { CONNECTOR_STATUS_LABELS, DATA_DOMAIN_LABELS } from "@/lib/acquire/catalog";
import type { AcquisitionAssessment, ConnectorStatus } from "@/lib/acquire/types";
import type { DiggerReport } from "@/lib/digger/types";
import { DOCUMENT_KIND_LABELS, DOCUMENT_KINDS } from "@/lib/risk/validate";
import { CLAIM_VERDICT_LABELS } from "@/lib/claims/catalog";

const STATUS_VARIANT: Record<ConnectorStatus, "accent" | "warning" | "muted" | "danger"> = {
  connected: "accent",
  available: "warning",
  unverified: "warning",
  license_required: "muted",
  customer_consent_required: "muted",
  not_available: "danger",
};

const LIGHT_VARIANT: Record<RegistryLight, "accent" | "danger" | "muted"> = {
  connected: "accent",
  starter: "accent",
  to_connect: "danger",
};

type SourceRun = {
  source_id: string;
  registry_status: string;
  observed: boolean;
  note: string;
  evidence_count: number;
};

type VaultRow = {
  id: string;
  kind: string;
  filename: string;
  extraction_status: string | null;
  created_at: string;
};

export default function CoveragePage() {
  const { currentOrg } = useWorkspace();
  const [acquisition, setAcquisition] = useState<AcquisitionAssessment | null>(null);
  const [digger, setDigger] = useState<DiggerReport | null>(null);
  const [runs, setRuns] = useState<SourceRun[]>([]);
  const [vault, setVault] = useState<VaultRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    if (!currentOrg) return;
    const supabase = createClient();
    const [{ data: scans }, { data: sourceRuns }, { data: docs }] = await Promise.all([
      supabase
        .from("scans")
        .select("summary")
        .eq("organization_id", currentOrg.id)
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(1),
      supabase
        .from("veriq_source_runs")
        .select("source_id, registry_status, observed, note, evidence_count")
        .eq("organization_id", currentOrg.id),
      supabase
        .from("evidence_documents")
        .select("id, kind, filename, extraction_status, created_at")
        .eq("organization_id", currentOrg.id)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);
    const summary = scans?.[0]?.summary as
      | { acquisition?: AcquisitionAssessment; digger?: DiggerReport }
      | undefined;
    setAcquisition(summary?.acquisition ?? null);
    setDigger(summary?.digger ?? null);
    setRuns((sourceRuns as SourceRun[]) ?? []);
    setVault((docs as VaultRow[]) ?? []);
    setLoaded(true);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrg]);

  async function onUpload(formData: FormData) {
    if (!currentOrg) return;
    setUploading(true);
    setMessage(null);
    formData.set("organizationId", currentOrg.id);
    const result = await ingestVaultDocument(formData);
    setUploading(false);
    const text =
      "error" in result
        ? result.error ?? "Could not store the artefact"
        : result.note ?? "Stored.";
    setMessage(text);
    await load();
  }

  if (!currentOrg) return null;
  const runById = new Map(runs.map((row) => [row.source_id, row]));

  return (
    <div>
      <PageHeader
        title="Kenya data acquisition"
        description="A roadmap to authorised information. Public web and the customer vault are live starters. BRS, regulators, courts, procurement and bureaus plug in later — they are not scraped."
        actions={<ScanButton organizationId={currentOrg.id} label="Rescan" />}
      />

      {!loaded ? (
        <p className="text-sm text-[var(--muted)]">Reading the source registry…</p>
      ) : (
        <div className="space-y-6">
          {acquisition && (
            <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-7">
              <p className="eyebrow">VERIQ coverage</p>
              <p className="mt-4 font-display text-7xl italic leading-none">
                {acquisition.coverage}%
              </p>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
                {acquisition.summary} Data confidence {acquisition.confidence.overall}% is not the
                risk score.
              </p>
            </section>
          )}

          {acquisition && acquisition.conflicts.length > 0 && (
            <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
              <h2 className="font-display text-2xl italic">Contradictions</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                Same claim, two sources, different values. Requires validation. Not a fraud finding.
              </p>
              <ul className="mt-5 space-y-3">
                {acquisition.conflicts.map((row, index) => (
                  <li
                    key={`${row.claim}-${index}`}
                    className="rounded-xl border border-[var(--border)] bg-[var(--elevated)] px-4 py-3"
                  >
                    <p className="font-medium text-[var(--ink)]">{row.claim.replace("money:", "")}</p>
                    <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{row.why}</p>
                    {row.variancePct != null && (
                      <p className="mt-2 text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
                        {row.variancePct}% variance
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h2 className="font-display text-2xl italic">Data source registry</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              Kenya v1. Green is a starter we can actually run. Red is a connector slot waiting for
              an API, licence, or authorised extract.
            </p>
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-[11px] uppercase tracking-[0.14em] text-[var(--muted)]">
                    <th className="pb-3 pr-4 font-medium">Source</th>
                    <th className="pb-3 pr-4 font-medium">Data</th>
                    <th className="pb-3 pr-4 font-medium">Access</th>
                    <th className="pb-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {KENYA_SOURCE_REGISTRY.map((row) => {
                    const run = runById.get(row.id);
                    const light =
                      (run?.registry_status as RegistryLight | undefined) ??
                      (row.starter ? "starter" : "to_connect");
                    return (
                      <tr key={row.id} className="border-b border-[var(--border)] align-top">
                        <td className="py-4 pr-4 font-medium text-[var(--ink)]">{row.source}</td>
                        <td className="py-4 pr-4 text-[var(--muted)]">{row.data}</td>
                        <td className="py-4 pr-4 text-[var(--muted)]">{row.access}</td>
                        <td className="py-4">
                          <Badge variant={LIGHT_VARIANT[light]}>
                            {light === "to_connect" ? "🔴" : "🟢"} {REGISTRY_LIGHT_LABELS[light]}
                          </Badge>
                          {run?.note && (
                            <p className="mt-2 text-xs leading-5 text-[var(--muted)]">{run.note}</p>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h2 className="font-display text-2xl italic">Customer vault</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              Upload a CR12, licence, accounts or bank file. Searchable PDFs keep a text layer.
              Scanned images stay artefacts until OCR is connected — VERIQ will not invent directors
              from pixels.
            </p>
            <form
              action={onUpload}
              className="mt-5 grid gap-4 sm:grid-cols-[160px_1fr_auto] sm:items-end"
            >
              <div>
                <Label htmlFor="kind">Artefact</Label>
                <select
                  id="kind"
                  name="kind"
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--elevated)] px-2 py-2 text-sm"
                  defaultValue="cr12"
                >
                  {DOCUMENT_KINDS.map((kind) => (
                    <option key={kind} value={kind}>
                      {DOCUMENT_KIND_LABELS[kind]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="file">File</Label>
                <input
                  id="file"
                  name="file"
                  type="file"
                  required
                  className="mt-1 block w-full text-sm text-[var(--muted)]"
                />
              </div>
              <Button type="submit" disabled={uploading}>
                {uploading ? "Storing…" : "Ingest"}
              </Button>
            </form>
            {message && <p className="mt-3 text-sm text-[var(--muted)]">{message}</p>}
            {vault.length > 0 && (
              <ul className="mt-5 space-y-2">
                {vault.map((row) => (
                  <li key={row.id} className="text-sm text-[var(--ink)]">
                    {row.filename}
                    <span className="text-[var(--muted)]">
                      {" "}
                      · {row.kind} · {row.extraction_status ?? "pending"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {digger && (
            <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
              <h2 className="font-display text-2xl italic">Authorised digger</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{digger.summary}</p>
              <p className="mt-2 text-xs text-[var(--muted)]">
                Budget {digger.budgetUsed}/{digger.budgetMax}. robots.txt honoured. Login, CAPTCHA,
                paywall and government portals are refused.
              </p>
              {digger.claims.length > 0 && (
                <ul className="mt-5 space-y-3">
                  {digger.claims.map((row) => (
                    <li
                      key={row.id}
                      className="rounded-xl border border-[var(--border)] bg-[var(--elevated)] px-4 py-3"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-[var(--ink)]">{row.claim}</p>
                        <Badge
                          variant={
                            row.verdict === "contradicted"
                              ? "danger"
                              : row.verdict === "corroborated"
                                ? "accent"
                                : "warning"
                          }
                        >
                          {CLAIM_VERDICT_LABELS[row.verdict]}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{row.why}</p>
                    </li>
                  ))}
                </ul>
              )}
              {digger.people.length > 0 && (
                <div className="mt-5">
                  <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
                    People named on the public site
                  </p>
                  <ul className="mt-2 space-y-1 text-sm text-[var(--ink)]">
                    {digger.people.map((row) => (
                      <li key={row.name}>
                        {row.name} · {row.role}
                        <span className="text-[var(--muted)]"> — unverified, not a CR12</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {digger.refused.length > 0 && (
                <p className="mt-4 text-xs text-[var(--muted)]">
                  Refused {digger.refused.length} URL(s) (login, CAPTCHA, paywall or blocked host).
                </p>
              )}
              {digger.changes.length > 0 && (
                <p className="mt-2 text-xs text-[var(--muted)]">
                  {digger.changes.length} permitted page(s) changed since the last crawl.
                </p>
              )}
            </section>
          )}

          {acquisition && (
            <>
              <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
                <h2 className="font-display text-2xl italic">Domains</h2>
                <ul className="mt-5 space-y-3">
                  {acquisition.domains.map((row) => (
                    <li
                      key={row.domain}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border)] bg-[var(--elevated)] px-4 py-3"
                    >
                      <div>
                        <p className="text-sm font-medium">{DATA_DOMAIN_LABELS[row.domain]}</p>
                        <p className="text-sm text-[var(--muted)]">{row.need}</p>
                      </div>
                      <Badge variant={STATUS_VARIANT[row.status]}>
                        {CONNECTOR_STATUS_LABELS[row.status]}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
                <h2 className="font-display text-2xl italic">Entities</h2>
                <ul className="mt-4 space-y-2">
                  {acquisition.entities.map((row) => (
                    <li key={row.id} className="text-sm leading-6">
                      <span className="text-[var(--ink)]">{row.label}</span>
                      <span className="text-[var(--muted)]">
                        {" "}
                        · {row.kind} · {row.id}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            </>
          )}

          <p className="text-sm text-[var(--muted)]">
            Attest claims on{" "}
            <Link href="/truth" className="text-[var(--accent)] hover:underline">
              Truth
            </Link>
            . API: GET /api/v1/company/{"{id}"}/coverage
          </p>
        </div>
      )}
    </div>
  );
}
