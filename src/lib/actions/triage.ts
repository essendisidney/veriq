"use server";

import { createClient } from "@/lib/supabase/server";
import type { ActionStatus, RiskStatus } from "@/lib/database.types";

const RISK_STATUSES: RiskStatus[] = [
  "open",
  "acknowledged",
  "in_progress",
  "resolved",
  "accepted",
];

const ACTION_STATUSES: ActionStatus[] = [
  "open",
  "in_progress",
  "done",
  "cancelled",
];

export async function updateRiskStatus(input: {
  organizationId: string;
  riskId: string;
  status: RiskStatus;
}) {
  if (!RISK_STATUSES.includes(input.status)) {
    return { error: "Invalid status" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("risks")
    .update({ status: input.status, updated_at: new Date().toISOString() })
    .eq("id", input.riskId)
    .eq("organization_id", input.organizationId);

  if (error) return { error: error.message };
  return { ok: true };
}

export async function updateActionStatus(input: {
  organizationId: string;
  actionId: string;
  status: ActionStatus;
}) {
  if (!ACTION_STATUSES.includes(input.status)) {
    return { error: "Invalid status" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("actions")
    .update({ status: input.status, updated_at: new Date().toISOString() })
    .eq("id", input.actionId)
    .eq("organization_id", input.organizationId);

  if (error) return { error: error.message };
  return { ok: true };
}

const OWNER_ROLES = [
  "Unassigned",
  "CEO",
  "CFO",
  "CTO",
  "COO",
  "Legal",
  "Compliance",
  "Finance",
  "Security",
  "Risk",
  "Board",
  "Operations",
] as const;

export async function updateActionAssignment(input: {
  organizationId: string;
  actionId: string;
  ownerRole?: string | null;
  deadline?: string | null;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const patch: { owner_role?: string | null; deadline?: string | null; updated_at: string } = {
    updated_at: new Date().toISOString(),
  };

  if (input.ownerRole !== undefined) {
    const role = (input.ownerRole ?? "").trim();
    if (role && role !== "Unassigned" && !OWNER_ROLES.includes(role as (typeof OWNER_ROLES)[number])) {
      if (role.length > 40) return { error: "Owner role is too long" };
    }
    patch.owner_role = !role || role === "Unassigned" ? null : role;
  }

  if (input.deadline !== undefined) {
    if (input.deadline === null || input.deadline === "") {
      patch.deadline = null;
    } else {
      const parsed = new Date(input.deadline);
      if (Number.isNaN(parsed.getTime())) return { error: "Invalid deadline" };
      patch.deadline = parsed.toISOString();
    }
  }

  const { error } = await supabase
    .from("actions")
    .update(patch)
    .eq("id", input.actionId)
    .eq("organization_id", input.organizationId);

  if (error) return { error: error.message };
  return { ok: true };
}

export { OWNER_ROLES };
