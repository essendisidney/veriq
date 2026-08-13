"use server";

import { createClient } from "@/lib/supabase/server";
import { generateShareToken } from "@/lib/api/keys";
import type { Json } from "@/lib/database.types";

export type ShareKind = "diligence" | "credit";

const MAX_SHARES = 8;

export async function createOrgShareLink(input: {
  organizationId: string;
  kind: ShareKind;
  name?: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  if (input.kind !== "diligence" && input.kind !== "credit") {
    return { error: "Invalid pack" };
  }

  const { data: existing } = await supabase
    .from("assets")
    .select("id")
    .eq("organization_id", input.organizationId)
    .eq("type", "share_link");
  if ((existing ?? []).length >= MAX_SHARES) {
    return { error: "Maximum of 8 share links per organisation" };
  }

  const generated = generateShareToken();
  const name =
    input.name?.trim() ||
    (input.kind === "diligence" ? "Investor pack" : "Bank pack");
  const metadata: Json = {
    keyHash: generated.hash,
    prefix: generated.prefix,
    createdAt: new Date().toISOString(),
    kind: input.kind,
    name,
  };

  const { error } = await supabase.from("assets").insert({
    organization_id: input.organizationId,
    name,
    type: "share_link",
    criticality: "high",
    metadata,
  });
  if (error) return { error: error.message };

  return { token: generated.token, prefix: generated.prefix, kind: input.kind };
}

export async function revokeOrgShareLink(input: {
  organizationId: string;
  id: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("assets")
    .delete()
    .eq("id", input.id)
    .eq("organization_id", input.organizationId)
    .eq("type", "share_link");
  if (error) return { error: error.message };
  return { ok: true };
}
