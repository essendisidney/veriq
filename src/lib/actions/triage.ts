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
