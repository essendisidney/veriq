"use server";

import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/utils";
import { AI_CATALOG, type AiCategory } from "@/lib/ai/catalog";
import {
  DEFAULT_ATTESTED_AI,
  type AttestedAi,
  type TriState,
} from "@/lib/ai/assess";

const TRI: TriState[] = ["unknown", "yes", "no"];
const CATEGORIES: AiCategory[] = [
  "foundation_model",
  "coding_assistant",
  "chatbot",
  "agent",
  "inference",
  "other",
];

function pick<T extends string>(value: string, allowed: T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

export async function attestAi(input: {
  organizationId: string;
  inventory: string;
  humanOversight: string;
  decisionLogging: string;
  customerFacing: string;
  trainsOnCustomerData: string;
  biasTesting: string;
  modelMonitoring: string;
  dataProvenance: string;
  accessControls: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const attested: AttestedAi = {
    inventory: pick(input.inventory, TRI, DEFAULT_ATTESTED_AI.inventory),
    humanOversight: pick(input.humanOversight, TRI, DEFAULT_ATTESTED_AI.humanOversight),
    decisionLogging: pick(input.decisionLogging, TRI, DEFAULT_ATTESTED_AI.decisionLogging),
    customerFacing: pick(input.customerFacing, TRI, DEFAULT_ATTESTED_AI.customerFacing),
    trainsOnCustomerData: pick(
      input.trainsOnCustomerData,
      TRI,
      DEFAULT_ATTESTED_AI.trainsOnCustomerData,
    ),
    biasTesting: pick(input.biasTesting, TRI, DEFAULT_ATTESTED_AI.biasTesting),
    modelMonitoring: pick(input.modelMonitoring, TRI, DEFAULT_ATTESTED_AI.modelMonitoring),
    dataProvenance: pick(input.dataProvenance, TRI, DEFAULT_ATTESTED_AI.dataProvenance),
    accessControls: pick(input.accessControls, TRI, DEFAULT_ATTESTED_AI.accessControls),
  };

  const { data: existing } = await supabase
    .from("assets")
    .select("id")
    .eq("organization_id", input.organizationId)
    .eq("type", "ai_governance")
    .eq("name", "AI governance")
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
    name: "AI governance",
    type: "ai_governance",
    criticality: "high",
    metadata: attested,
  });
  if (error) return { error: error.message };
  return { ok: true };
}

export async function declareAiSystem(input: {
  organizationId: string;
  name: string;
  category: string;
  processesData: boolean;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const name = input.name.trim();
  if (!name) return { error: "System name is required" };

  const catalog = AI_CATALOG.find(
    (item) => item.name.toLowerCase() === name.toLowerCase() || item.id === slugify(name),
  );
  const systemId = catalog?.id ?? slugify(name);
  if (!systemId) return { error: "Could not derive a system id" };

  const { data: existing } = await supabase
    .from("assets")
    .select("id, metadata")
    .eq("organization_id", input.organizationId)
    .eq("type", "ai");

  const match = (existing ?? []).find((row) => {
    const meta = row.metadata as { systemId?: string } | null;
    return meta?.systemId === systemId;
  });

  const metadata = {
    systemId,
    category: catalog?.category ?? pick(input.category, CATEGORIES, "other"),
    processesData: catalog?.processesData ?? input.processesData,
    origin: "declared",
  };

  if (match) {
    const { error } = await supabase
      .from("assets")
      .update({ name: catalog?.name ?? name, metadata, criticality: "high" })
      .eq("id", match.id);
    if (error) return { error: error.message };
    return { systemId };
  }

  const { error } = await supabase.from("assets").insert({
    organization_id: input.organizationId,
    name: catalog?.name ?? name,
    type: "ai",
    criticality: "high",
    metadata,
  });
  if (error) return { error: error.message };
  return { systemId };
}
