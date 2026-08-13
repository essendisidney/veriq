"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/components/workspace/workspace-provider";

export function NotificationBell() {
  const { currentOrg } = useWorkspace();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!currentOrg) return;
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from("assets")
        .select("metadata")
        .eq("organization_id", currentOrg!.id)
        .eq("type", "notification")
        .order("created_at", { ascending: false })
        .limit(40);
      setUnread(
        (data ?? []).filter((row) => {
          const meta = row.metadata as { read?: boolean } | null;
          return !meta?.read;
        }).length,
      );
    }
    void load();
  }, [currentOrg]);

  return (
    <Link
      href="/changes"
      className="relative inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--elevated)] px-3 py-1.5 text-sm text-[var(--ink)] hover:border-[var(--accent)]"
      aria-label={unread ? `${unread} unread changes` : "What changed"}
    >
      <Bell className="h-4 w-4 text-[var(--accent)]" />
      <span className="hidden sm:inline">Changes</span>
      {unread > 0 && (
        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[10px] font-medium text-[var(--bg)]">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}
