import type { Action, Risk, Score } from "@/lib/database.types";
import type { FinanceAssessment } from "@/lib/finance/assess";
import type { AiAssessment } from "@/lib/ai/assess";
import type { ChangeSet } from "@/lib/changes/diff";
import type { WorldAssessment } from "@/lib/world/assess";
import type { RiskGraph } from "@/lib/graph/build";
import type { RegulationAssessment } from "@/lib/regulations/assess";
import type { ScenarioResult } from "@/lib/scenarios/simulate";
import type { VendorMap } from "@/lib/vendors/assess";
import { SCORE_DIMENSIONS, industryLabel, countryLabel } from "@/lib/utils";

export type BoardChange = {
  label: string;
  detail: string;
};

export type BoardQuestion = {
  question: string;
  why: string;
  href?: string;
};

export type BoardReport = {
  generatedAt: string;
  company: {
    name: string;
    industry: string;
    country: string;
  };
  score: {
    overall: number;
    previous: number | null;
    delta: number | null;
    dimensions: { key: string; label: string; value: number; delta: number | null }[];
  };
  summary: string;
  criticalRisks: Risk[];
  changes: BoardChange[];
  regulatory: { code: string; name: string; coverage: number; unknown: number }[];
  vendors: { id: string; name: string; risk: string; criticality: string }[];
  finance: { posture: number | null; summary: string; unknowns: string[] };
  ai: { posture: number | null; summary: string; systems: string[]; unknowns: string[] };
  world: { material: number; summary: string; titles: string[] };
  paths: { title: string; reason: string; severity: string }[];
  questions: BoardQuestion[];
  actions: Action[];
  disclaimer: string;
};

export function buildBoardReport(input: {
  name: string;
  industry: string;
  country: string;
  score: Score | null;
  previous: Score | null;
  risks: Risk[];
  actions: Action[];
  previousRiskCount?: number | null;
  regulatory: RegulationAssessment[];
  vendors: VendorMap | null;
  finance: FinanceAssessment | null;
  ai: AiAssessment | null;
  changelog: ChangeSet | null;
  world: WorldAssessment | null;
  graph: RiskGraph | null;
  scenarios: ScenarioResult[];
}): BoardReport | null {
  if (!input.score) return null;

  const delta =
    input.previous != null ? input.score.overall - input.previous.overall : null;
  const dimensions = SCORE_DIMENSIONS.map((dim) => ({
    key: dim.key,
    label: dim.label,
    value: input.score![dim.key],
    delta:
      input.previous != null ? input.score![dim.key] - input.previous[dim.key] : null,
  }));

  const ordered = [...input.risks].sort((a, b) => {
    const rank = { critical: 0, high: 1, medium: 2, low: 3, informational: 4 };
    return rank[a.severity] - rank[b.severity];
  });
  const criticalRisks = ordered.filter(
    (item) => item.severity === "critical" || item.severity === "high",
  );
  const vendors = (input.vendors?.vendors ?? [])
    .filter((item) => item.criticality === "critical" || item.criticality === "high")
    .slice(0, 6)
    .map((item) => ({
      id: item.id,
      name: item.name,
      risk: item.risk,
      criticality: item.criticality,
    }));
  const regulatory = input.regulatory.slice(0, 6).map((item) => ({
    code: item.code,
    name: item.name,
    coverage: item.coverage,
    unknown: item.evidence.filter((row) => row.status === "unknown").length,
  }));

  const changes: BoardChange[] = [];
  if (delta != null) {
    changes.push({
      label: "VERIQ Score",
      detail: `${delta >= 0 ? "+" : ""}${delta} since the previous scan (${input.previous!.overall} → ${input.score.overall}).`,
    });
  }
  if (input.previousRiskCount != null) {
    const diff = input.risks.length - input.previousRiskCount;
    if (diff !== 0) {
      changes.push({
        label: "Open findings",
        detail: `${diff > 0 ? "+" : ""}${diff} versus the previous snapshot (${input.previousRiskCount} → ${input.risks.length}).`,
      });
    }
  }
  for (const dim of dimensions) {
    if (dim.delta != null && Math.abs(dim.delta) >= 5) {
      changes.push({
        label: dim.label,
        detail: `${dim.delta >= 0 ? "+" : ""}${dim.delta} to ${dim.value}.`,
      });
    }
  }
  for (const item of (input.changelog?.items ?? []).slice(0, 4)) {
    if (changes.some((row) => row.detail === item.title)) continue;
    changes.push({
      label: item.kind,
      detail: item.title,
    });
  }
  if (!changes.length) {
    changes.push({
      label: "Baseline",
      detail: "This is the current snapshot. A second scan will show movement.",
    });
  }

  const questions: BoardQuestion[] = [];
  for (const scenario of input.scenarios.slice(0, 4)) {
    questions.push({
      question: scenario.question,
      why: scenario.operational,
      href: `/scenarios/${scenario.id}`,
    });
  }
  const payment = input.finance?.paymentVendors[0];
  if (payment && !questions.some((item) => item.question.toLowerCase().includes("payment"))) {
    questions.unshift({
      question: `Are we sufficiently resilient if ${payment.name} becomes unavailable?`,
      why: "Payment concentration sits on the revenue path. Financial impact remains UNKNOWN as an amount.",
      href: `/scenarios/v-outage-${payment.id}`,
    });
  }
  const weakReg = regulatory.find((item) => item.unknown >= 2 || item.coverage < 50);
  if (weakReg) {
    questions.push({
      question: `Can we evidence ${weakReg.code}, or is that still UNKNOWN?`,
      why: `${weakReg.unknown} attested artefacts are missing. VERIQ will not invent compliance.`,
      href: `/regulations/${weakReg.code}`,
    });
  }
  if (input.ai && (input.ai.systems.length || input.ai.attested.inventory === "unknown")) {
    const names = input.ai.systems.map((item) => item.name).slice(0, 3).join(", ");
    questions.push({
      question: names
        ? `Who oversees ${names}, and can a human override material outputs?`
        : "Do we use AI at all — ChatGPT, Copilot, an API or an internal model?",
      why: input.ai.systems.length
        ? "Observed or declared AI systems exist. Human oversight, logging and training-data use stay UNKNOWN until attested."
        : "VERIQ will not assume Copilot, ChatGPT or an internal model is absent.",
      href: "/ai",
    });
  }
  const materialWorld = input.world?.events.find((item) => item.relevance === "material");
  if (materialWorld) {
    questions.push({
      question: `Does ${materialWorld.title.toLowerCase()} actually sit on our operating perimeter?`,
      why: materialWorld.reason,
      href: "/world",
    });
  }

  const uniqueQuestions = questions.filter(
    (item, index, list) => list.findIndex((row) => row.question === item.question) === index,
  ).slice(0, 5);

  const parts: string[] = [];
  parts.push(
    `${input.name} (${industryLabel(input.industry)}, ${countryLabel(input.country)}) scores ${input.score.overall}/100.`,
  );
  if (delta != null) {
    parts.push(
      `The score is ${delta >= 0 ? "up" : "down"} ${Math.abs(delta)} since the last scan.`,
    );
  }
  if (criticalRisks.length) {
    parts.push(
      `${criticalRisks.length} critical or high finding${criticalRisks.length === 1 ? "" : "s"} are open.`,
    );
  }
  if (input.finance?.paymentRails.length === 1) {
    parts.push(`Revenue path depends on a single observed rail: ${input.finance.paymentRails[0]}.`);
  }
  if (weakReg) {
    parts.push(`${weakReg.code} has ${weakReg.unknown} unknown artefacts.`);
  }
  if (input.ai?.systems.length) {
    parts.push(
      `${input.ai.systems.length} AI system${input.ai.systems.length === 1 ? "" : "s"} mapped; governance that was not attested stays UNKNOWN.`,
    );
  }
  if (input.world?.material) {
    parts.push(
      `${input.world.material} external condition${input.world.material === 1 ? "" : "s"} matter to this company. No incident is asserted.`,
    );
  }
  parts.push(
    "This report is intelligence for the board. It is not a legal, audit or credit opinion.",
  );

  return {
    generatedAt: new Date().toISOString(),
    company: {
      name: input.name,
      industry: input.industry,
      country: input.country,
    },
    score: {
      overall: input.score.overall,
      previous: input.previous?.overall ?? null,
      delta,
      dimensions,
    },
    summary: parts.join(" "),
    criticalRisks: criticalRisks.slice(0, 8),
    changes: changes.slice(0, 6),
    regulatory,
    vendors,
    finance: {
      posture: input.finance?.posture ?? null,
      summary: input.finance?.summary ?? "Financial signals have not been modelled.",
      unknowns: input.finance?.unknowns.slice(0, 6) ?? ["Revenue amount", "Liquidity"],
    },
    ai: {
      posture: input.ai?.posture ?? null,
      summary:
        input.ai?.summary ??
        "AI usage is UNKNOWN. VERIQ will not assume Copilot, ChatGPT or an internal model is absent.",
      systems: input.ai?.systems.map((item) => item.name) ?? [],
      unknowns: input.ai?.unknowns.slice(0, 6) ?? ["Whether AI is used at all"],
    },
    world: {
      material: input.world?.material ?? 0,
      summary:
        input.world?.summary ??
        "External conditions have not been modelled. VERIQ will not invent a headline.",
      titles: (input.world?.events ?? [])
        .filter((item) => item.relevance === "material")
        .map((item) => item.title)
        .slice(0, 4),
    },
    paths: (input.graph?.paths ?? []).slice(0, 4).map((path) => ({
      title: path.title,
      reason: path.reason,
      severity: path.severity,
    })),
    questions: uniqueQuestions,
    actions: input.actions.slice(0, 8),
    disclaimer:
      "VERIQ is not a lawyer, auditor, regulator or credit-rating agency. Final legal, financial and operational decisions remain with authorised professionals.",
  };
}
