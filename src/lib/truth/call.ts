export const TRUST_CALLS = ["proceed", "investigate", "stop"] as const;
export type TrustCall = (typeof TRUST_CALLS)[number];

export const TRUST_CALL_LABELS: Record<TrustCall, string> = {
  proceed: "Proceed",
  investigate: "Investigate",
  stop: "Stop / Escalate",
};

export const TRUST_CALL_HINTS: Record<TrustCall, string> = {
  proceed: "No observed red flags on the evidence we hold. This is not a clearance to lend, invest or award.",
  investigate: "Material unknowns or claims need evidence before you say yes.",
  stop: "Observed evidence conflicts with a safe yes. Escalate. VERIQ is not alleging fraud.",
};

export function callFromPosture(
  posture: string,
  opts?: { contradicted?: number; critical?: number },
): TrustCall {
  if ((opts?.critical ?? 0) > 0 || (opts?.contradicted ?? 0) > 0 || posture === "edd_required") {
    return "stop";
  }
  if (posture === "evidence_supports_decision") return "proceed";
  return "investigate";
}
