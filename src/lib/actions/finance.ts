"use server";

import { createClient } from "@/lib/supabase/server";
import {
  DEFAULT_ATTESTED,
  type AttestedFinance,
  type ConcentrationBand,
  type LiquidityBand,
  type RevenueMix,
  type TriState,
} from "@/lib/finance/assess";

const BANDS: ConcentrationBand[] = ["unknown", "low", "moderate", "high"];
const LIQUIDITY: LiquidityBand[] = ["unknown", "tight", "adequate", "strong"];
const MIX: RevenueMix[] = ["unknown", "transactions", "subscriptions", "mixed"];
const TRI: TriState[] = ["unknown", "yes", "no"];

function pick<T extends string>(value: string, allowed: T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

export async function attestFinance(input: {
  organizationId: string;
  customerConcentration: string;
  liquidity: string;
  revenueMix: string;
  singleSite: string;
  secondaryPaymentRail: string;
  keyPerson: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const attested: AttestedFinance = {
    customerConcentration: pick(input.customerConcentration, BANDS, DEFAULT_ATTESTED.customerConcentration),
    liquidity: pick(input.liquidity, LIQUIDITY, DEFAULT_ATTESTED.liquidity),
    revenueMix: pick(input.revenueMix, MIX, DEFAULT_ATTESTED.revenueMix),
    singleSite: pick(input.singleSite, TRI, DEFAULT_ATTESTED.singleSite),
    keyPerson: pick(input.keyPerson, TRI, DEFAULT_ATTESTED.keyPerson),
    secondaryPaymentRail: pick(
      input.secondaryPaymentRail,
      TRI,
      DEFAULT_ATTESTED.secondaryPaymentRail,
    ),
  };

  const { data: existing } = await supabase
    .from("assets")
    .select("id")
    .eq("organization_id", input.organizationId)
    .eq("type", "finance")
    .eq("name", "Financial signals")
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("assets")
      .update({ metadata: attested, criticality: "high" })
      .eq("id", existing.id);
    if (error) return { error: error.message };
    return { ok: true };
  }

  const { error } = await supabase.from("assets").insert({
    organization_id: input.organizationId,
    name: "Financial signals",
    type: "finance",
    criticality: "high",
    metadata: attested,
  });
  if (error) return { error: error.message };
  return { ok: true };
}
