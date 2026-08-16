import type { ClaimsAssessment } from "@/lib/claims/assess";
import { normalizeVerdict } from "@/lib/claims/catalog";
import type { ChangeSet } from "@/lib/changes/diff";
import type { TrustProfile } from "@/lib/truth/profile";
import { TRUST_CALL_LABELS, callFromPosture, type TrustCall } from "@/lib/truth/call";
import { challengeCompany } from "@/lib/truth/challenge";

export type AskIntent =
  | "lend"
  | "procure"
  | "invest"
  | "insure"
  | "partner"
  | "challenge"
  | "delta"
  | "trust";

export type AskAnswer = {
  intent: AskIntent;
  question: string;
  call: TrustCall;
  headline: string;
  supporting: string[];
  risks: string[];
  unresolved: string[];
  documents: string[];
  questions: string[];
  disclaimer: string;
};

export function detectIntent(question: string): AskIntent {
  const q = question.toLowerCase();
  if (/chang|delta|since last|monitor|what.?s new/.test(q)) return "delta";
  if (/challeng|what should i (ask|challenge)|management/.test(q)) return "challenge";
  if (/lend|loan|facilit|ksh|credit|underwrite/.test(q)) return "lend";
  if (/procur|supplier|tender|contract|award/.test(q)) return "procure";
  if (/invest|diligence|founder|cap table|raise/.test(q)) return "invest";
  if (/insur|underwrit|policy/.test(q)) return "insure";
  if (/partner|onboard|joint/.test(q)) return "partner";
  return "trust";
}

export function answerAsk(input: {
  question: string;
  company: string;
  trust?: TrustProfile | null;
  claims?: ClaimsAssessment | null;
  changes?: ChangeSet | null;
  critical?: number;
}): AskAnswer {
  const intent = detectIntent(input.question);
  const call = callFromPosture(input.trust?.posture ?? "insufficient_evidence", {
    contradicted: input.trust?.contradicted,
    critical: input.critical,
  });
  const claims = input.claims?.claims ?? [];
  const contradicted = claims.filter((item) => normalizeVerdict(item.verdict) === "contradicted");
  const unverified = claims.filter((item) => normalizeVerdict(item.verdict) === "unverified");
  const unknown = claims.filter((item) => normalizeVerdict(item.verdict) === "unknown");
  const supporting = claims
    .filter((item) => {
      const v = normalizeVerdict(item.verdict);
      return v === "verified" || v === "corroborated";
    })
    .map((item) => `${item.title}: ${item.why}`)
    .slice(0, 3);
  if (supporting.length === 0 && input.trust) {
    supporting.push(`Public risk score ${input.trust.risk}/100 is not a clearance.`);
  }

  const risks = [
    ...contradicted.map((item) => `${item.title} is contradicted. ${item.decisionImpact ?? item.why}`),
    ...(input.trust?.material.map((item) => item.title) ?? []),
  ].slice(0, 4);

  const unresolved = [
    ...unverified.map((item) => `${item.title} is unverified.`),
    ...unknown.map((item) => `${item.title} is unknown.`),
  ].slice(0, 4);

  const documents = [
    ...new Set(
      claims
        .map((item) => item.requiredDocument)
        .filter((item): item is string => Boolean(item)),
    ),
  ].slice(0, 6);

  const challengeQs = challengeCompany(input.claims).map((item) => item.attack).slice(0, 7);

  const room =
    intent === "lend"
      ? `Lending to ${input.company}`
      : intent === "procure"
        ? `Procuring from ${input.company}`
        : intent === "invest"
          ? `Investing in ${input.company}`
          : intent === "insure"
            ? `Insuring ${input.company}`
            : intent === "partner"
              ? `Partnering with ${input.company}`
              : `Trusting ${input.company}`;

  let headline = `${TRUST_CALL_LABELS[call]} — ${room}.`;
  if (unknown.length + unverified.length >= 3) {
    headline = `${TRUST_CALL_LABELS[call]} — ${room}. ${unknown.length + unverified.length} facts are still UNKNOWN. A public site is not the decision file.`;
  }
  if (intent === "delta") {
    headline = input.changes?.summary
      ? input.changes.summary
      : "No completed scan pair yet. VERIQ will not invent a delta.";
  }
  if (intent === "challenge") {
    headline = `Challenge ${input.company} on the story, not the registration.`;
  }

  return {
    intent,
    question: input.question,
    call,
    headline,
    supporting: supporting.slice(0, 3),
    risks: risks.length ? risks : ["No open contradicted claims. Unknowns may still block a yes."],
    unresolved: unresolved.length ? unresolved : ["Upload a CR12 before treating ownership as known."],
    documents: documents.length ? documents : ["Current CR12 / official company extract."],
    questions: intent === "challenge" || intent === "invest" ? challengeQs : documents,
    disclaimer:
      "Ask VERIQ answers from evidence already on this company. It does not scrape BRS, invent KES amounts, or make a credit, legal or investment decision.",
  };
}
