"use server";

import { createClient } from "@/lib/supabase/server";
import {
  CLAIMS_ASSET,
  DEFAULT_ATTESTED_CLAIMS,
  type AttestedClaims,
} from "@/lib/claims/assess";
import {
  DIRECTOR_BANDS,
  EMPLOYEE_BANDS,
  PRESENCE_BANDS,
  REVENUE_BANDS,
  type TriState,
} from "@/lib/claims/catalog";

const TRI: TriState[] = ["unknown", "yes", "no"];

function pick<T extends string>(value: string, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

export async function attestClaims(input: {
  organizationId: string;
  employeeBand: string;
  directorBand: string;
  licensedOperator: string;
  africaPresence: string;
  relatedPartySuppliers: string;
  revenueBand: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const attested: AttestedClaims = {
    employeeBand: pick(input.employeeBand, EMPLOYEE_BANDS, DEFAULT_ATTESTED_CLAIMS.employeeBand),
    directorBand: pick(input.directorBand, DIRECTOR_BANDS, DEFAULT_ATTESTED_CLAIMS.directorBand),
    licensedOperator: pick(input.licensedOperator, TRI, DEFAULT_ATTESTED_CLAIMS.licensedOperator),
    africaPresence: pick(input.africaPresence, PRESENCE_BANDS, DEFAULT_ATTESTED_CLAIMS.africaPresence),
    relatedPartySuppliers: pick(
      input.relatedPartySuppliers,
      TRI,
      DEFAULT_ATTESTED_CLAIMS.relatedPartySuppliers,
    ),
    revenueBand: pick(input.revenueBand, REVENUE_BANDS, DEFAULT_ATTESTED_CLAIMS.revenueBand),
  };

  const { data: existing } = await supabase
    .from("assets")
    .select("id")
    .eq("organization_id", input.organizationId)
    .eq("type", CLAIMS_ASSET.type)
    .eq("name", CLAIMS_ASSET.name)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("assets")
      .update({ metadata: attested })
      .eq("id", existing.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from("assets").insert({
      organization_id: input.organizationId,
      type: CLAIMS_ASSET.type,
      name: CLAIMS_ASSET.name,
      metadata: attested,
    });
    if (error) return { error: error.message };
  }

  return { ok: true };
}
