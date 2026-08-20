"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { ListChecks } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ActionStatusSelect } from "@/components/triage-controls";
import { OWNER_ROLES, updateActionAssignment } from "@/lib/actions/triage";
import { downloadTextFile, slugFile, toCsv } from "@/lib/reports/export";
import { formatDateTime } from "@/lib/utils";
import { isOverdue } from "@/lib/risk/certainty";
import type { Action, ActionPriority } from "@/lib/database.types";

const PRIORITY_RANK: Record<ActionPriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export default function ActionsPage() {
  const { currentOrg } = useWorkspace();
  const [actions, setActions] = useState<Action[]>([]);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!currentOrg) return;
    const supabase = createClient();
    const { data } = await supabase
      .from("actions")
      .select("*")
      .eq("organization_id", currentOrg.id)
      .order("created_at", { ascending: false });
    setActions((data as Action[]) ?? []);
  }

  useEffect(() => {
    void load();
  }, [currentOrg]);

  const sorted = useMemo(() => {
    return [...actions].sort((a, b) => {
      const openA = a.status === "done" || a.status === "cancelled" ? 1 : 0;
      const openB = b.status === "done" || b.status === "cancelled" ? 1 : 0;
      if (openA !== openB) return openA - openB;
      return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    });
  }, [actions]);

  return (
    <div>
      <PageHeader
        title="Actions"
        description="What management should do next. Critical actions have a 24-hour SLA. Assign an owner and deadline — VERIQ does not change production systems."
        actions={
          sorted.length > 0 ? (
            <Button
              variant="secondary"
              onClick={() =>
                downloadTextFile(
                  `${slugFile(currentOrg?.name ?? "veriq")}-actions.csv`,
                  toCsv([
                    ["Title", "Owner", "Priority", "Deadline", "Status"],
                    ...sorted.map((action) => [
                      action.title,
                      action.owner_role ?? "Unassigned",
                      action.priority,
                      action.deadline ?? "",
                      action.status,
                    ]),
                  ]),
                  "text/csv",
                )
              }
            >
              Export CSV
            </Button>
          ) : null
        }
      />
      {error && <p className="mb-4 text-sm text-[var(--critical)]">{error}</p>}
      {sorted.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="No actions yet"
          description="Recommended actions are created from scan findings."
        />
      ) : (
        <ul className="space-y-3">
          {sorted.map((action) => {
            const overdue = isOverdue(action.deadline, action.status);
            const deadlineValue = action.deadline ? action.deadline.slice(0, 10) : "";
            return (
              <li
                key={action.id}
                className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-5 py-4"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    {action.risk_id ? (
                      <Link
                        href={`/findings/${action.risk_id}`}
                        className="text-sm font-medium text-[var(--ink)] hover:text-[var(--accent)]"
                      >
                        {action.title}
                      </Link>
                    ) : (
                      <p className="text-sm font-medium text-[var(--ink)]">{action.title}</p>
                    )}
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      {action.owner_role ?? "Unassigned"}
                      {action.deadline ? ` · due ${formatDateTime(action.deadline)}` : ""}
                      {overdue ? " · overdue" : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={action.priority}>{action.priority}</Badge>
                    {overdue && <Badge variant="danger">Overdue</Badge>}
                    <ActionStatusSelect
                      organizationId={action.organization_id}
                      actionId={action.id}
                      status={action.status}
                    />
                  </div>
                </div>
                <div className="flex flex-wrap items-end gap-3 border-t border-[var(--border)] pt-3">
                  <label className="text-xs text-[var(--muted)]">
                    Owner
                    <select
                      className="mt-1 block h-9 min-w-[140px] rounded-lg border border-[var(--border)] bg-[var(--elevated)] px-2 text-xs text-[var(--ink)]"
                      value={action.owner_role ?? "Unassigned"}
                      disabled={pending}
                      onChange={(e) => {
                        const ownerRole = e.target.value;
                        setError(null);
                        startTransition(async () => {
                          const result = await updateActionAssignment({
                            organizationId: action.organization_id,
                            actionId: action.id,
                            ownerRole,
                          });
                          if (result.error) {
                            setError(result.error);
                            return;
                          }
                          await load();
                        });
                      }}
                    >
                      {OWNER_ROLES.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                      {action.owner_role &&
                        !(OWNER_ROLES as readonly string[]).includes(action.owner_role) && (
                          <option value={action.owner_role}>{action.owner_role}</option>
                        )}
                    </select>
                  </label>
                  <label className="text-xs text-[var(--muted)]">
                    Deadline
                    <input
                      type="date"
                      className="mt-1 block h-9 rounded-lg border border-[var(--border)] bg-[var(--elevated)] px-2 text-xs text-[var(--ink)]"
                      value={deadlineValue}
                      disabled={pending}
                      onChange={(e) => {
                        const deadline = e.target.value || null;
                        setError(null);
                        startTransition(async () => {
                          const result = await updateActionAssignment({
                            organizationId: action.organization_id,
                            actionId: action.id,
                            deadline,
                          });
                          if (result.error) {
                            setError(result.error);
                            return;
                          }
                          await load();
                        });
                      }}
                    />
                  </label>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
