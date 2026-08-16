"use server";

import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/database.types";
import {
  REGULATION_ATTEST_ASSET,
  attestedKeysFor,
  parseRegulationAttestations,
  pickArtefactBand,
  type RegulationAttestations,
} from "@/lib/regulations/attest";

export async function attestRegulation(input: {
  organizationId: string;
  code: string;
  values: Record<string, string>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const keys = attestedKeysFor(input.code);
  if (!keys.length) return { error: "Nothing to attest on this statute" };

  const artefacts: Record<string, string> = {};
  for (const need of keys) {
    artefacts[need.key] = pickArtefactBand(input.values[need.key] ?? "unknown");
  }

  const { data: existing } = await supabase
    .from("assets")
    .select("id, metadata")
    .eq("organization_id", input.organizationId)
    .eq("type", REGULATION_ATTEST_ASSET.type)
    .eq("name", REGULATION_ATTEST_ASSET.name)
    .maybeSingle();

  const current = parseRegulationAttestations(existing?.metadata);
  const next: RegulationAttestations = {
    ...current,
    [input.code]: artefacts as RegulationAttestations[string],
  };

  if (existing) {
    const { error } = await supabase
      .from("assets")
      .update({ metadata: next as Json, criticality: "high" })
      .eq("id", existing.id);
    if (error) return { error: error.message };
    return { ok: true };
  }

  const { error } = await supabase.from("assets").insert({
    organization_id: input.organizationId,
    name: REGULATION_ATTEST_ASSET.name,
    type: REGULATION_ATTEST_ASSET.type,
    criticality: "high",
    metadata: next as Json,
  });
  if (error) return { error: error.message };
  return { ok: true };
}
