import type { Severity } from "@/lib/database.types";
import type { RegulationAssessment } from "@/lib/regulations/assess";
import type { GithubScan, WebsiteScan } from "@/lib/scan/engine";
import type { VendorMap } from "@/lib/vendors/assess";
import type { AiAssessment } from "@/lib/ai/assess";
import type { WorldAssessment } from "@/lib/world/assess";
import type { ClaimsAssessment } from "@/lib/claims/assess";
import { isContradicted } from "@/lib/claims/catalog";

export type GraphNodeType =
  | "company"
  | "application"
  | "repository"
  | "vendor"
  | "ai"
  | "external"
  | "regulation"
  | "risk"
  | "claim";

export type GraphEdgeKind =
  | "owns"
  | "depends_on"
  | "uses"
  | "processes"
  | "hosted_by"
  | "connected_to"
  | "regulated_by"
  | "affects"
  | "exposes"
  | "asserts"
  | "conflicts_with";

export type GraphImportance = "critical" | "high" | "medium" | "low";

export type GraphNode = {
  id: string;
  type: GraphNodeType;
  label: string;
  importance: GraphImportance;
  risk?: Severity | null;
  href?: string;
  evidence?: string;
  owner?: string;
};

export type GraphEdge = {
  from: string;
  to: string;
  kind: GraphEdgeKind;
};

export type GraphPath = {
  id: string;
  title: string;
  severity: Severity;
  reason: string;
  nodes: string[];
};

export type RiskGraph = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  paths: GraphPath[];
};

const SEV_RANK: Record<Severity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  informational: 4,
};

const EDGE_KIND_LABELS: Record<GraphEdgeKind, string> = {
  owns: "owns",
  depends_on: "depends on",
  uses: "uses",
  processes: "processes",
  hosted_by: "hosted by",
  connected_to: "connects to",
  regulated_by: "regulated by",
  affects: "affects",
  exposes: "exposes",
  asserts: "asserts",
  conflicts_with: "conflicts with",
};

export function edgeKindLabel(kind: GraphEdgeKind) {
  return EDGE_KIND_LABELS[kind];
}

export const NODE_TYPE_LABELS: Record<GraphNodeType, string> = {
  company: "Company",
  application: "Application",
  repository: "Repository",
  vendor: "Vendor",
  ai: "AI system",
  external: "External",
  regulation: "Regulation",
  risk: "Risk",
  claim: "Claim",
};

function addNode(nodes: Map<string, GraphNode>, node: GraphNode) {
  if (!nodes.has(node.id)) nodes.set(node.id, node);
}

function addEdge(edges: GraphEdge[], from: string, to: string, kind: GraphEdgeKind) {
  if (!from || !to || from === to) return;
  if (edges.some((edge) => edge.from === from && edge.to === to && edge.kind === kind)) {
    return;
  }
  edges.push({ from, to, kind });
}

function riskNodeId(fingerprint: string) {
  return `risk:${fingerprint}`;
}

export function buildRiskGraph(input: {
  company: { name: string; country: string; industry: string };
  website: WebsiteScan | null;
  github: GithubScan | null;
  assessments: RegulationAssessment[];
  vendors: VendorMap | null;
  ai: AiAssessment | null;
  world: WorldAssessment | null;
  claims?: ClaimsAssessment | null;
  risks: {
    fingerprint: string;
    title: string;
    severity: Severity;
    category: string;
    owner_role: string;
  }[];
}): RiskGraph {
  const nodes = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];

  addNode(nodes, {
    id: "company",
    type: "company",
    label: input.company.name,
    importance: "critical",
    owner: "Executive",
    evidence: `${input.company.industry} · ${input.company.country}`,
  });

  const appId = input.website ? `app:${input.website.hostname}` : null;
  if (input.website && appId) {
    addNode(nodes, {
      id: appId,
      type: "application",
      label: input.website.hostname,
      importance: input.website.reachable ? "high" : "critical",
      href: input.website.url,
      evidence: input.website.reachable
        ? `HTTPS ${input.website.https ? "yes" : "no"} · ${input.website.statusCode ?? "no status"}`
        : input.website.error ?? "Unreachable",
      owner: "Engineering",
    });
    addEdge(edges, "company", appId, "owns");
  }

  const repoIds: { id: string; fullName: string; secrets: boolean }[] = [];
  if (input.github) {
    for (const repo of input.github.repos) {
      const id = `repo:${repo.fullName}`;
      const secrets = repo.sensitiveFiles.length > 0;
      repoIds.push({ id, fullName: repo.fullName, secrets });
      addNode(nodes, {
        id,
        type: "repository",
        label: repo.name,
        importance: secrets ? "critical" : "medium",
        href: repo.url,
        evidence: `${repo.visibility}${secrets ? ` · ${repo.sensitiveFiles.join(", ")}` : ""}`,
        owner: "Engineering",
      });
      addEdge(edges, "company", id, "owns");
    }
  }

  const vendorIds: { id: string; category: string; critical: boolean; data: boolean; prod: boolean }[] =
    [];
  for (const vendor of input.vendors?.vendors ?? []) {
    const id = `vendor:${vendor.id}`;
    const critical =
      vendor.criticality === "critical" || vendor.criticality === "high";
    vendorIds.push({
      id,
      category: vendor.category,
      critical,
      data: vendor.processesData,
      prod: vendor.connectsToProduction,
    });
    addNode(nodes, {
      id,
      type: "vendor",
      label: vendor.name,
      importance: vendor.criticality,
      risk: vendor.risk,
      href: `/vendors/${vendor.id}`,
      evidence: `${vendor.category} · ${vendor.origin}`,
      owner: "Procurement",
    });
    addEdge(edges, "company", id, "uses");
    if (appId && (vendor.category === "hosting" || vendor.category === "cdn" || vendor.category === "cms")) {
      addEdge(edges, appId, id, "hosted_by");
    } else if (appId) {
      addEdge(edges, appId, id, "uses");
    }
  }

  const aiIds: { id: string; processesData: boolean }[] = [];
  for (const system of input.ai?.systems ?? []) {
    const id = `ai:${system.id}`;
    aiIds.push({ id, processesData: system.processesData });
    addNode(nodes, {
      id,
      type: "ai",
      label: system.name,
      importance: system.processesData ? "high" : "medium",
      href: "/ai",
      evidence: `${system.category} · ${system.origin}`,
      owner: "Compliance",
    });
    addEdge(edges, "company", id, "uses");
    if (appId) addEdge(edges, appId, id, "uses");
  }

  const worldIds: string[] = [];
  for (const event of (input.world?.events ?? []).filter((item) => item.relevance === "material" || item.relevance === "watch").slice(0, 6)) {
    const id = `world:${event.id}`;
    worldIds.push(id);
    addNode(nodes, {
      id,
      type: "external",
      label: event.title,
      importance: event.relevance === "material" ? "high" : "medium",
      href: "/world",
      evidence: `${event.kind} · ${event.relevance}`,
      owner: "Executive",
    });
    addEdge(edges, "company", id, "connected_to");
    for (const vendorName of event.matchedVendors.slice(0, 2)) {
      const vendor = (input.vendors?.vendors ?? []).find((item) => item.name === vendorName);
      if (vendor) addEdge(edges, `vendor:${vendor.id}`, id, "affects");
    }
    for (const code of event.matchedRegulations.slice(0, 2)) {
      addEdge(edges, `reg:${code}`, id, "connected_to");
    }
  }

  const privacyRegs: string[] = [];
  for (const reg of input.assessments) {
    const id = `reg:${reg.code}`;
    if (reg.category === "privacy" || reg.category === "aml") privacyRegs.push(id);
    addNode(nodes, {
      id,
      type: "regulation",
      label: reg.code,
      importance: reg.coverage < 50 ? "high" : "medium",
      href: `/regulations/${reg.code}`,
      evidence: `${reg.name} · ${reg.coverage}% observed`,
      owner: "Compliance",
    });
    addEdge(edges, "company", id, "regulated_by");
  }

  for (const claim of input.claims?.claims ?? []) {
    const id = `claim:${claim.id}`;
    addNode(nodes, {
      id,
      type: "claim",
      label: claim.title,
      importance: isContradicted(claim.verdict) ? "high" : "medium",
      href: "/truth",
      evidence: `${claim.verdict} · ${claim.claim}`,
      owner: "Executive",
    });
    addEdge(
      edges,
      "company",
      id,
      isContradicted(claim.verdict) ? "conflicts_with" : "asserts",
    );
  }

  const ranked = [...input.risks].sort(
    (a, b) => SEV_RANK[a.severity] - SEV_RANK[b.severity],
  );
  const kept = new Set(ranked.slice(0, 12).map((item) => item.fingerprint));
  for (const risk of ranked) {
    const onPath =
      risk.fingerprint.startsWith("vendor:") ||
      risk.fingerprint.startsWith("ai:") ||
      risk.fingerprint.startsWith("world:") ||
      risk.fingerprint.startsWith("claim:") ||
      risk.fingerprint.includes("sensitive") ||
      risk.severity === "critical" ||
      risk.severity === "high";
    if (!kept.has(risk.fingerprint) && !onPath) continue;

    const id = riskNodeId(risk.fingerprint);
    addNode(nodes, {
      id,
      type: "risk",
      label: risk.title,
      importance:
        risk.severity === "informational"
          ? "low"
          : risk.severity === "low"
            ? "low"
            : risk.severity,
      risk: risk.severity,
      evidence: risk.category,
      owner: risk.owner_role,
    });

    if (risk.fingerprint.startsWith("web:") || risk.fingerprint.startsWith("tls:") || risk.fingerprint.startsWith("dns:") || risk.fingerprint.startsWith("ct:")) {
      if (appId) addEdge(edges, appId, id, "exposes");
    } else if (risk.fingerprint.startsWith("github:sensitive:")) {
      const fullName = risk.fingerprint.slice("github:sensitive:".length);
      addEdge(edges, `repo:${fullName}`, id, "exposes");
    } else if (risk.fingerprint.startsWith("github:")) {
      const firstRepo = repoIds[0];
      if (firstRepo) addEdge(edges, firstRepo.id, id, "exposes");
      else addEdge(edges, "company", id, "exposes");
    } else if (risk.fingerprint.startsWith("vendor:payments:")) {
      const vendorKey = risk.fingerprint.slice("vendor:payments:".length);
      addEdge(edges, `vendor:${vendorKey}`, id, "affects");
    } else if (risk.fingerprint.startsWith("vendor:single-host:")) {
      const vendorKey = risk.fingerprint.slice("vendor:single-host:".length);
      addEdge(edges, `vendor:${vendorKey}`, id, "affects");
    } else if (risk.fingerprint.startsWith("vendor:")) {
      for (const vendor of vendorIds.filter((item) => item.critical).slice(0, 4)) {
        addEdge(edges, vendor.id, id, "affects");
      }
    } else if (risk.fingerprint.startsWith("ai:")) {
      for (const system of aiIds.slice(0, 4)) {
        addEdge(edges, system.id, id, "affects");
      }
      if (!aiIds.length) addEdge(edges, "company", id, "exposes");
    } else if (risk.fingerprint.startsWith("world:")) {
      addEdge(edges, risk.fingerprint, id, "affects");
      addEdge(edges, "company", id, "exposes");
    } else if (risk.fingerprint.startsWith("claim:")) {
      const claimId = risk.fingerprint.split(":").slice(2).join(":");
      if (claimId) addEdge(edges, `claim:${claimId}`, id, "conflicts_with");
      addEdge(edges, "company", id, "exposes");
    } else if (risk.fingerprint.startsWith("reg:")) {
      const parts = risk.fingerprint.split(":");
      const code = parts[parts.length - 1];
      if (code) addEdge(edges, `reg:${code}`, id, "affects");
    } else {
      addEdge(edges, "company", id, "exposes");
    }
  }

  const paths = correlate({
    nodes,
    appId,
    repoIds,
    vendorIds,
    aiIds,
    worldIds,
    privacyRegs,
    risks: input.risks,
  });

  return {
    nodes: [...nodes.values()],
    edges: edges.filter((edge) => nodes.has(edge.from) && nodes.has(edge.to)),
    paths: paths.filter((path) => path.nodes.every((id) => nodes.has(id))),
  };
}

function correlate(input: {
  nodes: Map<string, GraphNode>;
  appId: string | null;
  repoIds: { id: string; fullName: string; secrets: boolean }[];
  vendorIds: { id: string; category: string; critical: boolean; data: boolean; prod: boolean }[];
  aiIds: { id: string; processesData: boolean }[];
  worldIds: string[];
  privacyRegs: string[];
  risks: { fingerprint: string; title: string; severity: Severity }[];
}): GraphPath[] {
  const paths: GraphPath[] = [];
  const riskByPrefix = (prefix: string) =>
    input.risks.find((item) => item.fingerprint.startsWith(prefix));

  for (const repo of input.repoIds.filter((item) => item.secrets)) {
    const risk = input.risks.find(
      (item) => item.fingerprint === `github:sensitive:${repo.fullName}`,
    );
    const reg = input.privacyRegs[0];
    if (!risk || !reg) continue;
    paths.push({
      id: `corr:secrets-privacy:${repo.fullName}`,
      title: "Public secrets under a privacy statute",
      severity: "critical",
      reason:
        "A public credential-class file plus an applicable privacy regulation is correlated incident risk — not two separate findings.",
      nodes: [repo.id, riskNodeId(risk.fingerprint), reg],
    });
  }

  const payment = input.vendorIds.find((item) => item.category === "payments");
  const payRisk = riskByPrefix("vendor:payments:");
  if (payment && input.appId) {
    const nodes = [input.appId, payment.id];
    if (payRisk) nodes.push(riskNodeId(payRisk.fingerprint));
    if (input.privacyRegs[0]) nodes.push(input.privacyRegs[0]);
    paths.push({
      id: `corr:payments:${payment.id}`,
      title: "Payment processor on the customer path",
      severity: "high",
      reason:
        "The application depends on a payment vendor that processes customer data. DPA and notification remain UNKNOWN.",
      nodes,
    });
  }

  const hosts = input.vendorIds.filter((item) => item.category === "hosting" && item.prod);
  if (hosts.length === 1 && input.appId) {
    const host = hosts[0]!;
    const risk = riskByPrefix("vendor:single-host:");
    paths.push({
      id: `corr:host:${host.id}`,
      title: "Single production host",
      severity: "medium",
      reason:
        "The public application is hosted by one observed vendor. Substitution is not evidenced.",
      nodes: [input.appId, host.id, ...(risk ? [riskNodeId(risk.fingerprint)] : [])],
    });
  }

  const trackers = input.vendorIds.filter(
    (item) => item.category === "analytics" || item.category === "ads",
  );
  const privacyClash = input.risks.find(
    (item) =>
      item.fingerprint === "contradiction:privacy-trackers" ||
      item.fingerprint === "contradiction:undeclared-trackers",
  );
  if (trackers.length && input.appId && privacyClash) {
    paths.push({
      id: "corr:notice-vs-trackers",
      title: "Privacy notice versus observed trackers",
      severity: "high",
      reason:
        "Processors on the public site contradict the observed notice — or there is no notice. That join is the finding.",
      nodes: [
        input.appId,
        ...trackers.slice(0, 3).map((item) => item.id),
        ...(input.privacyRegs[0] ? [input.privacyRegs[0]] : []),
        riskNodeId(privacyClash.fingerprint),
      ],
    });
  } else if (trackers.length >= 2 && input.appId && input.privacyRegs[0]) {
    paths.push({
      id: "corr:trackers-privacy",
      title: "Trackers under a privacy statute",
      severity: "medium",
      reason:
        "Multiple analytics or advertising vendors on the public site are data processors for the mapped privacy regulation.",
      nodes: [input.appId, ...trackers.slice(0, 3).map((item) => item.id), input.privacyRegs[0]],
    });
  }

  const aiDenial = input.risks.find(
    (item) => item.fingerprint === "contradiction:ai-inventory",
  );
  if (aiDenial && input.aiIds[0]) {
    paths.push({
      id: "corr:ai-contradiction",
      title: "Attested no AI versus observed systems",
      severity: "high",
      reason:
        "The inventory said there is no AI. Observed systems on the site or in the lockfile contradict that.",
      nodes: [
        "company",
        ...input.aiIds.slice(0, 3).map((item) => item.id),
        riskNodeId(aiDenial.fingerprint),
      ],
    });
  }

  const concentration = riskByPrefix("vendor:concentration");
  const criticalVendors = input.vendorIds.filter((item) => item.critical).slice(0, 4);
  if (concentration && criticalVendors.length >= 2) {
    paths.push({
      id: "corr:concentration",
      title: "Critical vendor concentration",
      severity: "high",
      reason:
        "Several high-importance vendors sit on hosting, payments or identity paths with no attested replacement.",
      nodes: ["company", ...criticalVendors.map((item) => item.id), riskNodeId(concentration.fingerprint)],
    });
  }

  const dataAi = input.aiIds.filter((item) => item.processesData).slice(0, 3);
  const aiRisk = riskByPrefix("ai:");
  if (dataAi.length && input.privacyRegs[0]) {
    paths.push({
      id: "corr:ai-privacy",
      title: "AI prompts under a privacy statute",
      severity: "high",
      reason:
        "Observed or declared AI systems may process prompts. Privacy obligations still apply; training-data use stays UNKNOWN until attested.",
      nodes: [
        "company",
        ...dataAi.map((item) => item.id),
        input.privacyRegs[0],
        ...(aiRisk ? [riskNodeId(aiRisk.fingerprint)] : []),
      ],
    });
  }

  const claimRisk = riskByPrefix("claim:contradicted:") ?? riskByPrefix("claim:conflict:");
  if (claimRisk) {
    paths.push({
      id: `corr:claim:${claimRisk.fingerprint}`,
      title: "The story conflicts with observed evidence",
      severity: "high",
      reason:
        "A management or website claim does not match the public footprint. This is a consistency gap, not a finding of fraud.",
      nodes: ["company", riskNodeId(claimRisk.fingerprint)],
    });
  }

  const worldRisk = riskByPrefix("world:");
  if (input.worldIds[0]) {
    paths.push({
      id: `corr:world:${input.worldIds[0]}`,
      title: "External condition on the company model",
      severity: "medium",
      reason:
        "A catalogued public condition matches this company's vendors, statutes or exposure. VERIQ will not invent that an incident is underway.",
      nodes: [
        "company",
        input.worldIds[0],
        ...(worldRisk ? [riskNodeId(worldRisk.fingerprint)] : []),
      ],
    });
  }

  return paths;
}

export function neighborsOf(graph: RiskGraph, nodeId: string) {
  const connected = new Set<string>();
  for (const edge of graph.edges) {
    if (edge.from === nodeId) connected.add(edge.to);
    if (edge.to === nodeId) connected.add(edge.from);
  }
  return graph.nodes.filter((node) => connected.has(node.id));
}
