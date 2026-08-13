export const CADENCES = ["off", "daily", "weekly"] as const;
export type ScanCadence = (typeof CADENCES)[number];

export function parseCadence(value: unknown): ScanCadence {
  return CADENCES.includes(value as ScanCadence) ? (value as ScanCadence) : "off";
}

export function computeNextDue(cadence: ScanCadence, from = new Date()) {
  if (cadence === "off") return null;
  const due = new Date(from);
  due.setUTCDate(due.getUTCDate() + (cadence === "weekly" ? 7 : 1));
  return due.toISOString();
}

export function isScanDue(meta: { cadence?: unknown; nextDueAt?: unknown } | null) {
  const cadence = parseCadence(meta?.cadence);
  if (cadence === "off") return false;
  const due = typeof meta?.nextDueAt === "string" ? Date.parse(meta.nextDueAt) : NaN;
  return Number.isFinite(due) && due <= Date.now();
}
