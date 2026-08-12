"use client";

import { useEffect, useState } from "react";
import { ListChecks } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import type { Action } from "@/lib/database.types";

export default function ActionsPage() {
  const { currentOrg } = useWorkspace();
  const [actions, setActions] = useState<Action[]>([]);

  useEffect(() => {
    if (!currentOrg) return;
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from("actions")
        .select("*")
        .eq("organization_id", currentOrg!.id)
        .order("created_at", { ascending: false });
      setActions((data as Action[]) ?? []);
    }
    void load();
  }, [currentOrg]);

  return (
    <div>
      <PageHeader
        title="Actions"
        description="What management should do next. Advisory only — VERIQ does not change production systems."
      />
      {actions.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="No actions yet"
          description="Recommended actions are created from scan findings."
        />
      ) : (
        <ul className="space-y-3">
          {actions.map((action) => (
            <li
              key={action.id}
              className="flex flex-col gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-sm font-medium text-[var(--ink)]">
                  {action.title}
                </p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {action.owner_role ?? "Unassigned"}
                </p>
              </div>
              <div className="flex gap-2">
                <Badge variant="muted">{action.priority}</Badge>
                <Badge>{action.status.replace("_", " ")}</Badge>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
