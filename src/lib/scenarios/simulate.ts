import type { Severity, TrustStatus } from "@/lib/database.types";
import type { RegulationAssessment } from "@/lib/regulations/assess";
import type { GraphNode, RiskGraph } from "@/lib/graph/build";
import type { VendorAssessment, VendorMap } from "@/lib/vendors/assess";
import { VENDOR_CATEGORY_LABELS } from "@/lib/vendors/catalog";

export type ScenarioKind =
  | "vendor_outage"
  | "vendor_breach"
  | "ransomware"
  | "regulation_change"
  | "secret_exploit"
  | "site_outage";

export type ScenarioResult = {
  id: string;
  kind: ScenarioKind;
  title: string;
  question: string;
  duration: string;
  severity: Severity;
  confidence: number;
  trustStatus: TrustStatus;
  originLabel: string;
  chain: string[];
  affectedSystems: string[];
  affectedVendors: string[];
  affectedRegulations: string[];
  affectedFindings: string[];
  operational: string;
  financial: string;
  alternative: string;
  notification: string;
  mitigations: string[];
  unknowns: string[];
};

const SEV_RANK: Record<Severity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  informational: 4,
};

function nodesOf(graph: RiskGraph | null, type: GraphNode["type"]) {
  return graph?.nodes.filter((node) => node.type === type) ?? [];
}

function reach(graph: RiskGraph | null, origins: string[], hops = 3): GraphNode[] {
  if (!graph || !origins.length) return [];
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  const seen = new Set<string>();
  let frontier = origins.filter((id) => byId.has(id));
  for (let i = 0; i < hops; i += 1) {
    const next: string[] = [];
    for (const id of frontier) {
      if (seen.has(id)) continue;
      seen.add(id);
      for (const edge of graph.edges) {
        const other = edge.from === id ? edge.to : edge.to === id ? edge.from : null;
        if (other && !seen.has(other)) next.push(other);
      }
    }
    frontier = next;
  }
  return [...seen].map((id) => byId.get(id)!).filter(Boolean);
}

function labels(nodes: GraphNode[], type: GraphNode["type"]) {
  return nodes.filter((node) => node.type === type).map((node) => node.label);
}

function sameCategory(vendors: VendorAssessment[], vendor: VendorAssessment) {
  return vendors.filter((item) => item.category === vendor.category && item.id !== vendor.id);
}

function alternateNote(peers: VendorAssessment[], vendor: VendorAssessment) {
  if (!peers.length) return "Not detected.";
  return `Observed another ${VENDOR_CATEGORY_LABELS[vendor.category]} vendor (${peers.map((item) => item.name).join(", ")}). Failover is not attested.`;
}

function privacyRegs(assessments: RegulationAssessment[]) {
  return assessments.filter(
    (item) => item.category === "privacy" || item.category === "aml" || item.category === "cybersecurity",
  );
}

function canonicalThree(input: {
  graph: RiskGraph | null;
  vendors: VendorMap | null;
  assessments: RegulationAssessment[];
}): ScenarioResult[] {
  const vendors = input.vendors?.vendors ?? [];
  const cloud =
    vendors.find(
      (item) =>
        item.category === "hosting" ||
        item.category === "cdn" ||
        item.category === "cms",
    ) ?? null;
  const payment = vendors.find((item) => item.category === "payments") ?? null;
  const secretRepo = nodesOf(input.graph, "repository").find(
    (node) => node.importance === "critical",
  );
  const regs = privacyRegs(input.assessments);
  const apps = nodesOf(input.graph, "application");

  return [
    {
      id: "canonical-cloud",
      kind: "vendor_outage",
      title: cloud
        ? `${cloud.name} unavailable for 48 hours`
        : "Primary cloud unavailable for 48 hours",
      question: cloud
        ? `What if ${cloud.name} goes down for 48 hours?`
        : "What if our primary cloud or hosting is unavailable for 48 hours?",
      duration: "48 hours",
      severity: cloud && !vendors.some((item) => item.category === cloud.category && item.id !== cloud.id)
        ? "critical"
        : "high",
      confidence: cloud ? 76 : 42,
      trustStatus: cloud ? "inferred" : "unknown",
      originLabel: cloud?.name ?? "Primary cloud / hosting",
      chain: [
        cloud?.name ?? "Primary cloud",
        "Application hosting",
        "Customer access",
        "Operations",
        "Revenue",
      ],
      affectedSystems: apps.map((node) => node.label).slice(0, 6),
      affectedVendors: cloud ? [cloud.name] : [],
      affectedRegulations: nodesOf(input.graph, "regulation")
        .map((node) => node.label)
        .slice(0, 4),
      affectedFindings: nodesOf(input.graph, "risk")
        .filter((node) => node.risk === "critical" || node.risk === "high")
        .map((node) => node.label)
        .slice(0, 6),
      operational: cloud
        ? `${cloud.name} is on the observed hosting path. A two-day outage would interrupt the public application unless a tested failover exists.`
        : "No hosting vendor is in the model yet. The scenario still runs: concentration on one cloud is a material operational risk for any digital company.",
      financial: "UNKNOWN. VERIQ will not invent downtime or revenue-at-risk figures.",
      alternative: cloud
        ? alternateNote(
            vendors.filter(
              (item) => item.category === cloud.category && item.id !== cloud.id,
            ),
            cloud,
          )
        : "Not detected. Add a website or declare the cloud provider.",
      notification: "UNKNOWN. Status-page and customer-notice obligations were not attested.",
      mitigations: [
        "Name the production cloud account and the owner who can fail over.",
        "Attest a secondary region or provider and the last restore test date.",
        "Write the 48-hour customer message before it is needed.",
      ],
      unknowns: ["Which cloud actually hosts production", "Tested failover", "RTO / RPO"],
    },
    {
      id: "canonical-payment",
      kind: "vendor_outage",
      title: payment
        ? `${payment.name} unavailable for 48 hours`
        : "Primary payment rail unavailable for 48 hours",
      question: payment
        ? `What if ${payment.name} fails for 48 hours?`
        : "What if our primary payment provider fails for 48 hours?",
      duration: "48 hours",
      severity: "critical",
      confidence: payment ? 80 : 40,
      trustStatus: payment ? "inferred" : "unknown",
      originLabel: payment?.name ?? "Primary payment rail",
      chain: [
        payment?.name ?? "Payment provider",
        "Transaction processing",
        "Customer payments",
        "Revenue",
        "Liquidity",
        "Operations",
      ],
      affectedSystems: apps.map((node) => node.label).slice(0, 6),
      affectedVendors: payment ? [payment.name] : [],
      affectedRegulations: regs.map((item) => item.code),
      affectedFindings: nodesOf(input.graph, "risk")
        .filter((node) => node.id.includes("payment") || node.label.toLowerCase().includes("payment"))
        .map((node) => node.label)
        .slice(0, 6),
      operational: payment
        ? `${payment.name} sits on the collections path. Customer payments, onboarding and liquidity all sit downstream.`
        : "No payment vendor is observed yet. The scenario still runs because a single rail is how most Kenyan fintechs and SaaS companies take money.",
      financial: "UNKNOWN. No transaction volume or cash position is in the company model.",
      alternative: payment
        ? alternateNote(
            vendors.filter(
              (item) => item.category === "payments" && item.id !== payment.id,
            ),
            payment,
          )
        : "Not detected. Declare Paystack, M-Pesa, Stripe or the bank rail you actually use.",
      notification: "UNKNOWN whether scheme, bank or customer notice is required for an outage.",
      mitigations: [
        "Record the primary rail, the contract owner, and whether a second rail is live.",
        "Test a fallback collection path (another PSP, till, or invoice).",
        "Decide who tells customers if collections stop for a day.",
      ],
      unknowns: ["Actual processor", "Second rail", "Revenue on this path"],
    },
    {
      id: "canonical-secret",
      kind: "secret_exploit",
      title: secretRepo
        ? "Exposed credentials are used"
        : "A production credential is leaked",
      question: secretRepo
        ? "What if a public credential-class file is used by someone else?"
        : "What if a production credential is leaked?",
      duration: "Until rotated and history cleaned",
      severity: secretRepo ? "critical" : "high",
      confidence: secretRepo ? 84 : 46,
      trustStatus: secretRepo ? "inferred" : "unknown",
      originLabel: secretRepo?.label ?? "Production credentials",
      chain: [
        secretRepo?.label ?? "Credential",
        "Unauthorised access",
        "Application / data",
        regs[0]?.code ?? "Privacy / security duty",
        "Incident",
      ],
      affectedSystems: apps.map((node) => node.label).slice(0, 6),
      affectedVendors: nodesOf(input.graph, "vendor")
        .map((node) => node.label)
        .slice(0, 6),
      affectedRegulations: regs.map((item) => item.code),
      affectedFindings: nodesOf(input.graph, "risk")
        .filter((node) => node.id.includes("sensitive") || node.label.toLowerCase().includes("credential"))
        .map((node) => node.label)
        .slice(0, 6),
      operational: secretRepo
        ? "A public file that often holds secrets is an access path. VERIQ recorded the path — not the secret — and will not assume the value was harmless."
        : "No public credential-class file was observed. The scenario still runs: leaked production credentials are how most serious incidents start.",
      financial: "UNKNOWN. Fraud, recovery and regulatory cost are not modelled.",
      alternative: "Rotation is the mitigation. There is no alternate credential vendor.",
      notification: regs.length
        ? `Inferred: assess notification under ${regs.map((item) => item.code).join(", ")} if personal data or production access was in scope.`
        : "UNKNOWN whether this is a notifiable incident.",
      mitigations: [
        secretRepo
          ? "Remove the file from git history and rotate any credentials that may have been present."
          : "Inventory production secrets, rotate anything that has been in chat or a ticket, and keep them out of git.",
        "Treat this as a security and privacy event until proven otherwise.",
        "Add secret scanning to CI and rescan.",
      ],
      unknowns: secretRepo
        ? ["Whether a live secret was present", "Whether it was used", "Data accessed"]
        : ["Where production secrets actually live", "Whether any have leaked", "Blast radius"],
    },
  ];
}

function outageFor(vendor: VendorAssessment, input: {
  graph: RiskGraph | null;
  vendors: VendorAssessment[];
  assessments: RegulationAssessment[];
}): ScenarioResult {
  const originId = `vendor:${vendor.id}`;
  const blast = reach(input.graph, [originId, "company"], 3);
  const peers = sameCategory(input.vendors, vendor);
  const payment = vendor.category === "payments";
  const host = vendor.category === "hosting" || vendor.category === "cdn" || vendor.category === "cms";
  const identity = vendor.category === "identity";
  const severity: Severity = payment || (host && !peers.length) || identity
    ? peers.length
      ? "high"
      : "critical"
    : vendor.connectsToProduction
      ? "high"
      : "medium";

  const chain = payment
    ? [vendor.name, "Transaction processing", "Customer payments", "Revenue", "Liquidity", "Operations"]
    : host
      ? [vendor.name, "Application hosting", "Public website", "Customer access", "Operations"]
      : identity
        ? [vendor.name, "Authentication", "Customer and staff access", "Operations"]
        : [vendor.name, VENDOR_CATEGORY_LABELS[vendor.category], "Dependent services", "Operations"];

  return {
    id: `v-outage-${vendor.id}`,
    kind: "vendor_outage",
    title: `${vendor.name} unavailable for 48 hours`,
    question: `What if ${vendor.name} is unavailable for 48 hours?`,
    duration: "48 hours",
    severity,
    confidence: vendor.origin === "observed" ? 78 : 62,
    trustStatus: "inferred",
    originLabel: vendor.name,
    chain,
    affectedSystems: labels(blast, "application"),
    affectedVendors: [vendor.name, ...labels(blast, "vendor").filter((name) => name !== vendor.name)].slice(0, 8),
    affectedRegulations: labels(blast, "regulation"),
    affectedFindings: labels(blast, "risk").slice(0, 6),
    operational: host
      ? `The public application is ${vendor.connectsToProduction ? "on this vendor's production path" : "linked to this vendor"}. A 48-hour outage would interrupt customer access unless a failover exists.`
      : payment
        ? "Customer payments would stop on this rail. Collections, onboarding and liquidity all sit downstream — none of which VERIQ can quantify without financial data."
        : identity
          ? "Sign-in and privileged access could fail. Recovery depends on a second identity path that has not been attested."
          : `${vendor.name} sits on the ${VENDOR_CATEGORY_LABELS[vendor.category].toLowerCase()} path. Dependent customer or internal workflows may degrade.`,
    financial:
      "UNKNOWN. No revenue, transaction volume or cash position is in the company model. VERIQ will not invent an exposure figure.",
    alternative: alternateNote(peers, vendor),
    notification: vendor.processesData
      ? "UNKNOWN whether customers, regulators or partners must be notified of an outage. No incident clause was attested."
      : "Notification is less likely for a pure availability event, but remains UNKNOWN without a contract.",
    mitigations: [
      `Name an owner for ${vendor.name} and record the 48-hour recovery assumption.`,
      peers.length
        ? `Attest whether ${peers[0]!.name} is an actual failover, not only another observed vendor.`
        : `Establish a secondary ${VENDOR_CATEGORY_LABELS[vendor.category].toLowerCase()} rail and test it.`,
      "Document customer communication for a two-day interruption.",
    ],
    unknowns: [
      "Contractual uptime and credits",
      "Tested failover",
      "Financial exposure",
      vendor.questions.find((item) => item.key === "replacement")?.status === "unknown"
        ? "Replacement vendor"
        : "",
    ].filter(Boolean),
  };
}

function breachFor(vendor: VendorAssessment, input: {
  graph: RiskGraph | null;
  assessments: RegulationAssessment[];
}): ScenarioResult {
  const originId = `vendor:${vendor.id}`;
  const blast = reach(input.graph, [originId, "company"], 3);
  const regs = privacyRegs(input.assessments);
  const severity: Severity = vendor.processesData && (vendor.category === "payments" || vendor.category === "identity" || vendor.category === "hosting")
    ? "critical"
    : vendor.processesData
      ? "high"
      : "medium";

  return {
    id: `v-breach-${vendor.id}`,
    kind: "vendor_breach",
    title: `${vendor.name} is breached`,
    question: `What if ${vendor.name} is breached?`,
    duration: "Incident window unknown",
    severity,
    confidence: 70,
    trustStatus: "inferred",
    originLabel: vendor.name,
    chain: vendor.processesData
      ? [vendor.name, "Customer or operational data", "Notification duty", "Trust and regulation", "Operations"]
      : [vendor.name, "Service integrity", "Dependent workflows", "Operations"],
    affectedSystems: labels(blast, "application"),
    affectedVendors: [vendor.name],
    affectedRegulations: regs.map((item) => item.code),
    affectedFindings: labels(blast, "risk").slice(0, 6),
    operational: vendor.processesData
      ? `${vendor.name} is inferred to process ${vendor.dataClasses.join(", ") || "company or customer data"}. A breach is a security, privacy and vendor-management event at once.`
      : `A compromise of ${vendor.name} may still affect integrity of a dependent service. Data-in-scope remains UNKNOWN.`,
    financial:
      "UNKNOWN. Incident cost, regulatory fines and lost revenue are not modelled. Do not treat this as a loss estimate.",
    alternative: "Containment and substitution are UNKNOWN until a playbook and replacement are attested.",
    notification: regs.length
      ? `Inferred: ${regs.map((item) => item.code).join(", ")} may require assessment of notification. No incident clause or DPA was attested.`
      : "UNKNOWN whether notification is required.",
    mitigations: [
      `File or retrieve the ${vendor.name} DPA and incident-notification clause.`,
      "Decide in advance who is notified, and in what hours.",
      "Rotate credentials and tokens that this vendor could have held.",
    ],
    unknowns: ["DPA on file", "Incident notification clause", "Data actually processed", "Replacement vendor"],
  };
}

export function simulateScenarios(input: {
  graph: RiskGraph | null;
  vendors: VendorMap | null;
  assessments: RegulationAssessment[];
}): ScenarioResult[] {
  const vendors = [...(input.vendors?.vendors ?? [])].sort((a, b) => {
    const rank = { critical: 0, high: 1, medium: 2, low: 3 };
    return rank[a.criticality] - rank[b.criticality];
  });
  const results: ScenarioResult[] = [];
  const apps = nodesOf(input.graph, "application");
  const repos = nodesOf(input.graph, "repository");
  const secretRepos = repos.filter((node) => node.importance === "critical");
  const regs = privacyRegs(input.assessments);

  const outageCandidates = vendors.filter(
    (item) =>
      item.category === "payments" ||
      item.category === "hosting" ||
      item.category === "cdn" ||
      item.category === "cms" ||
      item.category === "identity" ||
      item.connectsToProduction,
  ).slice(0, 5);

  for (const vendor of outageCandidates) {
    results.push(outageFor(vendor, { graph: input.graph, vendors, assessments: input.assessments }));
  }

  const breachCandidates = vendors.filter((item) => item.processesData).slice(0, 5);
  for (const vendor of breachCandidates) {
    if (results.some((item) => item.id === `v-breach-${vendor.id}`)) continue;
    results.push(breachFor(vendor, { graph: input.graph, assessments: input.assessments }));
  }

  if (apps.length) {
    const app = apps[0]!;
    const blast = reach(input.graph, [app.id, "company"], 2);
    results.push({
      id: "site-outage",
      kind: "site_outage",
      title: `${app.label} unreachable`,
      question: `What if ${app.label} is unreachable?`,
      duration: "Until restored",
      severity: "high",
      confidence: 82,
      trustStatus: "inferred",
      originLabel: app.label,
      chain: [app.label, "Customer access", "Onboarding and support", "Revenue", "Reputation"],
      affectedSystems: [app.label],
      affectedVendors: labels(blast, "vendor").slice(0, 6),
      affectedRegulations: labels(blast, "regulation"),
      affectedFindings: labels(blast, "risk").slice(0, 6),
      operational:
        "Customers, partners and attackers all observe availability. An unreachable primary site is an operational and trust event, not only an IT outage.",
      financial: "UNKNOWN. No revenue-at-risk figure is available.",
      alternative: "A secondary customer channel (app, USSD, branch) has not been observed.",
      notification: "UNKNOWN. Status-page and customer-notice obligations were not attested.",
      mitigations: [
        "Confirm DNS, TLS and hosting health, and who is on call.",
        "Publish a status path before the next incident.",
        "If the domain is unused, retire it to reduce impersonation risk.",
      ],
      unknowns: ["RTO / RPO", "Status communication", "Revenue impact"],
    });
  }

  if (secretRepos.length || (input.graph?.nodes.some((node) => node.id.includes("github:sensitive")) ?? false)) {
    const blast = reach(
      input.graph,
      secretRepos.map((node) => node.id).concat("company"),
      3,
    );
    results.push({
      id: "secrets",
      kind: "secret_exploit",
      title: "Exposed credentials are used",
      question: "What if a public credential-class file is used by someone else?",
      duration: "Until rotated and history cleaned",
      severity: "critical",
      confidence: 84,
      trustStatus: "inferred",
      originLabel: secretRepos[0]?.label ?? "Public repository",
      chain: [
        secretRepos[0]?.label ?? "Public repository",
        "Credential-class file",
        "Unauthorised access",
        regs[0]?.code ?? "Privacy / security duty",
        "Incident",
      ],
      affectedSystems: labels(blast, "application"),
      affectedVendors: labels(blast, "vendor").slice(0, 6),
      affectedRegulations: regs.map((item) => item.code),
      affectedFindings: labels(blast, "risk").slice(0, 6),
      operational:
        "A public file that often holds secrets is an access path. VERIQ recorded the path only — not the secret — and will not assume the value was harmless.",
      financial: "UNKNOWN. Fraud, recovery and regulatory cost are not modelled.",
      alternative: "Rotation and history rewrite are the mitigation; there is no alternate 'credential vendor'.",
      notification: regs.length
        ? `Inferred: assess notification under ${regs.map((item) => item.code).join(", ")} if personal data or production access was in scope.`
        : "UNKNOWN whether this is a notifiable incident.",
      mitigations: [
        "Remove the file from git history and rotate any credentials that may have been present.",
        "Treat this as a security and privacy event until proven otherwise.",
        "Add the path to .gitignore and rescan.",
      ],
      unknowns: ["Whether a live secret was present", "Whether it was used", "Data accessed"],
    });
  }

  for (const reg of regs.slice(0, 2)) {
    results.push({
      id: `reg-${reg.code}`,
      kind: "regulation_change",
      title: `${reg.code} enforcement tightens`,
      question: `What if ${reg.name} is enforced more strictly against this company?`,
      duration: "Ongoing",
      severity: reg.coverage < 50 ? "high" : "medium",
      confidence: 68,
      trustStatus: "inferred",
      originLabel: reg.code,
      chain: [reg.name, "Evidence pack", "Control gaps", "Enforcement and customer trust"],
      affectedSystems: nodesOf(input.graph, "application").map((node) => node.label),
      affectedVendors: (input.vendors?.vendors ?? [])
        .filter((item) => item.processesData)
        .slice(0, 5)
        .map((item) => item.name),
      affectedRegulations: [reg.code],
      affectedFindings: nodesOf(input.graph, "risk")
        .filter((node) => node.id.includes(reg.code) || node.evidence === "regulatory")
        .map((node) => node.label)
        .slice(0, 6),
      operational: `${reg.impact} Observable coverage is ${reg.coverage}%. Missing attested artefacts stay UNKNOWN — VERIQ will not invent compliance.`,
      financial: "UNKNOWN. Fines and remediation cost are not estimated.",
      alternative: "There is no alternate statute. The mitigation is evidence, not a substitute vendor.",
      notification: "UNKNOWN. Notification and registration duties depend on facts not yet attested.",
      mitigations: [
        `Collect the unknown artefacts for ${reg.code}.`,
        "Close observed technical gaps (HTTPS, headers, public secrets) first.",
        "Assign a compliance owner for this statute.",
      ],
      unknowns: reg.evidence
        .filter((item) => item.status === "unknown")
        .slice(0, 4)
        .map((item) => item.label),
    });
  }

  results.push({
    id: "ransomware",
    kind: "ransomware",
    title: "Ransomware hits production",
    question: "What if ransomware hits us?",
    duration: "Days to weeks — UNKNOWN",
    severity: "critical",
    confidence: 48,
    trustStatus: "unknown",
    originLabel: "Production environment",
    chain: [
      "Initial access",
      "Privilege and backup path",
      "Operations halt",
      "Customer data",
      "Notification and recovery",
    ],
    affectedSystems: nodesOf(input.graph, "application").map((node) => node.label),
    affectedVendors: nodesOf(input.graph, "vendor")
      .filter((node) => node.importance === "critical" || node.importance === "high")
      .map((node) => node.label)
      .slice(0, 6),
    affectedRegulations: regs.map((item) => item.code),
    affectedFindings: nodesOf(input.graph, "risk")
      .filter((node) => node.risk === "critical" || node.risk === "high")
      .map((node) => node.label)
      .slice(0, 6),
    operational:
      "This scenario is mostly UNKNOWN. VERIQ has not observed backups, MFA on privileged access, or an incident playbook. It will not pretend the company is prepared.",
    financial: "UNKNOWN. Do not use a placeholder ransom or downtime figure.",
    alternative: "UNKNOWN. Immutable backups and a second environment have not been attested.",
    notification: regs.length
      ? `Inferred: ${regs.map((item) => item.code).join(", ")} likely require an incident assessment if personal data is involved.`
      : "UNKNOWN.",
    mitigations: [
      "Attest offline backups and a restore test date.",
      "Attest an incident playbook and who is called first.",
      "Close observed access paths (public credential-class files, missing MFA evidence).",
    ],
    unknowns: [
      "Backup and restore evidence",
      "Privileged MFA",
      "Incident playbook",
      "RTO / RPO",
      "Cyber insurance",
    ],
  });

  const unique = new Map<string, ScenarioResult>();
  for (const item of [...canonicalThree(input), ...results]) unique.set(item.id, item);
  const canonicalOrder = ["canonical-cloud", "canonical-payment", "canonical-secret"];
  return [...unique.values()].sort((a, b) => {
    const ac = canonicalOrder.indexOf(a.id);
    const bc = canonicalOrder.indexOf(b.id);
    if (ac !== -1 || bc !== -1) {
      if (ac === -1) return 1;
      if (bc === -1) return -1;
      return ac - bc;
    }
    return SEV_RANK[a.severity] - SEV_RANK[b.severity] || b.confidence - a.confidence;
  });
}

export function scenarioById(
  id: string,
  input: {
    graph: RiskGraph | null;
    vendors: VendorMap | null;
    assessments: RegulationAssessment[];
  },
) {
  const all = simulateScenarios(input);
  const hit = all.find((item) => item.id === id);
  if (hit) return hit;

  const vendors = input.vendors?.vendors ?? [];
  if (id.startsWith("v-outage-")) {
    const vendor = vendors.find((item) => item.id === id.slice("v-outage-".length));
    if (vendor) {
      return outageFor(vendor, {
        graph: input.graph,
        vendors,
        assessments: input.assessments,
      });
    }
  }
  if (id.startsWith("v-breach-")) {
    const vendor = vendors.find((item) => item.id === id.slice("v-breach-".length));
    if (vendor) return breachFor(vendor, { graph: input.graph, assessments: input.assessments });
  }
  return null;
}
