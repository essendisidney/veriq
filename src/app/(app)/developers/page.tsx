"use client";

import { useEffect, useState } from "react";
import { KeyRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { createOrgApiKey, revokeOrgApiKey } from "@/lib/actions/api-keys";
import { SharePack } from "@/components/share-pack";
import { formatDateTime } from "@/lib/utils";

type KeyRow = {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
};

export default function DevelopersPage() {
  const { currentOrg } = useWorkspace();
  const [keys, setKeys] = useState<KeyRow[]>([]);
  const [token, setToken] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://veriq-peach.vercel.app";

  async function load() {
    if (!currentOrg) return;
    const supabase = createClient();
    const { data } = await supabase
      .from("assets")
      .select("id, name, metadata, created_at")
      .eq("organization_id", currentOrg.id)
      .eq("type", "api_key")
      .order("created_at", { ascending: false });
    setKeys(
      (data ?? []).map((row) => {
        const meta = (row.metadata ?? {}) as { prefix?: string; createdAt?: string };
        return {
          id: row.id,
          name: row.name,
          prefix: meta.prefix ?? "vq_live_…",
          createdAt: meta.createdAt ?? row.created_at,
        };
      }),
    );
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrg]);

  async function onCreate(formData: FormData) {
    if (!currentOrg) return;
    setSaving(true);
    setError(null);
    setToken(null);
    const result = await createOrgApiKey({
      organizationId: currentOrg.id,
      name: String(formData.get("name") ?? ""),
    });
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setToken(result.token ?? null);
    await load();
  }

  async function onRevoke(id: string) {
    if (!currentOrg) return;
    const result = await revokeOrgApiKey({ organizationId: currentOrg.id, id });
    if (result.error) setError(result.error);
    await load();
  }

  if (!currentOrg) return null;

  const companyRef = currentOrg.slug || currentOrg.id;

  return (
    <div>
      <PageHeader
        title="VERIQ API"
        description="Banks, insurers, investors and procurement platforms can query this company's risk intelligence with a Bearer key, or open a read-only share link. Secrets are shown once."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <section className="space-y-6">
          <form
            action={onCreate}
            className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6"
          >
            <h2 className="font-display text-xl">Create a key</h2>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <Label htmlFor="name">Label</Label>
                <Input id="name" name="name" placeholder="Bank due diligence" />
              </div>
              <Button type="submit" disabled={saving}>
                {saving ? "Creating…" : "Create key"}
              </Button>
            </div>
            {error && <p className="mt-3 text-sm text-[var(--critical)]">{error}</p>}
            {token && (
              <div className="mt-4 rounded-xl border border-[var(--accent)] bg-[var(--accent-dim)] p-4">
                <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
                  Copy this now — it will not be shown again
                </p>
                <p className="mt-2 break-all font-mono text-sm text-[var(--ink)]">{token}</p>
              </div>
            )}
          </form>

          {keys.length === 0 ? (
            <EmptyState
              icon={KeyRound}
              title="No API keys"
              description="Create a key and share it with a bank, insurer or investor. Only the hash is stored."
            />
          ) : (
            <ul className="space-y-3">
              {keys.map((key) => (
                <li
                  key={key.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
                >
                  <div>
                    <p className="text-sm text-[var(--ink)]">{key.name}</p>
                    <p className="mt-1 font-mono text-xs text-[var(--muted)]">
                      {key.prefix}… · {formatDateTime(key.createdAt)}
                    </p>
                  </div>
                  <Button variant="danger" size="sm" onClick={() => void onRevoke(key.id)}>
                    Revoke
                  </Button>
                </li>
              ))}
            </ul>
          )}

          <SharePack organizationId={currentOrg.id} kind="diligence" />
          <SharePack organizationId={currentOrg.id} kind="credit" />

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h2 className="font-display text-xl">Endpoints</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="font-mono text-[var(--accent)]">GET /api/v1/company/{"{id}"}/risk</dt>
                <dd className="mt-1 text-[var(--muted)]">
                  Score dimensions for banks and insurers. {"{id}"} is the organisation id or slug.
                </dd>
              </div>
              <div>
                <dt className="font-mono text-[var(--accent)]">
                  GET /api/v1/company/{"{id}"}/diligence
                </dt>
                <dd className="mt-1 text-[var(--muted)]">
                  Investor pack: Company Health Score, pillars, flags, unknowns and questions. Not
                  a valuation.
                </dd>
              </div>
              <div>
                <dt className="font-mono text-[var(--accent)]">
                  GET /api/v1/company/{"{id}"}/credit
                </dt>
                <dd className="mt-1 text-[var(--muted)]">
                  Bank pack: business risk profile. Not a credit rating. Amounts remain UNKNOWN.
                </dd>
              </div>
              <div>
                <dt className="font-mono text-[var(--accent)]">GET /api/v1/company/{"{id}"}</dt>
                <dd className="mt-1 text-[var(--muted)]">
                  Company profile, score, and top open findings. Evidence contents are not returned.
                </dd>
              </div>
              <div>
                <dt className="font-mono text-[var(--accent)]">
                  GET /api/v1/company/{"{id}"}/findings
                </dt>
                <dd className="mt-1 text-[var(--muted)]">Open findings only.</dd>
              </div>
            </dl>
            <pre className="mt-4 overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--elevated)] p-4 text-xs text-[var(--ink)]">
{`curl -H "Authorization: Bearer vq_live_…" \\
  ${origin}/api/v1/company/${companyRef}/risk

curl -H "Authorization: Bearer vq_live_…" \\
  ${origin}/api/v1/company/${companyRef}/diligence

curl -H "Authorization: Bearer vq_live_…" \\
  ${origin}/api/v1/company/${companyRef}/credit`}
            </pre>
            <p className="mt-3 text-xs text-[var(--muted)]">
              Authorization: Bearer. Call this host, not the database. Keys and share tokens are
              hashed at rest. This is intelligence, not a credit score, PD or valuation. A share
              link at /p/{"{token}"} opens the same pack without a login.
            </p>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h2 className="font-display text-xl">Who this is for</h2>
            <ul className="mt-3 space-y-2 text-sm text-[var(--muted)]">
              <li>Banks</li>
              <li>Insurers</li>
              <li>Investors</li>
              <li>Procurement platforms</li>
              <li>Auditors</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <Badge variant="muted">Company</Badge>
            <p className="mt-2 font-mono text-sm text-[var(--ink)]">{companyRef}</p>
            <p className="mt-2 text-xs text-[var(--muted)]">
              A key can only read this organisation. It cannot query another company.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
