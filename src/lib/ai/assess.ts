import type { TrustStatus } from "@/lib/database.types";
import {
  AI_CATALOG,
  AI_CATEGORY_LABELS,
  type AiCategory,
} from "@/lib/ai/catalog";
import type { VendorMap } from "@/lib/vendors/assess";

export type TriState = "unknown" | "yes" | "no";

export type AttestedAi = {
  inventory: TriState;
  humanOversight: TriState;
  decisionLogging: TriState;
  customerFacing: TriState;
  trainsOnCustomerData: TriState;
  biasTesting: TriState;
  modelMonitoring: TriState;
  dataProvenance: TriState;
  accessControls: TriState;
};

export const DEFAULT_ATTESTED_AI: AttestedAi = {
  inventory: "unknown",
  humanOversight: "unknown",
  decisionLogging: "unknown",
  customerFacing: "unknown",
  trainsOnCustomerData: "unknown",
  biasTesting: "unknown",
  modelMonitoring: "unknown",
  dataProvenance: "unknown",
  accessControls: "unknown",
};

export type AiSystem = {
  id: string;
  name: string;
  category: AiCategory;
  processesData: boolean;
  origin: "observed" | "declared";
  sources: { kind: "website" | "github" | "vendor" | "declared"; reference: string }[];
  trustStatus: TrustStatus;
};

export type AiAssessment = {
  systems: AiSystem[];
  attested: AttestedAi;
  unknowns: string[];
  posture: number;
  summary: string;
};

export function parseAttestedAi(metadata: unknown): AttestedAi {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return { ...DEFAULT_ATTESTED_AI };
  }
  const row = metadata as Partial<AttestedAi>;
  return {
    inventory: row.inventory ?? "unknown",
    humanOversight: row.humanOversight ?? "unknown",
    decisionLogging: row.decisionLogging ?? "unknown",
    customerFacing: row.customerFacing ?? "unknown",
    trainsOnCustomerData: row.trainsOnCustomerData ?? "unknown",
    biasTesting: row.biasTesting ?? "unknown",
    modelMonitoring: row.modelMonitoring ?? "unknown",
    dataProvenance: row.dataProvenance ?? "unknown",
    accessControls: row.accessControls ?? "unknown",
  };
}

export function systemFromAsset(row: {
  name: string;
  metadata: unknown;
}): AiSystem | null {
  if (!row.metadata || typeof row.metadata !== "object" || Array.isArray(row.metadata)) {
    return null;
  }
  const meta = row.metadata as {
    systemId?: string;
    category?: AiCategory;
    processesData?: boolean;
    origin?: "observed" | "declared";
  };
  if (!meta.systemId) return null;
  const origin = meta.origin === "observed" ? "observed" : "declared";
  return {
    id: meta.systemId,
    name: row.name,
    category: meta.category ?? "other",
    processesData: Boolean(meta.processesData),
    origin,
    sources: [{ kind: origin === "observed" ? "website" : "declared", reference: "register" }],
    trustStatus: origin === "observed" ? "observed" : "unknown",
  };
}

export function detectAi(input: {
  html?: string;
  packages?: string[];
  vendors?: VendorMap | null;
}): AiSystem[] {
  const html = (input.html ?? "").toLowerCase();
  const packages = input.packages ?? [];
  const found = new Map<string, AiSystem>();

  for (const def of AI_CATALOG) {
    const sources: AiSystem["sources"] = [];
    for (const needle of def.html) {
      if (html.includes(needle.toLowerCase())) {
        sources.push({ kind: "website", reference: needle });
        break;
      }
    }
    for (const pkg of def.packages) {
      if (packages.includes(pkg)) {
        sources.push({ kind: "github", reference: pkg });
        break;
      }
    }
    const vendor = input.vendors?.vendors.find((item) => item.id === def.id);
    if (vendor) {
      sources.push({ kind: "vendor", reference: vendor.name });
    }
    if (!sources.length) continue;
    found.set(def.id, {
      id: def.id,
      name: def.name,
      category: def.category,
      processesData: def.processesData,
      origin: "observed",
      sources,
      trustStatus: "observed",
    });
  }

  return [...found.values()];
}

export function assessAi(input: {
  detected: AiSystem[];
  declared?: AiSystem[];
  attested?: AttestedAi | null;
}): AiAssessment {
  const attested = input.attested ?? { ...DEFAULT_ATTESTED_AI };
  const byId = new Map<string, AiSystem>();
  for (const system of input.declared ?? []) byId.set(system.id, system);
  for (const system of input.detected) {
    const existing = byId.get(system.id);
    if (!existing) {
      byId.set(system.id, system);
      continue;
    }
    byId.set(system.id, {
      ...existing,
      ...system,
      sources: [...existing.sources, ...system.sources],
      origin: "observed",
      trustStatus: "observed",
    });
  }
  const systems = [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));

  const unknowns: string[] = [];
  if (attested.inventory === "unknown") unknowns.push("AI system inventory");
  if (attested.humanOversight === "unknown") unknowns.push("Human oversight");
  if (attested.decisionLogging === "unknown") unknowns.push("Decision logging");
  if (attested.customerFacing === "unknown") unknowns.push("Customer-facing AI");
  if (attested.trainsOnCustomerData === "unknown") {
    unknowns.push("Training on customer data");
  }
  if (attested.biasTesting === "unknown") unknowns.push("Bias testing");
  if (attested.modelMonitoring === "unknown") unknowns.push("Model monitoring");
  if (attested.dataProvenance === "unknown") unknowns.push("Data provenance");
  if (attested.accessControls === "unknown") unknowns.push("Access controls");
  if (!systems.length) unknowns.push("Whether AI is used at all");

  let posture = 72;
  if (!systems.length && attested.inventory === "unknown") posture -= 4;
  if (systems.length && attested.inventory === "unknown") posture -= 10;
  if (systems.length && attested.humanOversight !== "yes") posture -= 8;
  if (systems.length && attested.decisionLogging !== "yes") posture -= 6;
  if (attested.customerFacing === "yes" && attested.humanOversight !== "yes") posture -= 10;
  if (attested.trainsOnCustomerData === "yes") posture -= 8;
  if (systems.length && attested.biasTesting === "unknown") posture -= 3;
  if (systems.length && attested.accessControls === "unknown") posture -= 3;
  posture = Math.max(18, Math.min(92, posture));

  const summary = systems.length
    ? `${systems.length} AI system${systems.length === 1 ? "" : "s"} mapped (${systems.map((item) => item.name).join(", ")}). Governance artefacts that were not attested stay UNKNOWN.`
    : attested.inventory === "yes"
      ? "An inventory was attested but no system was observed on the public site or in scanned packages."
      : "AI usage is UNKNOWN. VERIQ will not assume Copilot, ChatGPT or an internal model is absent.";

  return { systems, attested, unknowns, posture, summary };
}

export { AI_CATEGORY_LABELS };
