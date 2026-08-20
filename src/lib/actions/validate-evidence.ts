"use server";

import { createClient } from "@/lib/supabase/server";

const CONFLICT_STATUSES = ["requires_validation", "validated", "dismissed"] as const;
const EDGE_STATUSES = ["requires_validation", "pending", "validated", "dismissed"] as const;

async function assertMember(organizationId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" as const, supabase: null, userId: null };
  const { data: membership } = await supabase
    .from("memberships")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) return { error: "Not a member of this company" as const, supabase: null, userId: null };
  return { error: null, supabase, userId: user.id };
}

export async function updateConflictValidation(input: {
  organizationId: string;
  conflictId: string;
  status: (typeof CONFLICT_STATUSES)[number];
}) {
  if (!CONFLICT_STATUSES.includes(input.status)) {
    return { error: "Invalid status" };
  }
  const gate = await assertMember(input.organizationId);
  if (gate.error || !gate.supabase) return { error: gate.error ?? "Not authenticated" };

  const { error } = await gate.supabase
    .from("veriq_fact_conflicts")
    .update({ validation_status: input.status })
    .eq("id", input.conflictId)
    .eq("organization_id", input.organizationId);

  if (error) return { error: error.message };
  return { ok: true as const };
}

export async function updateEdgeValidation(input: {
  organizationId: string;
  edgeId: string;
  status: (typeof EDGE_STATUSES)[number];
}) {
  if (!EDGE_STATUSES.includes(input.status)) {
    return { error: "Invalid status" };
  }
  const gate = await assertMember(input.organizationId);
  if (gate.error || !gate.supabase) return { error: gate.error ?? "Not authenticated" };

  const { error } = await gate.supabase
    .from("veriq_edges")
    .update({ validation_status: input.status })
    .eq("id", input.edgeId)
    .eq("organization_id", input.organizationId);

  if (error) return { error: error.message };
  return { ok: true as const };
}
