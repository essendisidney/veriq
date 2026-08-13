import {
  VENDOR_CATALOG,
  type VendorCategory,
  type VendorDef,
} from "@/lib/vendors/catalog";
import type { AssetCriticality, TrustStatus } from "@/lib/database.types";

export type VendorSource = {
  kind: "website" | "github" | "headers" | "declared";
  reference: string;
};

export type DetectedVendor = {
  id: string;
  name: string;
  category: VendorCategory;
  criticality: AssetCriticality;
  processesData: boolean;
  connectsToProduction: boolean;
  dataClasses: string[];
  sources: VendorSource[];
  origin: "observed" | "declared";
  trustStatus: TrustStatus;
};

function headerMap(
  headers?: Headers | Record<string, string | null>,
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!headers) return out;
  if (typeof (headers as Headers).forEach === "function" && !Array.isArray(headers)) {
    try {
      (headers as Headers).forEach((value, key) => {
        out[key.toLowerCase()] = value;
      });
      if (Object.keys(out).length) return out;
    } catch {
      // fall through to plain object
    }
  }
  for (const [key, value] of Object.entries(headers as Record<string, string | null>)) {
    if (value) out[key.toLowerCase()] = value;
  }
  return out;
}

function matchDef(
  def: VendorDef,
  input: {
    html: string;
    headers: Record<string, string>;
    technologies: string[];
    packages: string[];
  },
): VendorSource[] {
  const sources: VendorSource[] = [];
  const html = input.html.toLowerCase();

  for (const needle of def.html) {
    if (html.includes(needle.toLowerCase())) {
      sources.push({ kind: "website", reference: needle });
      break;
    }
  }

  for (const rule of def.headers ?? []) {
    const value = input.headers[rule.name.toLowerCase()];
    if (!value) continue;
    if (!rule.value || value.toLowerCase().includes(rule.value.toLowerCase())) {
      sources.push({
        kind: "headers",
        reference: rule.value ? `${rule.name}: ${value}` : rule.name,
      });
      break;
    }
  }

  for (const tech of def.tech ?? []) {
    if (input.technologies.some((item) => item.toLowerCase() === tech.toLowerCase())) {
      sources.push({ kind: "website", reference: tech });
      break;
    }
  }

  for (const pkg of def.packages ?? []) {
    if (input.packages.includes(pkg)) {
      sources.push({ kind: "github", reference: pkg });
      break;
    }
  }

  return sources;
}

export function detectVendors(input: {
  html?: string;
  headers?: Headers | Record<string, string | null>;
  technologies?: string[];
  packages?: string[];
}): DetectedVendor[] {
  const haystack = {
    html: input.html ?? "",
    headers: headerMap(input.headers),
    technologies: input.technologies ?? [],
    packages: input.packages ?? [],
  };

  const found: DetectedVendor[] = [];
  for (const def of VENDOR_CATALOG) {
    const sources = matchDef(def, haystack);
    if (!sources.length) continue;
    found.push({
      id: def.id,
      name: def.name,
      category: def.category,
      criticality: def.criticality,
      processesData: def.processesData,
      connectsToProduction: def.connectsToProduction,
      dataClasses: def.dataClasses,
      sources,
      origin: "observed",
      trustStatus: "observed",
    });
  }
  return found;
}

export function declaredFromAsset(row: {
  name: string;
  criticality: AssetCriticality;
  metadata: unknown;
}): DetectedVendor | null {
  if (!row.metadata || typeof row.metadata !== "object" || Array.isArray(row.metadata)) {
    return null;
  }
  const meta = row.metadata as {
    vendorId?: string;
    category?: VendorCategory;
    processesData?: boolean;
    connectsToProduction?: boolean;
    dataClasses?: string[];
  };
  if (!meta.vendorId) return null;
  return {
    id: meta.vendorId,
    name: row.name,
    category: meta.category ?? "other",
    criticality: row.criticality,
    processesData: Boolean(meta.processesData),
    connectsToProduction: Boolean(meta.connectsToProduction),
    dataClasses: meta.dataClasses ?? [],
    sources: [{ kind: "declared", reference: "register" }],
    origin: "declared",
    trustStatus: "unknown",
  };
}
