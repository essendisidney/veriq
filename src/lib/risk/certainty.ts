import type { Certainty, Severity, TrustStatus } from "@/lib/database.types";

export type { Certainty };

export const CERTAINTY_LABELS: Record<Certainty, string> = {
  confirmed: "Confirmed",
  potential: "Potential",
  informational: "Informational",
};

export function certaintyFor(input: {
  severity: Severity;
  confidence: number;
  evidence: { trust_status: TrustStatus }[];
}): Certainty {
  if (input.severity === "informational") return "informational";
  const trusts = input.evidence.map((item) => item.trust_status);
  if (
    trusts.length > 0 &&
    trusts.every((status) => status === "observed") &&
    input.confidence >= 75
  ) {
    return "confirmed";
  }
  return "potential";
}

export function slaDeadlineIso(priority: "critical" | "high" | "medium" | "low") {
  const hours = { critical: 24, high: 168, medium: 720, low: 2160 } as const;
  return new Date(Date.now() + hours[priority] * 3_600_000).toISOString();
}

export function isOverdue(deadline: string | null, status: string) {
  if (!deadline) return false;
  if (status === "done" || status === "cancelled" || status === "resolved") {
    return false;
  }
  return new Date(deadline).getTime() < Date.now();
}

export function daysSince(iso: string | null | undefined) {
  if (!iso) return null;
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return null;
  return Math.max(0, Math.floor((Date.now() - then) / 86_400_000));
}

export function staleDays(iso: string | null | undefined, threshold = 7) {
  const days = daysSince(iso);
  if (days == null || days < threshold) return null;
  return days;
}
