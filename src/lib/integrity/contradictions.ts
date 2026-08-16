import type { ActionPriority, Severity, TrustStatus } from "@/lib/database.types";
import type { AiAssessment } from "@/lib/ai/assess";
import type { FinanceAssessment } from "@/lib/finance/assess";
import type { VendorMap } from "@/lib/vendors/assess";

export type IntegrityContradiction = {
  fingerprint: string;
  title: string;
  description: string;
  category: "integrity" | "data" | "ai" | "financial";
  severity: Severity;
  likelihood: number;
  impact: number;
  confidence: number;
  why_it_matters: string;
  recommendation: string;
  owner_role: string;
  evidence: string;
  trust_status: TrustStatus;
  action?: { title: string; owner_role: string; priority: ActionPriority };
};

function trackerVendors(vendors: VendorMap | null) {
  return (vendors?.vendors ?? []).filter(
    (item) => item.category === "analytics" || item.category === "ads",
  );
}

function namedInNotice(name: string, excerpt: string) {
  const hay = excerpt.toLowerCase();
  const needles = name
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((part) => part.length >= 4);
  if (!needles.length) return hay.includes(name.toLowerCase());
  return needles.some((part) => hay.includes(part));
}

export function listContradictions(input: {
  privacyPolicyUrl: string | null;
  privacyPolicyExcerpt: string | null;
  vendors: VendorMap | null;
  ai: AiAssessment | null;
  finance: FinanceAssessment | null;
}): IntegrityContradiction[] {
  const out: IntegrityContradiction[] = [];
  const trackers = trackerVendors(input.vendors);
  const excerpt = input.privacyPolicyExcerpt ?? "";

  if (trackers.length) {
    if (!input.privacyPolicyUrl) {
      out.push({
        fingerprint: "contradiction:privacy-trackers",
        title: "Trackers observed with no privacy notice",
        description: `${trackers.map((item) => item.name).join(", ")} ${trackers.length === 1 ? "was" : "were"} observed on the public site. No privacy notice was found on this domain.`,
        category: "data",
        severity: "high",
        likelihood: 80,
        impact: 75,
        confidence: 86,
        why_it_matters:
          "A processor on the page without an observed notice is the finding a privacy officer would write — not a list of pixels.",
        recommendation:
          "Publish a privacy notice that names each tracker, or remove the trackers. Attest lawful basis separately.",
        owner_role: "Compliance",
        evidence: `Observed trackers: ${trackers.map((item) => item.name).join(", ")}. Privacy notice URL: not observed.`,
        trust_status: "observed",
        action: {
          title: "Publish a privacy notice that names observed trackers",
          owner_role: "Compliance",
          priority: "high",
        },
      });
    } else {
      const undeclared = trackers.filter(
        (item) => !namedInNotice(item.name, excerpt),
      );
      if (undeclared.length) {
        out.push({
          fingerprint: "contradiction:undeclared-trackers",
          title: "Privacy notice does not name observed trackers",
          description: `The notice at ${input.privacyPolicyUrl} does not name ${undeclared.map((item) => item.name).join(", ")}. Those processors were observed on the public site.`,
          category: "data",
          severity: "high",
          likelihood: 75,
          impact: 72,
          confidence: 82,
          why_it_matters:
            "Notice versus observed processors is a contradiction. VERIQ will not invent a lawful basis or a DPA.",
          recommendation:
            "Name every observed tracker in the notice, or remove the undeclared processors.",
          owner_role: "Compliance",
          evidence: `Notice: ${input.privacyPolicyUrl}. Undeclared: ${undeclared.map((item) => item.name).join(", ")}.`,
          trust_status: "observed",
          action: {
            title: "Align the privacy notice with observed trackers",
            owner_role: "Compliance",
            priority: "high",
          },
        });
      }
    }
  }

  const systems = input.ai?.systems ?? [];
  if (input.ai?.attested.inventory === "no" && systems.length) {
    out.push({
      fingerprint: "contradiction:ai-inventory",
      title: "Attested “no AI” versus observed AI systems",
      description: `The company attested that it does not use AI. This scan observed ${systems.map((item) => item.name).join(", ")}.`,
      category: "ai",
      severity: "high",
      likelihood: 85,
      impact: 70,
      confidence: 88,
      why_it_matters:
        "A lockfile or pixel that contradicts the inventory is the finding a human would be proud of — not another Copilot CVE.",
      recommendation:
        "Correct the AI inventory, or remove the observed system from production and source.",
      owner_role: "Compliance",
      evidence: systems
        .map(
          (item) =>
            `${item.name} (${item.origin}): ${item.sources.map((row) => row.reference).join(", ")}`,
        )
        .join("; "),
      trust_status: "observed",
      action: {
        title: "Reconcile attested AI inventory with observed systems",
        owner_role: "Compliance",
        priority: "high",
      },
    });
  }

  const rails = input.finance?.paymentVendors ?? [];
  if (input.finance?.attested.secondaryPaymentRail === "yes" && rails.length === 1) {
    out.push({
      fingerprint: "contradiction:secondary-rail",
      title: "Secondary payment rail attested versus one processor on the site",
      description: `A secondary collection rail was attested. The public site shows one payment processor: ${rails[0]!.name}.`,
      category: "financial",
      severity: "medium",
      likelihood: 70,
      impact: 75,
      confidence: 84,
      why_it_matters:
        "Continuity claims collapse when the customer path has a single observed rail. Amounts stay UNKNOWN.",
      recommendation:
        "Show the second rail on the customer path, or correct the attestation.",
      owner_role: "Finance",
      evidence: `Attested secondaryPaymentRail=yes. Observed processors: ${rails.map((item) => item.name).join(", ")}.`,
      trust_status: "observed",
      action: {
        title: "Evidence the second payment rail or correct the attestation",
        owner_role: "Finance",
        priority: "medium",
      },
    });
  }

  return out;
}
