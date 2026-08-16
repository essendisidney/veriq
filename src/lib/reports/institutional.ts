import type { Action, Risk, Score } from "@/lib/database.types";
import type { FinanceAssessment } from "@/lib/finance/assess";
import type { AiAssessment } from "@/lib/ai/assess";
import type { ChangeSet, ScanSnapshot } from "@/lib/changes/diff";
import type { WorldAssessment } from "@/lib/world/assess";
import type { RegulationAssessment } from "@/lib/regulations/assess";
import type { VendorMap } from "@/lib/vendors/assess";
import type { RiskGraph } from "@/lib/graph/build";
import type { ScenarioResult } from "@/lib/scenarios/simulate";
import type { Exposure } from "@/lib/scan/exposure";
import type { IntegrityAssessment } from "@/lib/integrity/assess";
import { SCORE_DIMENSIONS, industryLabel, countryLabel } from "@/lib/utils";
import { isOverdue, staleDays } from "@/lib/risk/certainty";
import { PACK_COPY, type PackKind } from "@/lib/reports/pack";

export type { PackKind } from "@/lib/reports/pack";
export { PACK_COPY, parsePackKind } from "@/lib/reports/pack";

export type ReportBundle = {
  score: Score | null;
  previous: Score | null;
  risks: Risk[];
  actions: Action[];
  previousRiskCount: number | null;
  regulatory: RegulationAssessment[];
  vendors: VendorMap | null;
  finance: FinanceAssessment | null;
  ai: AiAssessment | null;
  changelog: ChangeSet | null;
  world: WorldAssessment | null;
  graph: RiskGraph | null;
  scenarios: ScenarioResult[];
  exposure: Exposure | null;
  snapshot: ScanSnapshot | null;
  integrity: IntegrityAssessment | null;
};

export type PillarStatus = "strong" | "adequate" | "weak" | "unknown";

export type ReportPillar = {
  key: string;
  label: string;
  score: number;
  status: PillarStatus;
  note: string;
};

export type ReportFlag = {
  id: string;
  severity: "critical" | "high" | "medium" | "watch";
  title: string;
  detail: string;
  href?: string;
};

export type ReportQuestion = {
  question: string;
  why: string;
  href?: string;
};

export type ReportAction = {
  id: string;
  title: string;
  owner: string;
  priority: string;
  deadline: string | null;
  overdue: boolean;
};

export type InstitutionalReport = {
  kind: PackKind;
  title: string;
  audience: string;
  generatedAt: string;
  scannedAt: string | null;
  staleDays: number | null;
  company: { name: string; industry: string; country: string };
  healthScore: number;
  previous: number | null;
  delta: number | null;
  summary: string;
  pillars: ReportPillar[];
  flags: ReportFlag[];
  unknowns: string[];
  questions: ReportQuestion[];
  actions: ReportAction[];
  overdueCount: number;
  regulatory: { code: string; name: string; coverage: number; unknown: number }[];
  vendors: { id: string; name: string; risk: string; criticality: string }[];
  finance: { posture: number | null; summary: string; unknowns: string[] };
  ai: { posture: number | null; summary: string; systems: string[] };
  world: { material: number; summary: string; titles: string[] };
  exposure: {
    posture: number;
    tlsDays: number | null;
    spf: boolean;
    dmarc: boolean;
  } | null;
  disclaimer: string;
};

const INVESTOR_KEYS = [
  "technology",
  "cybersecurity",
  "regulatory",
  "operational",
  "vendor",
  "ai",
  "data",
  "financial",
] as const;

const CREDIT_KEYS = [
  "financial",
  "operational",
  "vendor",
  "cybersecurity",
  "technology",
  "regulatory",
  "data",
] as const;

const RESTRUCTURING_KEYS = [
  "operational",
  "vendor",
  "financial",
  "cybersecurity",
  "technology",
  "regulatory",
  "data",
] as const;

export function buildDiligenceReport(
  org: { name: string; industry: string; country: string },
  bundle: ReportBundle,
): InstitutionalReport | null {
  return buildInstitutional("diligence", org, bundle);
}

export function buildCreditReport(
  org: { name: string; industry: string; country: string },
  bundle: ReportBundle,
): InstitutionalReport | null {
  return buildInstitutional("credit", org, bundle);
}

export function buildRestructuringReport(
  org: { name: string; industry: string; country: string },
  bundle: ReportBundle,
): InstitutionalReport | null {
  return buildInstitutional("restructuring", org, bundle);
}

function pillarKeys(kind: PackKind) {
  if (kind === "diligence") return INVESTOR_KEYS;
  if (kind === "credit") return CREDIT_KEYS;
  return RESTRUCTURING_KEYS;
}

function buildInstitutional(
  kind: PackKind,
  org: { name: string; industry: string; country: string },
  bundle: ReportBundle,
): InstitutionalReport | null {
  if (!bundle.score) return null;

  const keys = pillarKeys(kind);
  const pillars = keys.map((key) =>
    pillar(bundle.score!, key, bundle, kind),
  );
  const flags = collectFlags(bundle, kind);
  const unknowns = collectUnknowns(bundle, kind);
  const questions = collectQuestions(org, bundle, kind);
  const critical = bundle.risks.filter(
    (item) => item.severity === "critical" || item.severity === "high",
  );
  const vendors = (bundle.vendors?.vendors ?? [])
    .filter((item) => item.criticality === "critical" || item.criticality === "high")
    .slice(0, 6)
    .map((item) => ({
      id: item.id,
      name: item.name,
      risk: item.risk,
      criticality: item.criticality,
    }));
  const regulatory = bundle.regulatory.slice(0, 6).map((item) => ({
    code: item.code,
    name: item.name,
    coverage: item.coverage,
    unknown: item.evidence.filter((row) => row.status === "unknown").length,
  }));
  const delta =
    bundle.previous != null ? bundle.score.overall - bundle.previous.overall : null;
  const scannedAt = bundle.score.created_at;
  const reportActions = bundle.actions.slice(0, 8).map((item) => ({
    id: item.id,
    title: item.title,
    owner: item.owner_role ?? "Unassigned",
    priority: item.priority,
    deadline: item.deadline,
    overdue: isOverdue(item.deadline, item.status),
  }));
  const overdueCount = reportActions.filter((item) => item.overdue).length;

  const parts: string[] = [];
  if (kind === "diligence") {
    parts.push(
      `${org.name} (${industryLabel(org.industry)}, ${countryLabel(org.country)}) has a Company Health Score of ${bundle.score.overall}/100 from observed and attested evidence.`,
    );
    parts.push(
      "This is not a valuation, not investment advice, and not a substitute for legal, financial or technical due diligence.",
    );
  } else if (kind === "credit") {
    parts.push(
      `${org.name} (${industryLabel(org.industry)}, ${countryLabel(org.country)}) presents a business risk profile of ${bundle.score.overall}/100 from technology, cyber, vendor, operational and attested financial signals.`,
    );
    parts.push(
      "This is not a credit rating, not a probability of default, and not a substitute for financial statements. Amounts in KES remain UNKNOWN.",
    );
  } else {
    parts.push(
      `${org.name} (${industryLabel(org.industry)}, ${countryLabel(org.country)}) has an operating continuity picture of ${bundle.score.overall}/100 from observed systems, vendors, regulations and attested finance.`,
    );
    parts.push(
      "This is not a solvency opinion, not a statement of affairs, and not a substitute for an insolvency practitioner or legal advice. Creditor lists, cash and preferences remain UNKNOWN.",
    );
  }
  if (critical.length) {
    parts.push(
      `${critical.length} critical or high finding${critical.length === 1 ? "" : "s"} are open.`,
    );
  }
  if (bundle.finance?.paymentRails.length === 1) {
    parts.push(`Collections appear concentrated on ${bundle.finance.paymentRails[0]}.`);
  }
  if (bundle.ai?.systems.length && bundle.ai.attested.humanOversight !== "yes") {
    parts.push("AI systems are mapped; human oversight is not attested.");
  }
  if (overdueCount) {
    parts.push(
      `${overdueCount} recommended action${overdueCount === 1 ? "" : "s"} ${overdueCount === 1 ? "is" : "are"} past SLA.`,
    );
  }
  if (bundle.world?.material) {
    parts.push(
      `${bundle.world.material} catalogued external condition${bundle.world.material === 1 ? "" : "s"} matter to this company. No incident is asserted.`,
    );
  }

  const copy = PACK_COPY[kind];
  return {
    kind,
    title: copy.title,
    audience: copy.audience,
    generatedAt: new Date().toISOString(),
    scannedAt,
    staleDays: staleDays(scannedAt),
    company: {
      name: org.name,
      industry: org.industry,
      country: org.country,
    },
    healthScore: bundle.score.overall,
    previous: bundle.previous?.overall ?? null,
    delta,
    summary: parts.join(" "),
    pillars,
    flags: flags.slice(0, kind === "restructuring" ? 12 : 8),
    unknowns,
    questions: questions.slice(0, 6),
    actions: reportActions,
    overdueCount,
    regulatory,
    vendors,
    finance: {
      posture: bundle.finance?.posture ?? null,
      summary: bundle.finance?.summary ?? "Financial signals have not been modelled.",
      unknowns: bundle.finance?.unknowns.slice(0, 6) ?? ["Revenue amount", "Liquidity"],
    },
    ai: {
      posture: bundle.ai?.posture ?? null,
      summary:
        bundle.ai?.summary ??
        "AI usage is UNKNOWN. VERIQ will not assume Copilot, ChatGPT or an internal model is absent.",
      systems: bundle.ai?.systems.map((item) => item.name) ?? [],
    },
    world: {
      material: bundle.world?.material ?? 0,
      summary:
        bundle.world?.summary ??
        "External conditions have not been modelled. VERIQ will not invent a headline.",
      titles: (bundle.world?.events ?? [])
        .filter((item) => item.relevance === "material")
        .map((item) => item.title)
        .slice(0, 4),
    },
    exposure: bundle.exposure
      ? {
          posture: bundle.exposure.posture,
          tlsDays: bundle.exposure.tls?.daysRemaining ?? null,
          spf: bundle.exposure.spf,
          dmarc: bundle.exposure.dmarc,
        }
      : null,
    disclaimer: copy.disclaimer,
  };
}

function pillar(
  score: Score,
  key: (typeof SCORE_DIMENSIONS)[number]["key"],
  bundle: ReportBundle,
  kind: PackKind,
): ReportPillar {
  const def = SCORE_DIMENSIONS.find((item) => item.key === key)!;
  const value = score[key];
  const status: PillarStatus =
    value >= 75 ? "strong" : value >= 55 ? "adequate" : value >= 35 ? "weak" : "unknown";
  return {
    key,
    label: def.label,
    score: value,
    status,
    note: pillarNote(key, value, bundle, kind),
  };
}

function pillarNote(
  key: string,
  value: number,
  bundle: ReportBundle,
  kind: PackKind,
): string {
  if (key === "financial") {
    if (kind === "credit") {
      return "Qualitative signals only. Revenue, liquidity and leverage amounts are UNKNOWN.";
    }
    if (kind === "restructuring") {
      return "Qualitative liquidity and concentration only. Cash, creditor amounts and solvency remain UNKNOWN.";
    }
    return "Financial statements were not ingested. Treat this as operational finance risk, not earnings quality.";
  }
  if (key === "ai") {
    return bundle.ai?.systems.length
      ? `${bundle.ai.systems.length} system${bundle.ai.systems.length === 1 ? "" : "s"} mapped. Oversight that was not attested stays UNKNOWN.`
      : "AI usage is UNKNOWN. VERIQ will not assume a model is absent.";
  }
  if (key === "vendor") {
    const n = bundle.vendors?.criticalCount ?? 0;
    return n
      ? `${n} high-importance vendor${n === 1 ? "" : "s"} mapped. Substitution remains UNKNOWN until attested.`
      : "Third-party surface may still be incomplete.";
  }
  if (key === "regulatory") {
    const weak = bundle.regulatory.find((item) => item.coverage < 50);
    return weak
      ? `${weak.code} coverage is ${weak.coverage}%. VERIQ will not invent compliance.`
      : `${bundle.regulatory.length} statute${bundle.regulatory.length === 1 ? "" : "s"} mapped from country and industry.`;
  }
  if (key === "cybersecurity") {
    return bundle.exposure
      ? `External posture ${bundle.exposure.posture}/100. TLS and email authentication are observed, not assumed.`
      : "External exposure has not been modelled.";
  }
  if (key === "operational") {
    if (kind === "restructuring") {
      return "Whether operations can continue or must stop. Not a going-concern audit.";
    }
    return kind === "credit"
      ? "Resilience of host, identity and payment rails — not a going-concern audit."
      : "Operating dependencies inferred from the company model.";
  }
  return value >= 75
    ? "Above the watch threshold on this snapshot."
    : "Below a strong threshold on this snapshot. Evidence, not a forecast.";
}

function collectFlags(bundle: ReportBundle, kind: PackKind): ReportFlag[] {
  const flags: ReportFlag[] = [];
  for (const risk of bundle.risks.filter(
    (item) => item.severity === "critical" || item.severity === "high",
  ).slice(0, 5)) {
    flags.push({
      id: risk.id,
      severity: risk.severity === "critical" ? "critical" : "high",
      title: risk.title,
      detail: risk.why_it_matters ?? risk.description,
      href: `/findings/${risk.id}`,
    });
  }
  const overdue = bundle.actions.filter((item) => isOverdue(item.deadline, item.status));
  if (overdue.length) {
    flags.push({
      id: "flag:overdue-actions",
      severity: overdue.some((item) => item.priority === "critical") ? "critical" : "high",
      title: `${overdue.length} recommended action${overdue.length === 1 ? "" : "s"} past SLA`,
      detail: "Management has not closed these items. VERIQ does not change production systems.",
      href: "/actions",
    });
  }
  if (bundle.finance?.paymentRails.length === 1) {
    flags.push({
      id: "flag:payment-rail",
      severity: "high",
      title: `Single observed collection rail: ${bundle.finance.paymentRails[0]}`,
      detail: "Revenue interruption if that processor is unavailable. Amounts remain UNKNOWN.",
      href: "/finance",
    });
  }
  if (bundle.finance?.attested.keyPerson === "yes") {
    flags.push({
      id: "flag:key-person",
      severity: kind === "diligence" ? "medium" : "high",
      title: "Key-person dependency attested",
      detail: "Production or financial control is concentrated. Privileges were not observed in the scan.",
      href: "/finance",
    });
  }
  if (bundle.finance?.attested.singleSite === "yes") {
    flags.push({
      id: "flag:single-site",
      severity: "medium",
      title: "Single-site operations attested",
      detail: "Geographic substitution was not evidenced.",
      href: "/finance",
    });
  }
  if ((kind === "credit" || kind === "restructuring") && bundle.finance?.attested.liquidity === "tight") {
    flags.push({
      id: "flag:liquidity",
      severity: "high",
      title: "Liquidity attested as tight",
      detail:
        kind === "restructuring"
          ? "This is a qualitative band, not cash available to the estate. Statements and a statement of affairs are still required."
          : "This is a qualitative band, not a cash figure. Statements are still required.",
      href: "/finance",
    });
  }
  if (bundle.finance?.attested.customerConcentration === "high") {
    flags.push({
      id: "flag:customers",
      severity: "medium",
      title: "Customer concentration attested as high",
      detail: "Names and revenue shares remain UNKNOWN.",
      href: "/finance",
    });
  }
  if (bundle.ai?.systems.length && bundle.ai.attested.humanOversight !== "yes") {
    flags.push({
      id: "flag:ai-oversight",
      severity: "medium",
      title: "AI without attested human oversight",
      detail: bundle.ai.systems.map((item) => item.name).join(", "),
      href: "/ai",
    });
  }
  for (const event of (bundle.world?.events ?? []).filter((item) => item.relevance === "material").slice(0, 2)) {
    flags.push({
      id: `flag:world:${event.id}`,
      severity: "watch",
      title: event.title,
      detail: `${event.reason} No incident is asserted.`,
      href: "/world",
    });
  }
  if (bundle.exposure && (!bundle.exposure.spf || !bundle.exposure.dmarc)) {
    flags.push({
      id: "flag:email-auth",
      severity: "medium",
      title: "Email authentication incomplete",
      detail: "SPF and/or DMARC were not observed. Domain spoofing remains a standing condition.",
      href: "/technology",
    });
  }
  if (kind === "restructuring") {
    const insolvency = bundle.regulatory.find(
      (item) => item.category === "insolvency" || item.code === "KE-IA",
    );
    if (insolvency) {
      flags.push({
        id: "flag:insolvency-act",
        severity: "high",
        title: `${insolvency.code} artefacts are UNKNOWN`,
        detail: insolvency.impact,
        href: `/regulations/${insolvency.code}`,
      });
    }
    const advocates = bundle.regulatory.find((item) => item.code === "KE-ADV");
    if (advocates) {
      flags.push({
        id: "flag:advocates-act",
        severity: "medium",
        title: "Practising standing and client-account evidence are UNKNOWN",
        detail: advocates.impact,
        href: `/regulations/${advocates.code}`,
      });
    }
    for (const scenario of bundle.scenarios.slice(0, 3)) {
      const severity: ReportFlag["severity"] =
        scenario.severity === "critical" || scenario.severity === "high"
          ? scenario.severity
          : "watch";
      flags.push({
        id: `flag:scenario:${scenario.id}`,
        severity,
        title: scenario.title,
        detail: `${scenario.operational} Financial impact remains UNKNOWN.`,
        href: `/scenarios/${scenario.id}`,
      });
    }
  }
  return uniqueFlags(flags);
}

function collectUnknowns(bundle: ReportBundle, kind: PackKind): string[] {
  const head =
    kind === "diligence"
      ? "Valuation / cap table"
      : kind === "credit"
        ? "Credit rating / PD / LGD"
        : "Statement of affairs / creditor list";
  const extras =
    kind === "restructuring"
      ? [
          "Cash, preferences and transactions at undervalue",
          "Employee and preferential claims",
          "Court or Official Receiver status",
          "Contract assignment and beneficial ownership",
          "Going-concern opinion",
        ]
      : [
          "Revenue, cash and liability amounts",
          "Whether financial statements are audited",
        ];
  const items = [
    head,
    ...extras,
    ...(bundle.finance?.unknowns.slice(0, 4) ?? []),
    ...(bundle.integrity?.records
      .filter((item) => item.status === "unknown")
      .slice(0, 2)
      .map((item) => item.title) ?? []),
    ...(bundle.ai?.unknowns.slice(0, 3) ?? ["Whether AI is used at all"]),
    "Whether the company serves the EU market",
    "Incident-notification playbook",
  ];
  return [...new Set(items)].slice(0, 10);
}

function collectQuestions(
  org: { name: string },
  bundle: ReportBundle,
  kind: PackKind,
): ReportQuestion[] {
  const questions: ReportQuestion[] = [];
  if (kind === "diligence") {
    questions.push({
      question: `Can ${org.name} evidence the privacy statutes mapped to it, or is that still UNKNOWN?`,
      why: "Investors inherit regulatory enforcement and customer trust risk. VERIQ will not invent compliance.",
      href: "/regulations",
    });
    questions.push({
      question: "If the primary host or payment rail fails, what is the attested substitute?",
      why: "Concentration is observable. Substitution is not, until declared.",
      href: "/scenarios",
    });
    questions.push({
      question: "Who owns AI inventory, human oversight and training-data clauses?",
      why: "Shadow AI is common. Absence of ChatGPT or Copilot is not assumed.",
      href: "/ai",
    });
    questions.push({
      question: "Is beneficial ownership on a public register, or still UNKNOWN — and does the privacy notice name the trackers on the site?",
      why: "Shell companies and undeclared processors are found by joining public records to the company surface. VERIQ will not invent a PEP or an EACC case.",
      href: "/integrity",
    });
  } else if (kind === "credit") {
    questions.push({
      question: "Is the collection rail substitutable within hours, or is revenue paused?",
      why: "A single observed processor is operational credit risk. The amount at risk stays UNKNOWN.",
      href: "/finance",
    });
    questions.push({
      question: "Can production continue if the attested key person is unavailable?",
      why: "Key-person and single-site bands are qualitative. Privileges were not scanned.",
      href: "/finance",
    });
    questions.push({
      question: "Are there open critical cyber findings on customer channels?",
      why: "A notifiable incident can become a going-concern event. This is not a pentest.",
      href: "/findings",
    });
  } else {
    const insolvency = bundle.regulatory.find(
      (item) => item.category === "insolvency" || item.code === "KE-IA",
    );
    questions.push({
      question: `If ${org.name} must keep operating for 14 days, which host, payment rail or key person would stop it?`,
      why: "Continuity of the estate is an operational question. VERIQ does not value the estate or list creditors.",
      href: "/scenarios",
    });
    if (insolvency) {
      questions.push({
        question: `Where are the books of account and a statement of affairs under ${insolvency.code}?`,
        why: `${insolvency.name} is mapped. Those artefacts stay UNKNOWN until produced. VERIQ will not invent creditors or cash.`,
        href: `/regulations/${insolvency.code}`,
      });
    }
    questions.push({
      question: "Which processors still hold personal data if trading stops today?",
      why: "Wind-down does not end Data Protection obligations. DPAs stay UNKNOWN.",
      href: "/vendors",
    });
    questions.push({
      question: "Who controls the cloud, GitHub and collection accounts if directors are no longer in charge?",
      why: "Access and substitution were not observed as legal control. Privileges stay UNKNOWN.",
      href: "/finance",
    });
  }
  const overdue = bundle.actions.filter((item) => isOverdue(item.deadline, item.status));
  if (overdue.length) {
    questions.push({
      question: `Who owns the ${overdue.length} action${overdue.length === 1 ? "" : "s"} past SLA, and when will they close?`,
      why:
        kind === "credit"
          ? "An unpaid operational SLA is operating risk, not a covenant breach or a credit score."
          : kind === "restructuring"
            ? "An unpaid operational SLA is estate-operating risk, not a finding of wrongful trading."
            : "Diligence should test whether management closes material items. VERIQ does not change production systems.",
      href: "/actions",
    });
  }
  const payment = bundle.finance?.paymentVendors[0];
  if (payment) {
    questions.push({
      question: `What happens to collections if ${payment.name} is unavailable for 48 hours?`,
      why: "Scenario intelligence, not a loss estimate.",
      href: `/scenarios/v-outage-${payment.id}`,
    });
  }
  const weakReg = bundle.regulatory.find((item) => item.coverage < 50);
  if (weakReg) {
    questions.push({
      question: `What artefacts exist for ${weakReg.code}?`,
      why: `${weakReg.name} is mapped; observable coverage is ${weakReg.coverage}%.`,
      href: `/regulations/${weakReg.code}`,
    });
  }
  return questions;
}

function uniqueFlags(flags: ReportFlag[]) {
  return flags.filter(
    (item, index, list) => list.findIndex((row) => row.title === item.title) === index,
  );
}
