import type { AssetCriticality, Severity, TrustStatus } from "@/lib/database.types";
import type { DetectedVendor } from "@/lib/vendors/detect";

export type VendorQuestion = {
  key: string;
  label: string;
  status: "yes" | "no" | "unknown";
};

export type VendorAssessment = DetectedVendor & {
  risk: Severity;
  reason: string;
  questions: VendorQuestion[];
};

export type VendorMap = {
  vendors: VendorAssessment[];
  concentration: number;
  criticalCount: number;
  dataProcessors: number;
  productionConnected: number;
  unknownAnswers: number;
};

const RANK: Record<AssetCriticality, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function questionsFor(vendor: DetectedVendor): VendorQuestion[] {
  return [
    {
      key: "processes_data",
      label: "Does this vendor process our data?",
      status: vendor.processesData ? "yes" : "no",
    },
    {
      key: "connects_production",
      label: "Does it connect to production?",
      status: vendor.connectsToProduction ? "yes" : "no",
    },
    {
      key: "dpa",
      label: "Is a data processing agreement on file?",
      status: "unknown",
    },
    {
      key: "replacement",
      label: "Is there a replacement vendor?",
      status: "unknown",
    },
    {
      key: "notification",
      label: "Is incident notification required?",
      status: vendor.processesData ? "unknown" : "no",
    },
  ];
}

function rate(vendor: DetectedVendor, questions: VendorQuestion[]): {
  risk: Severity;
  reason: string;
} {
  const unknownMaterial = questions.filter(
    (item) =>
      item.status === "unknown" &&
      (item.key === "dpa" || item.key === "replacement") &&
      (vendor.criticality === "critical" || vendor.criticality === "high"),
  );

  if (vendor.category === "payments" && vendor.processesData) {
    return {
      risk: "high",
      reason:
        "Payment processor observed. Customer financial data is in scope; DPA and incident notification remain UNKNOWN.",
    };
  }

  if (vendor.category === "identity") {
    return {
      risk: "high",
      reason:
        "Identity provider sits on the authentication path. A vendor incident can lock out customers or leak credentials.",
    };
  }

  if (vendor.category === "hosting" && vendor.connectsToProduction) {
    return {
      risk: unknownMaterial.length ? "high" : "medium",
      reason:
        "Hosting or data-platform vendor is on the production path. Concentration and substitution are not yet evidenced.",
    };
  }

  if (vendor.category === "ads" || vendor.category === "analytics") {
    return {
      risk: "medium",
      reason:
        "Tracker observed on the public site. This is a privacy and vendor-management finding until lawful basis and DPA are attested.",
    };
  }

  if (unknownMaterial.length && vendor.criticality === "critical") {
    return {
      risk: "high",
      reason: "Critical vendor with missing attested artefacts (DPA, replacement).",
    };
  }

  if (vendor.criticality === "low") {
    return {
      risk: "informational",
      reason: "Observed third party with limited inferred blast radius.",
    };
  }

  return {
    risk: "low",
    reason: "Third party observed. Material questions remain UNKNOWN until attested.",
  };
}

export function assessVendors(input: {
  detected: DetectedVendor[];
  declared?: DetectedVendor[];
}): VendorMap {
  const byId = new Map<string, DetectedVendor>();

  for (const vendor of input.declared ?? []) {
    byId.set(vendor.id, { ...vendor, origin: "declared", trustStatus: vendor.trustStatus });
  }

  for (const vendor of input.detected) {
    const existing = byId.get(vendor.id);
    if (!existing) {
      byId.set(vendor.id, vendor);
      continue;
    }
    byId.set(vendor.id, {
      ...existing,
      ...vendor,
      criticality: RANK[existing.criticality] < RANK[vendor.criticality]
        ? existing.criticality
        : vendor.criticality,
      sources: [...existing.sources, ...vendor.sources],
      origin: "observed",
      trustStatus: "observed" as TrustStatus,
    });
  }

  const vendors = [...byId.values()]
    .map((vendor) => {
      const qs = questionsFor(vendor);
      const { risk, reason } = rate(vendor, qs);
      return { ...vendor, questions: qs, risk, reason };
    })
    .sort((a, b) => RANK[a.criticality] - RANK[b.criticality] || a.name.localeCompare(b.name));

  const critical = vendors.filter(
    (item) => item.criticality === "critical" || item.criticality === "high",
  );
  const dataProcessors = vendors.filter((item) => item.processesData);
  const productionConnected = vendors.filter((item) => item.connectsToProduction);
  const unknownAnswers = vendors.reduce(
    (sum, vendor) =>
      sum + vendor.questions.filter((item) => item.status === "unknown").length,
    0,
  );

  const concentration =
    critical.length === 0
      ? 20
      : Math.min(100, 35 + critical.length * 12 + productionConnected.length * 6);

  return {
    vendors,
    concentration,
    criticalCount: critical.length,
    dataProcessors: dataProcessors.length,
    productionConnected: productionConnected.length,
    unknownAnswers,
  };
}
