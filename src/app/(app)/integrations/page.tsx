"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plug } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  createOrgWebhook,
  revokeOrgWebhook,
  saveScanCadence,
  testOrgWebhook,
} from "@/lib/actions/integrations";
import { CADENCES, parseCadence, type ScanCadence } from "@/lib/webhooks/cadence";
import { formatDateTime } from "@/lib/utils";

type HookRow = {
  id: string;
  name: string;
  url: string;
  prefix: string;
  lastStatus: number | null;
  lastError: string | null;
  lastDeliveredAt: string | null;
};

export default function IntegrationsPage() {
  const { currentOrg } = useWorkspace();
  const [hooks, setHooks] = useState<HookRow[]>([]);
  const [cadence, setCadence] = useState<ScanCadence>("off");
  const [nextDueAt, setNextDueAt] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cadenceMessage, setCadenceMessage] = useState<string | null>(null);

  async function load() {
    if (!currentOrg) return;
    const supabase = createClient();
    const [{ data: hookRows }, { data: monitoring }] = await Promise.all([
      supabase
        .from("assets")
        .select("id, name, metadata, created_at")
        .eq("organization_id", currentOrg.id)
        .eq("type", "webhook")
        .order("created_at", { ascending: false }),
      supabase
        .from("assets")
        .select("metadata")
        .eq("organization_id", currentOrg.id)
        .eq("type", "monitoring")
        .eq("name", "Monitoring")
        .maybeSingle(),
    ]);
    setHooks(
      (hookRows ?? []).map((row) => {
        const meta = (row.metadata ?? {}) as {
          url?: string;
          prefix?: string;
          lastStatus?: number | null;
          lastError?: string | null;
          lastDeliveredAt?: string | null;
        };
        return {
          id: row.id,
          name: row.name,
          url: meta.url ?? "",
          prefix: meta.prefix ?? "vq_hook_…",
          lastStatus: meta.lastStatus ?? null,
          lastError: meta.lastError ?? null,
          lastDeliveredAt: meta.lastDeliveredAt ?? null,
        };
      }),
    );
    const meta = (monitoring?.metadata ?? {}) as { cadence?: string; nextDueAt?: string };
    setCadence(parseCadence(meta.cadence));
    setNextDueAt(meta.nextDueAt ?? null);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrg]);

  async function onCreate(formData: FormData) {
    if (!currentOrg) return;
    setSaving(true);
    setError(null);
    setSecret(null);
    const result = await createOrgWebhook({
      organizationId: currentOrg.id,
      name: String(formData.get("name") ?? ""),
      url: String(formData.get("url") ?? ""),
    });
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setSecret(result.secret ?? null);
    await load();
  }

  async function onRevoke(id: string) {
    if (!currentOrg) return;
    const result = await revokeOrgWebhook({ organizationId: currentOrg.id, id });
    if (result.error) setError(result.error);
    await load();
  }

  async function onTest(id: string) {
    if (!currentOrg) return;
    setTestingId(id);
    setError(null);
    const result = await testOrgWebhook({ organizationId: currentOrg.id, id });
    setTestingId(null);
    if (result.error) setError(result.error);
    await load();
  }

  async function onCadence(next: ScanCadence) {
    if (!currentOrg) return;
    setCadence(next);
    setCadenceMessage(null);
    const result = await saveScanCadence({ organizationId: currentOrg.id, cadence: next });
    if (result.error) {
      setCadenceMessage(result.error);
      return;
    }
    setCadenceMessage(next === "off" ? "Monitoring off." : `Monitoring set to ${next}.`);
    await load();
  }

  if (!currentOrg) return null;

  return (
    <div>
      <PageHeader
        title="Integrations"
        description="Schedule scans in this session and push scan.completed events to HTTPS endpoints you control."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <section className="space-y-6">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h2 className="font-display text-xl">Scan cadence</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              Daily and weekly scans run when someone in this organisation opens VERIQ and a scan
              is due. Background cron is not enabled.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {CADENCES.map((option) => (
                <Button
                  key={option}
                  type="button"
                  size="sm"
                  variant={cadence === option ? "primary" : "secondary"}
                  onClick={() => void onCadence(option)}
                >
                  {option === "off" ? "Off" : option === "daily" ? "Daily" : "Weekly"}
                </Button>
              ))}
            </div>
            {nextDueAt && cadence !== "off" && (
              <p className="mt-3 text-xs text-[var(--muted)]">
                Next due {formatDateTime(nextDueAt)}
              </p>
            )}
            {cadenceMessage && (
              <p className="mt-3 text-sm text-[var(--muted)]">{cadenceMessage}</p>
            )}
          </div>

          <form
            action={onCreate}
            className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6"
          >
            <h2 className="font-display text-xl">Outbound webhook</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              HTTPS only. Private, loopback and metadata addresses are rejected. Redirects are not
              followed. The signing secret is shown once.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1.4fr_auto] sm:items-end">
              <div>
                <Label htmlFor="name">Label</Label>
                <Input id="name" name="name" placeholder="SIEM" />
              </div>
              <div>
                <Label htmlFor="url">HTTPS URL</Label>
                <Input
                  id="url"
                  name="url"
                  type="url"
                  placeholder="https://example.com/veriq"
                  required
                />
              </div>
              <Button type="submit" disabled={saving}>
                {saving ? "Creating…" : "Create"}
              </Button>
            </div>
            {error && <p className="mt-3 text-sm text-[var(--critical)]">{error}</p>}
            {secret && (
              <div className="mt-4 rounded-xl border border-[var(--accent)] bg-[var(--accent-dim)] p-4">
                <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
                  Copy this now — it will not be shown again
                </p>
                <p className="mt-2 break-all font-mono text-sm text-[var(--ink)]">{secret}</p>
              </div>
            )}
          </form>

          {hooks.length === 0 ? (
            <EmptyState
              icon={Plug}
              title="No webhooks"
              description="Create an HTTPS endpoint to receive scan.completed events. Evidence contents and secrets are never sent."
            />
          ) : (
            <ul className="space-y-3">
              {hooks.map((hook) => (
                <li
                  key={hook.id}
                  className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm text-[var(--ink)]">{hook.name}</p>
                      <p className="mt-1 break-all font-mono text-xs text-[var(--muted)]">
                        {hook.url}
                      </p>
                      <p className="mt-1 font-mono text-xs text-[var(--muted)]">
                        {hook.prefix}…
                        {hook.lastDeliveredAt
                          ? ` · last ${formatDateTime(hook.lastDeliveredAt)}`
                          : " · not delivered yet"}
                      </p>
                      {hook.lastError ? (
                        <p className="mt-1 text-xs text-[var(--critical)]">{hook.lastError}</p>
                      ) : hook.lastStatus ? (
                        <p className="mt-1 text-xs text-[var(--muted)]">HTTP {hook.lastStatus}</p>
                      ) : null}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={testingId === hook.id}
                        onClick={() => void onTest(hook.id)}
                      >
                        {testingId === hook.id ? "Sending…" : "Test"}
                      </Button>
                      <Button variant="danger" size="sm" onClick={() => void onRevoke(hook.id)}>
                        Revoke
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h2 className="font-display text-xl">Events</h2>
            <dl className="mt-3 space-y-3 text-sm">
              <div>
                <dt className="font-mono text-[var(--accent)]">scan.completed</dt>
                <dd className="mt-1 text-[var(--muted)]">
                  Score, change counts, and alert titles. No evidence body, no secrets.
                </dd>
              </div>
              <div>
                <dt className="font-mono text-[var(--accent)]">webhook.test</dt>
                <dd className="mt-1 text-[var(--muted)]">Sent when you click Test.</dd>
              </div>
            </dl>
            <p className="mt-4 text-xs leading-5 text-[var(--muted)]">
              Headers: <span className="font-mono">x-veriq-event</span>,{" "}
              <span className="font-mono">x-veriq-delivery</span>,{" "}
              <span className="font-mono">x-veriq-signature</span> (
              <span className="font-mono">sha256=…</span>).
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <Badge variant="muted">Not wired</Badge>
            <ul className="mt-3 space-y-2 text-sm text-[var(--muted)]">
              <li>Email</li>
              <li>Slack</li>
              <li>Microsoft Teams</li>
            </ul>
            <p className="mt-3 text-xs leading-5 text-[var(--muted)]">
              Pull intelligence with a Bearer key on{" "}
              <Link href="/developers" className="text-[var(--accent)] hover:underline">
                VERIQ API
              </Link>
              .
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
