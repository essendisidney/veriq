"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { createOrgShareLink, revokeOrgShareLink, type ShareKind } from "@/lib/actions/shares";
import { formatDateTime } from "@/lib/utils";

type ShareRow = {
  id: string;
  name: string;
  kind: ShareKind;
  prefix: string;
  createdAt: string;
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
            kind?: string;
          };
          const rowKind: ShareKind = meta.kind === "credit" ? "credit" : "diligence";
          return {
            id: row.id,
            name: row.name,
            kind: rowKind,
            prefix: meta.prefix ?? "vq_share_…",
            createdAt: meta.createdAt ?? row.created_at,
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

  const label = kind === "diligence" ? "investor" : "bank";

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 print:hidden">
      <h2 className="font-display text-xl">Share with a {label}</h2>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
        Email a read-only link. They do not need a VERIQ account. Anyone with the link can
        read this pack. Revoke it when diligence closes. The secret is shown once.
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
