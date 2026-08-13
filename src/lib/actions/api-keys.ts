"use server";

import { createClient } from "@/lib/supabase/server";
import { generateApiKey } from "@/lib/api/keys";
import type { Json } from "@/lib/database.types";

const MAX_KEYS = 5;

export async function createOrgApiKey(input: {
  organizationId: string;
  name: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const name = input.name.trim() || "API key";
  const { data: existing } = await supabase
    .from("assets")
    .select("id")
    .eq("organization_id", input.organizationId)
    .eq("type", "api_key");

  if ((existing ?? []).length >= MAX_KEYS) {
    return { error: "Maximum of 5 API keys per organisation" };
  }

  const generated = generateApiKey();
  const metadata: Json = {
    keyHash: generated.hash,
    prefix: generated.prefix,
    createdAt: new Date().toISOString(),
    name,
  };

  const { error } = await supabase.from("assets").insert({
    organization_id: input.organizationId,
    name,
    type: "api_key",
    criticality: "high",
    metadata,
  });
  if (error) return { error: error.message };

  return { token: generated.token, prefix: generated.prefix };
}

export async function revokeOrgApiKey(input: { organizationId: string; id: string }) {
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
    .eq("type", "api_key");
  if (error) return { error: error.message };
  return { ok: true };
}
