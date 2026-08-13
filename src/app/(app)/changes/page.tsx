"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bell, GitCompareArrows } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScanButton } from "@/components/scan-button";
import { formatDateTime } from "@/lib/utils";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/actions/notifications";
import type { ChangeItem, ChangeSet, ScanSummarySlice } from "@/lib/changes/diff";

type InboxItem = {
  id: string;
  title: string;
  createdAt: string;
  read: boolean;
  href: string;
  kind: string;
  polarity: string;
  detail: string;
};

const POLARITY: Record<string, { label: string; variant: "accent" | "danger" | "muted" }> = {
  added: { label: "+", variant: "accent" },
  removed: { label: "−", variant: "danger" },
  changed: { label: "~", variant: "muted" },
};

export default function ChangesPage() {
  const { currentOrg } = useWorkspace();
  const [changes, setChanges] = useState<ChangeSet | null>(null);
  const [scannedAt, setScannedAt] = useState<string | null>(null);
  const [inbox, setInbox] = useState<InboxItem[]>([]);
  const [history, setHistory] = useState<{ id: string; at: string; summary: string }[]>([]);
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!currentOrg) return;
    const supabase = createClient();
    const [{ data: scans }, { data: notes }] = await Promise.all([
      supabase
        .from("scans")
        .select("id, created_at, completed_at, summary")
        .eq("organization_id", currentOrg.id)
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(8),
      supabase
        .from("assets")
        .select("id, name, metadata, created_at")
        .eq("organization_id", currentOrg.id)
        .eq("type", "notification")
        .order("created_at", { ascending: false })
        .limit(40),
    ]);
    const latest = scans?.[0]?.summary as ScanSummarySlice | undefined;
    setChanges(latest?.changes ?? null);
    setScannedAt(scans?.[0]?.completed_at ?? scans?.[0]?.created_at ?? null);
    setHistory(
      (scans ?? []).flatMap((scan) => {
        const summary = scan.summary as ScanSummarySlice | undefined;
        if (!summary?.changes) return [];
        return [
          {
            id: scan.id,
            at: scan.completed_at ?? scan.created_at,
            summary: summary.changes.summary,
          },
        ];
      }),
    );
    setInbox(
      (notes ?? []).map((row) => {
        const meta = (row.metadata ?? {}) as {
          read?: boolean;
          href?: string;
          kind?: string;
          polarity?: string;
          detail?: string;
        };
        return {
          id: row.id,
          title: row.name,
          createdAt: row.created_at,
          read: Boolean(meta.read),
          href: meta.href ?? "/changes",
          kind: meta.kind ?? "change",
          polarity: meta.polarity ?? "changed",
          detail: meta.detail ?? "",
        };
      }),
    );
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrg]);

  async function onRead(id: string) {
    setSaving(true);
    await markNotificationRead(id);
    setSaving(false);
    await load();
  }

  async function onReadAll() {
    if (!currentOrg) return;
    setSaving(true);
    await markAllNotificationsRead(currentOrg.id);
    setSaving(false);
    await load();
  }

  if (!currentOrg) return null;

  const unread = inbox.filter((item) => !item.read).length;

  return (
    <div>
      <PageHeader
        title="What changed?"
        description="Each rescan is compared to the previous snapshot. In-app alerts fire only for material movement — VERIQ will not spam."
        actions={
          <ScanButton organizationId={currentOrg.id} label="Rescan" />
        }
      />

      {!changes ? (
        <EmptyState
          icon={GitCompareArrows}
          title="No comparison yet"
          description="Complete a scan, then run a second one. The first snapshot is the baseline."
        />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat label="Added" value={String(changes.added)} />
            <Stat label="Removed" value={String(changes.removed)} />
            <Stat label="Changed" value={String(changes.changed)} />
          </div>
          <p className="text-sm leading-6 text-[var(--muted)]">{changes.summary}</p>
          {scannedAt && (
            <p className="text-xs text-[var(--muted)]">
              Compared at {formatDateTime(scannedAt)}
              {changes.previousScanId ? " against the previous completed scan." : "."}
            </p>
          )}

          {changes.items.length === 0 ? (
            <EmptyState
              icon={GitCompareArrows}
              title="No material change"
              description="Vendors, repositories, findings and exposure matched the previous snapshot."
              className="py-10"
            />
          ) : (
            <ul className="space-y-3">
              {changes.items.map((item) => (
                <ChangeRow key={item.id} item={item} />
              ))}
            </ul>
          )}

          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-[var(--accent)]" />
                <h2 className="font-display text-2xl">In-app alerts</h2>
                {unread > 0 && <Badge variant="accent">{unread} unread</Badge>}
              </div>
              {unread > 0 && (
                <Button type="button" variant="secondary" size="sm" disabled={saving} onClick={() => void onReadAll()}>
                  Mark all read
                </Button>
              )}
            </div>
            <p className="mb-4 text-sm text-[var(--muted)]">
              Email, Slack and Teams are not wired. Alerts stay in VERIQ so a hostname blip does not page the board.
            </p>
            {inbox.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">No alerts yet. Material additions and resolved findings will appear here.</p>
            ) : (
              <ul className="space-y-2">
                {inbox.map((note) => (
                  <li
                    key={note.id}
                    className="flex flex-col gap-2 rounded-xl border border-[var(--border)] bg-[var(--elevated)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className={note.read ? "text-sm text-[var(--muted)]" : "text-sm text-[var(--ink)]"}>
                        {note.title}
                      </p>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        {note.kind} · {formatDateTime(note.createdAt)}
                        {note.detail ? ` · ${note.detail}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link href={note.href} className="text-sm text-[var(--accent)] hover:underline">
                        Open
                      </Link>
                      {!note.read && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={saving}
                          onClick={() => void onRead(note.id)}
                        >
                          Mark read
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {history.length > 1 && (
            <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
              <h2 className="font-display text-2xl">Earlier scans</h2>
              <ul className="mt-4 space-y-2">
                {history.slice(1).map((row) => (
                  <li key={row.id} className="text-sm text-[var(--muted)]">
                    {formatDateTime(row.at)} — {row.summary}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function ChangeRow({ item }: { item: ChangeItem }) {
  const polarity = POLARITY[item.polarity] ?? POLARITY.changed;
  return (
    <li className="flex flex-col gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={polarity.variant}>{polarity.label}</Badge>
          <p className="text-sm font-medium text-[var(--ink)]">{item.title}</p>
        </div>
        <p className="mt-2 text-xs text-[var(--muted)]">
          {item.kind}
          {item.detail ? ` · ${item.detail}` : ""}
        </p>
      </div>
      {item.href && (
        <Link href={item.href} className="shrink-0 text-sm text-[var(--accent)] hover:underline">
          View
        </Link>
      )}
    </li>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <p className="text-xs uppercase tracking-wide text-[var(--muted)]">{label}</p>
      <p className="mt-1 font-display text-3xl">{value}</p>
    </div>
  );
}
