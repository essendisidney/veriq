import { industryLabel, countryLabel, SCORE_DIMENSIONS } from "@/lib/utils";
import type { ReportBundle, ReportFlag } from "@/lib/reports/institutional";
import type { VendorAssessment } from "@/lib/vendors/assess";
import type { EvidenceStatus } from "@/lib/regulations/assess";

export const DOMAIN_KINDS = [
  "executive",
  "cyber",
  "regulatory",
  "vendor",
  "technology",
  "ai",
  "resilience",
  "integrity",
] as const;

export type DomainKind = (typeof DOMAIN_KINDS)[number];

export type DomainReport = {
  kind: DomainKind;
  title: string;
  audience: string;
  generatedAt: string;
  company: { name: string; industry: string; country: string };
  score: number | null;
  scoreLabel: string;
  summary: string;
  metrics: { label: string; value: string }[];
  flags: ReportFlag[];
  table: { title: string; columns: string[]; records: string[][] };
  unknowns: string[];
  actions: { title: string; owner: string; priority: string }[];
  disclaimer: string;
};

const META: Record<
  DomainKind,
  { title: string; audience: string; disclaimer: string }
> = {
  executive: {
    title: "Executive risk report",
    audience: "CEO, COO and leadership",
    disclaimer:
      "VERIQ is intelligence for management, not a legal, audit or credit opinion. Amounts remain UNKNOWN.",
  },
  cyber: {
    title: "Cybersecurity report",
    audience: "CISO and engineering",
    disclaimer:
      "This is observed external posture, not a penetration test, red-team or certification.",
  },
  regulatory: {
    title: "Regulatory report",
    audience: "Compliance, legal and the board",
    disclaimer:
      "VERIQ will not invent compliance. Mapped statutes and observable artefacts are not a legal opinion.",
  },
  vendor: {
    title: "Vendor risk report",
    audience: "Procurement and operational risk",
    disclaimer:
      "DPAs, substitution and incident clauses stay UNKNOWN until attested. This is not a vendor audit.",
  },
  technology: {
    title: "Technology risk report",
    audience: "CTO and engineering",
    disclaimer:
      "Public website, DNS/TLS and scanned repositories only. Internal systems were not observed.",
  },
  ai: {
    title: "AI governance report",
    audience: "Compliance, product and the board",
    disclaimer:
      "VERIQ will not assume ChatGPT, Copilot or an internal model is absent. This is not a model audit.",
  },
  resilience: {
    title: "Business resilience report",
    audience: "COO, risk and lenders",
    disclaimer:
      "Scenarios are inferred from the company model. Financial impact amounts remain UNKNOWN.",
  },
  integrity: {
    title: "Integrity and public-records report",
    audience: "Compliance, counsel, banks and public institutions",
    disclaimer:
      "Public registers VERIQ cannot query stay UNKNOWN. This is not an EACC finding, not a PEP hit, and not a claim that anyone is corrupt.",
  },
};

export function isDomainKind(value: string): value is DomainKind {
  return (DOMAIN_KINDS as readonly string[]).includes(value);
}

export function buildDomainReport(
  kind: DomainKind,
  org: { name: string; industry: string; country: string },
  bundle: ReportBundle,
): DomainReport | null {
  if (!bundle.score) return null;
  const meta = META[kind];
  const built = builders[kind](bundle);
  return {
    kind,
    title: meta.title,
    audience: meta.audience,
    generatedAt: new Date().toISOString(),
    company: {
      name: org.name,
      industry: org.industry,
      country: org.country,
    },
    score: built.score,
    scoreLabel: built.scoreLabel,
    summary: `${org.name} (${industryLabel(org.industry)}, ${countryLabel(org.country)}). ${built.summary}`,
    metrics: built.metrics,
    flags: built.flags.slice(0, 8),
    table: built.table,
    unknowns: built.unknowns.slice(0, 10),
    actions: bundle.actions.slice(0, 8).map((item) => ({
      title: item.title,
      owner: item.owner_role ?? "Unassigned",
      priority: item.priority,
    })),
    disclaimer: meta.disclaimer,
  };
}

type Built = {
  score: number;
  scoreLabel: string;
  summary: string;
  metrics: { label: string; value: string }[];
  flags: ReportFlag[];
  table: { title: string; columns: string[]; records: string[][] };
  unknowns: string[];
};

const builders: Record<DomainKind, (bundle: ReportBundle) => Built> = {
  executive: (bundle) => {
    const critical = bundle.risks.filter(
      (item) => item.severity === "critical" || item.severity === "high",
    );
    return {
      score: bundle.score!.overall,
      scoreLabel: "VERIQ Score",
      summary: `Overall ${bundle.score!.overall}/100. ${critical.length} critical or high finding${critical.length === 1 ? "" : "s"} open. This is a management snapshot, not a forecast.`,
      metrics: SCORE_DIMENSIONS.slice(0, 6).map((dim) => ({
        label: dim.label,
        value: String(bundle.score![dim.key]),
      })),
      flags: findingFlags(bundle.risks, () => true),
      table: {
        title: "Open findings",
        columns: ["Title", "Severity", "Category"],
        records: bundle.risks.slice(0, 12).map((item) => [item.title, item.severity, item.category]),
      },
      unknowns: [
        ...(bundle.finance?.unknowns.slice(0, 3) ?? []),
        ...(bundle.ai?.unknowns.slice(0, 2) ?? []),
        "Whether an incident is underway",
      ],
    };
  },
  cyber: (bundle) => {
    const exp = bundle.exposure;
    const findings = bundle.risks.filter((item) => item.category === "cybersecurity");
    return {
      score: bundle.score!.cybersecurity,
      scoreLabel: "Cybersecurity",
      summary: exp
        ? `External posture ${exp.posture}/100. TLS ${exp.tls?.daysRemaining != null ? `${exp.tls.daysRemaining}d remaining` : "UNKNOWN"}. SPF ${exp.spf ? "observed" : "not observed"}, DMARC ${exp.dmarc ? "observed" : "not observed"}.`
        : "External exposure has not been modelled. Run a scan with a website.",
      metrics: [
        { label: "Cyber score", value: String(bundle.score!.cybersecurity) },
        { label: "Exposure posture", value: exp ? String(exp.posture) : "—" },
        { label: "Hostnames", value: String(exp?.hostnames.length ?? 0) },
        { label: "security.txt", value: exp?.securityTxt ? "Observed" : "Not observed" },
        { label: "HTTPS redirect", value: yn(exp?.httpsRedirect) },
        { label: "Open cyber findings", value: String(findings.length) },
      ],
      flags: findingFlags(findings, () => true),
      table: {
        title: "Cyber findings",
        columns: ["Title", "Severity", "Why it matters"],
        records: findings
          .slice(0, 12)
          .map((item) => [item.title, item.severity, item.why_it_matters ?? ""]),
      },
      unknowns: [
        "Internal vulnerability scan",
        "EDR / MFA on privileged accounts",
        "Incident response playbook",
        "Whether a breach has occurred",
      ],
    };
  },
  regulatory: (bundle) => {
    const findings = bundle.risks.filter((item) => item.category === "regulatory");
    const weak = bundle.regulatory.filter((item) => item.coverage < 50).length;
    return {
      score: bundle.score!.regulatory,
      scoreLabel: "Regulatory",
      summary: `${bundle.regulatory.length} statute${bundle.regulatory.length === 1 ? "" : "s"} mapped from country and industry. ${weak} below 50% observable coverage. VERIQ will not invent compliance.`,
      metrics: [
        { label: "Regulatory score", value: String(bundle.score!.regulatory) },
        { label: "Mapped statutes", value: String(bundle.regulatory.length) },
        { label: "Below 50% coverage", value: String(weak) },
        { label: "Open regulatory findings", value: String(findings.length) },
      ],
      flags: findingFlags(findings, () => true),
      table: {
        title: "Mapped statutes",
        columns: ["Code", "Name", "Coverage", "Unknown artefacts"],
        records: bundle.regulatory.map((item) => [
          item.code,
          item.name,
          `${item.coverage}%`,
          String(item.evidence.filter((row: EvidenceStatus) => row.status === "unknown").length),
        ]),
      },
      unknowns: [
        "Lawful basis record",
        "Retention schedule",
        "Board risk oversight minutes",
        "Whether the company is in scope for extra-territorial statutes",
      ],
    };
  },
  vendor: (bundle) => {
    const vendors = bundle.vendors?.vendors ?? [];
    const findings = bundle.risks.filter((item) => item.category === "vendor");
    return {
      score: bundle.score!.vendor,
      scoreLabel: "Vendor",
      summary: `${vendors.length} vendor${vendors.length === 1 ? "" : "s"} mapped. ${bundle.vendors?.criticalCount ?? 0} high-importance. Substitution and DPAs stay UNKNOWN until attested.`,
      metrics: [
        { label: "Vendor score", value: String(bundle.score!.vendor) },
        { label: "Mapped vendors", value: String(vendors.length) },
        { label: "Critical / high", value: String(bundle.vendors?.criticalCount ?? 0) },
        { label: "Data processors", value: String(bundle.vendors?.dataProcessors ?? 0) },
        { label: "Payment rails", value: bundle.finance?.paymentRails.join(", ") || "Unknown" },
      ],
      flags: findingFlags(findings, () => true),
      table: {
        title: "Vendors",
        columns: ["Name", "Category", "Criticality", "Risk", "Origin"],
        records: vendors
          .slice(0, 16)
          .map((item: VendorAssessment) => [
            item.name,
            item.category,
            item.criticality,
            item.risk,
            item.origin,
          ]),
      },
      unknowns: [
        "Data processing agreement on file",
        "Replacement vendor",
        "Incident-notification clause",
        "Data actually processed",
      ],
    };
  },
  technology: (bundle) => {
    const snap = bundle.snapshot;
    const findings = bundle.risks.filter(
      (item) => item.category === "technology" || item.category === "cybersecurity",
    );
    return {
      score: bundle.score!.technology,
      scoreLabel: "Technology",
      summary: snap
        ? `${snap.website ?? "No website"} · ${snap.github ?? "No GitHub"} · ${snap.repos.length} repositor${snap.repos.length === 1 ? "y" : "ies"} · ${snap.packages.length} packages observed.`
        : "Technology snapshot has not been stored yet. Rescan to populate repositories and packages.",
      metrics: [
        { label: "Technology score", value: String(bundle.score!.technology) },
        { label: "Website", value: snap?.website ?? "Unknown" },
        { label: "GitHub", value: snap?.github ?? "Unknown" },
        { label: "Repositories", value: String(snap?.repos.length ?? 0) },
        { label: "Packages", value: String(snap?.packages.length ?? 0) },
        { label: "Hostnames", value: String(snap?.hostnames.length ?? bundle.exposure?.hostnames.length ?? 0) },
      ],
      flags: findingFlags(findings, () => true),
      table: {
        title: "Observed repositories",
        columns: ["Repository"],
        records: (snap?.repos.length ? snap.repos : ["None observed on the last snapshot"]).map(
          (item) => [item],
        ),
      },
      unknowns: [
        "Private repositories",
        "Internal services and admin panels",
        "Cloud account configuration",
        "Whether production matches the public site",
      ],
    };
  },
  ai: (bundle) => {
    const findings = bundle.risks.filter((item) => item.category === "ai");
    const attested = bundle.ai?.attested;
    return {
      score: bundle.score!.ai,
      scoreLabel: "AI",
      summary:
        bundle.ai?.summary ??
        "AI usage is UNKNOWN. VERIQ will not assume Copilot, ChatGPT or an internal model is absent.",
      metrics: [
        { label: "AI score", value: String(bundle.score!.ai) },
        { label: "Systems", value: String(bundle.ai?.systems.length ?? 0) },
        { label: "Inventory attested", value: attested?.inventory ?? "unknown" },
        { label: "Human oversight", value: attested?.humanOversight ?? "unknown" },
        { label: "Trains on customer data", value: attested?.trainsOnCustomerData ?? "unknown" },
        { label: "Customer-facing", value: attested?.customerFacing ?? "unknown" },
      ],
      flags: findingFlags(findings, () => true),
      table: {
        title: "AI systems",
        columns: ["Name", "Category", "Origin", "Processes data"],
        records: (bundle.ai?.systems ?? []).map((item) => [
          item.name,
          item.category,
          item.origin,
          item.processesData ? "yes" : "not inferred",
        ]),
      },
      unknowns: bundle.ai?.unknowns.slice(0, 8) ?? ["Whether AI is used at all"],
    };
  },
  resilience: (bundle) => {
    const findings = bundle.risks.filter(
      (item) => item.category === "operational" || item.category === "financial",
    );
    return {
      score: bundle.score!.operational,
      scoreLabel: "Operational",
      summary: `${bundle.scenarios.length} scenario${bundle.scenarios.length === 1 ? "" : "s"} inferred from the company model. Payment concentration ${bundle.finance?.paymentConcentration ?? "unknown"}. Financial impact amounts remain UNKNOWN.`,
      metrics: [
        { label: "Operational score", value: String(bundle.score!.operational) },
        { label: "Scenarios", value: String(bundle.scenarios.length) },
        { label: "Payment concentration", value: bundle.finance?.paymentConcentration ?? "unknown" },
        { label: "Key person", value: bundle.finance?.attested.keyPerson ?? "unknown" },
        { label: "Single site", value: bundle.finance?.attested.singleSite ?? "unknown" },
        { label: "Correlated paths", value: String(bundle.graph?.paths.length ?? 0) },
      ],
      flags: [
        ...findingFlags(findings, () => true),
        ...bundle.scenarios.slice(0, 3).map((item) => ({
          id: item.id,
          severity:
            item.severity === "critical" || item.severity === "high" || item.severity === "medium"
              ? item.severity
              : ("watch" as const),
          title: item.title,
          detail: item.financial,
          href: `/scenarios/${item.id}`,
        })),
      ],
      table: {
        title: "Scenarios",
        columns: ["Scenario", "Severity", "Operational impact"],
        records: bundle.scenarios
          .slice(0, 8)
          .map((item) => [item.title, item.severity, item.operational]),
      },
      unknowns: [
        "Revenue at risk (amount)",
        "Recovery time actually tested",
        "Insurance cover",
        ...(bundle.finance?.unknowns.slice(0, 3) ?? []),
      ],
    };
  },
  integrity: (bundle) => {
    const findings = bundle.risks.filter(
      (item) =>
        item.fingerprint.startsWith("contradiction:") ||
        item.category === "integrity" ||
        item.fingerprint.startsWith("reg:missing-evidence:KE-ACECA") ||
        item.fingerprint.startsWith("reg:missing-evidence:KE-BO") ||
        item.fingerprint.startsWith("reg:missing-evidence:KE-PPADA"),
    );
    const recs = bundle.integrity?.records ?? [];
    return {
      score: bundle.score!.reputation,
      scoreLabel: "Reputation / integrity",
      summary:
        bundle.integrity?.summary ??
        "Public registers are UNKNOWN until observed. VERIQ will not invent corruption, a shell company or an unlicensed rail.",
      metrics: [
        { label: "Reputation score", value: String(bundle.score!.reputation) },
        { label: "Contradictions", value: String(bundle.integrity?.contradictions.length ?? findings.filter((item) => item.fingerprint.startsWith("contradiction:")).length) },
        { label: "Observed records", value: String(bundle.integrity?.observed ?? 0) },
        { label: "Unknown registers", value: String(bundle.integrity?.unknown ?? recs.filter((item) => item.status === "unknown").length) },
        { label: "Watch regimes", value: String(bundle.integrity?.watch ?? 0) },
        { label: "Joined hostnames", value: String(bundle.exposure?.joined?.length ?? 0) },
      ],
      flags: findingFlags(findings, () => true),
      table: {
        title: "Public records",
        columns: ["Record", "Status", "Source"],
        records: recs.slice(0, 12).map((item) => [item.title, item.status, item.source]),
      },
      unknowns: recs
        .filter((item) => item.status === "unknown")
        .slice(0, 8)
        .map((item) => item.title),
    };
  },
};

function findingFlags(
  risks: ReportBundle["risks"],
  pred: (item: ReportBundle["risks"][number]) => boolean,
): ReportFlag[] {
  return risks
    .filter(pred)
    .filter((item) => item.severity === "critical" || item.severity === "high" || item.severity === "medium")
    .slice(0, 6)
    .map((item) => ({
      id: item.id,
      severity: item.severity === "critical" ? "critical" : item.severity === "high" ? "high" : "medium",
      title: item.title,
      detail: item.why_it_matters ?? item.description,
      href: `/findings/${item.id}`,
    }));
}

function yn(value: boolean | null | undefined) {
  if (value == null) return "Unknown";
  return value ? "Yes" : "No";
}
