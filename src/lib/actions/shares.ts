"use server";

import { createClient } from "@/lib/supabase/server";
import { generateShareToken } from "@/lib/api/keys";
import type { Json } from "@/lib/database.types";

export type ShareKind = "diligence" | "credit" | "restructuring";

const MAX_SHARES = 8;
const SHARE_TTL_DAYS = 14;

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
  if (input.kind !== "diligence" && input.kind !== "credit" && input.kind !== "restructuring") {
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
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + SHARE_TTL_DAYS * 86_400_000);
  const name =
    input.name?.trim() ||
    (input.kind === "diligence"
      ? "Investor pack"
      : input.kind === "credit"
        ? "Bank pack"
        : "Counsel / IP pack");
  const metadata: Json = {
    keyHash: generated.hash,
    prefix: generated.prefix,
    createdAt: createdAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    kind: input.kind,
    name,
    openCount: 0,
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
