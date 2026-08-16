import type { TrustStatus } from "@/lib/database.types";
import type { AiAssessment } from "@/lib/ai/assess";
import type { RegulationAssessment } from "@/lib/regulations/assess";
import type { Exposure } from "@/lib/scan/exposure";
import type { VendorMap } from "@/lib/vendors/assess";
import {
  WORLD_CATALOG,
  WORLD_KIND_LABELS,
  type WorldDef,
  type WorldKind,
} from "@/lib/world/catalog";

export type WorldRelevance = "material" | "watch" | "unknown" | "none";

export type WorldHit = {
  id: string;
  title: string;
  kind: WorldKind;
  summary: string;
  relevance: WorldRelevance;
  reason: string;
  matchedVendors: string[];
  matchedRegulations: string[];
  trustStatus: TrustStatus;
};

export type WorldAssessment = {
  events: WorldHit[];
  material: number;
  watch: number;
  unknown: number;
  summary: string;
};

export function assessWorld(input: {
  country: string;
  industry: string;
  vendors: VendorMap | null;
  ai: AiAssessment | null;
  assessments: RegulationAssessment[];
  exposure: Exposure | null;
  packageCount: number;
}): WorldAssessment {
  const vendorIds = new Set((input.vendors?.vendors ?? []).map((item) => item.id));
  const vendorById = new Map(
    (input.vendors?.vendors ?? []).map((item) => [item.id, item] as const),
  );
  const codes = new Set(input.assessments.map((item) => item.code));
  const payment = (input.vendors?.vendors ?? []).some((item) => item.category === "payments");
  const hosts = (input.vendors?.vendors ?? []).filter(
    (item) => item.category === "hosting" || item.category === "cdn",
  ).length;
  const weakEmail =
    input.exposure != null && (!input.exposure.spf || !input.exposure.dmarc);
  const hasAi = Boolean(input.ai?.systems.length);

  const events: WorldHit[] = [];
  for (const def of WORLD_CATALOG) {
    const hit = relevanceFor(def, {
      country: input.country,
      industry: input.industry,
      vendorIds,
      vendorById,
      codes,
      payment,
      hosts,
      weakEmail,
      hasAi,
      packageCount: input.packageCount,
    });
    if (hit.relevance === "none") continue;
    events.push(hit);
  }

  const material = events.filter((item) => item.relevance === "material").length;
  const watch = events.filter((item) => item.relevance === "watch").length;
  const unknown = events.filter((item) => item.relevance === "unknown").length;
  const ranked = [...events].sort((a, b) => rank(a.relevance) - rank(b.relevance));

  const summary = material
    ? `${material} external condition${material === 1 ? "" : "s"} matter to this company. VERIQ will not invent that an incident is underway.`
    : watch || unknown
      ? `${watch} watch item${watch === 1 ? "" : "s"} and ${unknown} UNKNOWN. No material external condition was inferred from the company model.`
      : "No catalogued external condition matched this country, industry, vendor set or AI usage.";

  return { events: ranked, material, watch, unknown, summary };
}

function relevanceFor(
  def: WorldDef,
  ctx: {
    country: string;
    industry: string;
    vendorIds: Set<string>;
    vendorById: Map<string, { id: string; name: string }>;
    codes: Set<string>;
    payment: boolean;
    hosts: number;
    weakEmail: boolean;
    hasAi: boolean;
    packageCount: number;
  },
): WorldHit {
  const jurisdiction =
    def.jurisdictions === "*" || def.jurisdictions.includes(ctx.country);
  const industry =
    def.industries === "*" || def.industries.includes(ctx.industry);
  const matchedVendors = (def.vendorIds ?? [])
    .filter((id) => ctx.vendorIds.has(id))
    .map((id) => ctx.vendorById.get(id)?.name ?? id);
  const matchedRegulations = (def.regulationCodes ?? []).filter((code) =>
    ctx.codes.has(code),
  );

  const reasons: string[] = [];
  let relevance: WorldRelevance = "none";
  let trustStatus: TrustStatus = "inferred";

  if (def.needsWeakEmailAuth) {
    if (ctx.weakEmail) {
      relevance = "material";
      reasons.push("SPF and/or DMARC were not observed on the public domain.");
    }
  } else if (def.needsGithub) {
    if (ctx.packageCount > 0) {
      relevance = ctx.packageCount >= 8 ? "material" : "watch";
      reasons.push(`${ctx.packageCount} packages were observed in scanned manifests.`);
    }
  } else if (def.id === "pep-sanctions-unknown") {
    relevance = "unknown";
    reasons.push("VERIQ does not operate PEP, sanctions or leak databases. Status is UNKNOWN.");
    trustStatus = "unknown";
  } else if (def.id === "eu-ai-act") {
    if (ctx.hasAi) {
      relevance = ctx.country === "GB" ? "watch" : "unknown";
      reasons.push(
        "AI systems are mapped. Whether any system is placed on the EU market is UNKNOWN.",
      );
      trustStatus = "unknown";
    }
  } else if (def.id === "dora-ict") {
    if (industry) {
      relevance = "unknown";
      reasons.push(
        "Financial industry is mapped. Whether the company is an EU financial entity or a critical ICT provider to one is UNKNOWN.",
      );
      trustStatus = "unknown";
    }
  } else if (def.needsPayment && def.vendorIds?.length) {
    if (matchedVendors.length) {
      relevance = "material";
      reasons.push(`Observed payment rail: ${matchedVendors.join(", ")}.`);
    } else if (jurisdiction && industry && ctx.payment) {
      relevance = "watch";
      reasons.push("A payment vendor is mapped, but not one of the catalogued rails.");
    } else if (jurisdiction && industry) {
      relevance = "unknown";
      reasons.push("Payment industry is mapped; the collection rail was not observed.");
      trustStatus = "unknown";
    }
  } else if (def.needsHost && def.vendorIds?.length) {
    if (matchedVendors.length) {
      relevance = ctx.hosts <= 1 ? "material" : "watch";
      reasons.push(
        ctx.hosts <= 1
          ? `Production hosting appears concentrated on ${matchedVendors.join(", ")}.`
          : `Observed hosts: ${matchedVendors.join(", ")}.`,
      );
    }
  } else if (def.vendorIds?.length) {
    if (matchedVendors.length) {
      relevance = "material";
      reasons.push(`Observed: ${matchedVendors.join(", ")}.`);
    }
  } else if (def.needsAi) {
    if (ctx.hasAi && jurisdiction && industry) {
      relevance = "watch";
      reasons.push("AI systems are mapped on the company model.");
    }
  }

  if (relevance === "none" && jurisdiction && industry) {
    if (matchedRegulations.length) {
      relevance = "watch";
      reasons.push(`Mapped statute: ${matchedRegulations.join(", ")}.`);
    } else if (
      !def.vendorIds?.length &&
      !def.needsAi &&
      !def.needsGithub &&
      !def.needsWeakEmailAuth &&
      !def.needsPayment &&
      !def.needsHost
    ) {
      relevance = "watch";
      reasons.push(`${ctx.country} / ${ctx.industry} match this standing public condition.`);
    }
  }

  if (relevance !== "none" && !reasons.length) {
    reasons.push("Matched from the company model. Direct impact stays UNKNOWN.");
    trustStatus = "unknown";
  }

  return {
    id: def.id,
    title: def.title,
    kind: def.kind,
    summary: def.summary,
    relevance,
    reason: reasons.join(" "),
    matchedVendors,
    matchedRegulations,
    trustStatus,
  };
}

function rank(relevance: WorldRelevance) {
  return { material: 0, watch: 1, unknown: 2, none: 3 }[relevance];
}

export { WORLD_KIND_LABELS };
