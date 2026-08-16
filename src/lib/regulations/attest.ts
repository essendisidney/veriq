import { REGULATION_CATALOG } from "@/lib/regulations/ontology";

export type ArtefactBand = "unknown" | "yes" | "no";

export type RegulationAttestations = Record<string, Record<string, ArtefactBand>>;

export const REGULATION_ATTEST_ASSET = {
  type: "regulation_attestation",
  name: "Regulatory attestations",
} as const;

const BANDS: ArtefactBand[] = ["unknown", "yes", "no"];

export function attestedKeysFor(code: string) {
  const def = REGULATION_CATALOG.find((item) => item.code === code);
  return (def?.evidence ?? []).filter((item) => item.kind === "attested");
}

export function parseRegulationAttestations(metadata: unknown): RegulationAttestations {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {};
  }
  const out: RegulationAttestations = {};
  for (const [code, row] of Object.entries(metadata as Record<string, unknown>)) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const artefacts: Record<string, ArtefactBand> = {};
    for (const [key, value] of Object.entries(row as Record<string, unknown>)) {
      artefacts[key] = BANDS.includes(value as ArtefactBand)
        ? (value as ArtefactBand)
        : "unknown";
    }
    out[code] = artefacts;
  }
  return out;
}

export function pickArtefactBand(value: string): ArtefactBand {
  return BANDS.includes(value as ArtefactBand) ? (value as ArtefactBand) : "unknown";
}
