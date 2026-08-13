"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { createOrgShareLink, revokeOrgShareLink, type ShareKind } from "@/lib/actions/shares";
import { formatDateTime } from "@/lib/utils";

const SHARE_TTL_DAYS = 14;

type ShareRow = {
  id: string;
  name: string;
  kind: ShareKind;
  prefix: string;
  createdAt: string;
  expiresAt: string | null;
  openCount: number;
  lastOpenedAt: string | null;
};

export function SharePack({
  organizationId,
  kind,
}: {
  organizationId: string;
  kind: ShareKind;
}) {
  const [rows, setRows] = useState<ShareRow[]>([]);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  async function load() {
    const supabase = createClient();
    const { data } = await supabase
      .from("assets")
      .select("id, name, metadata, created_at")
      .eq("organization_id", organizationId)
      .eq("type", "share_link")
      .order("created_at", { ascending: false });
    setRows(
      (data ?? [])
        .map((row) => {
          const meta = (row.metadata ?? {}) as {
            prefix?: string;
            createdAt?: string;
            expiresAt?: string;
            kind?: string;
            openCount?: number;
            lastOpenedAt?: string;
          };
          const rowKind: ShareKind =
            meta.kind === "credit" || meta.kind === "restructuring" ? meta.kind : "diligence";
          return {
            id: row.id,
            name: row.name,
            kind: rowKind,
            prefix: meta.prefix ?? "vq_share_…",
            createdAt: meta.createdAt ?? row.created_at,
            expiresAt: meta.expiresAt ?? null,
            openCount: typeof meta.openCount === "number" ? meta.openCount : 0,
            lastOpenedAt: meta.lastOpenedAt ?? null,
          };
        })
        .filter((row) => row.kind === kind),
    );
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, kind]);

  async function create() {
    setSaving(true);
    setError(null);
    setUrl(null);
    setCopied(false);
    const result = await createOrgShareLink({ organizationId, kind });
    setSaving(false);
    if (result.error || !result.token) {
      setError(result.error ?? "Could not create a share link");
      return;
    }
    setUrl(`${window.location.origin}/p/${result.token}`);
    await load();
  }

  async function copy() {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
  }

  async function revoke(id: string) {
    const result = await revokeOrgShareLink({ organizationId, id });
    if (result.error) setError(result.error);
    if (url) setUrl(null);
    await load();
  }

  const label =
    kind === "diligence"
      ? "investor"
      : kind === "credit"
        ? "bank"
        : "counsel or insolvency practitioner";
  const closeWhen =
    kind === "restructuring" ? "when the mandate closes" : "when diligence closes";
  const extra =
    kind === "restructuring"
      ? " This is not a legal opinion, not an appointment recommendation, and not a statement of affairs."
      : "";

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 print:hidden">
      <h2 className="font-display text-xl">Share with a {label}</h2>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
        Email a read-only link. They do not need a VERIQ account. Anyone with the link can
        read this pack for {SHARE_TTL_DAYS} days.{extra} Revoke it {closeWhen}. The secret is
        shown once.
      </p>
      <div className="mt-4">
        <Button type="button" onClick={() => void create()} disabled={saving}>
          {saving ? "Creating…" : "Create share link"}
        </Button>
      </div>
      {error && <p className="mt-3 text-sm text-[var(--critical)]">{error}</p>}
      {url && (
        <div className="mt-4 rounded-xl border border-[var(--accent)] bg-[var(--accent-dim)] p-4">
          <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
            Copy this now — it will not be shown again
          </p>
          <p className="mt-2 break-all font-mono text-sm text-[var(--ink)]">{url}</p>
          <Button className="mt-3" variant="secondary" size="sm" onClick={() => void copy()}>
            {copied ? "Copied" : "Copy link"}
          </Button>
        </div>
      )}
      {rows.length > 0 && (
        <ul className="mt-4 space-y-2">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--elevated)] px-4 py-3"
            >
              <div>
                <p className="text-sm text-[var(--ink)]">{row.name}</p>
                <p className="mt-1 font-mono text-xs text-[var(--muted)]">
                  {row.prefix}… · {formatDateTime(row.createdAt)}
                </p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {row.expiresAt
                    ? `Expires ${formatDateTime(row.expiresAt)}`
                    : `Expires ${SHARE_TTL_DAYS} days after creation`}
                  {row.openCount > 0
                    ? ` · opened ${row.openCount} time${row.openCount === 1 ? "" : "s"}`
                    : " · not opened yet"}
                  {row.lastOpenedAt ? ` · last ${formatDateTime(row.lastOpenedAt)}` : ""}
                </p>
              </div>
              <Button variant="danger" size="sm" onClick={() => void revoke(row.id)}>
                Revoke
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
