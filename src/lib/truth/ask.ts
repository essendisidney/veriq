import type { ClaimsAssessment } from "@/lib/claims/assess";
import { normalizeVerdict } from "@/lib/claims/catalog";
import type { ChangeSet } from "@/lib/changes/diff";
import type { TrustProfile } from "@/lib/truth/profile";
import { TRUST_CALL_LABELS, callFromPosture, type TrustCall } from "@/lib/truth/call";
import { challengeCompany } from "@/lib/truth/challenge";
import type { AcquisitionAssessment } from "@/lib/acquire/types";
import type { FinancialHealth } from "@/lib/finance/health";
import type { TruthScore } from "@/lib/truth/score";
import type { GovernanceAssessment } from "@/lib/truth/governance";
import type { DiggerReport } from "@/lib/digger/types";

export type AskIntent =
  | "lend"
  | "procure"
  | "invest"
  | "insure"
  | "partner"
  | "challenge"
  | "delta"
  | "trust"
  | "contradict"
  | "leakage"
  | "suppliers"
  | "missing"
  | "score"
  | "governance"
  | "directors"
  | "fix";

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
  if (/contradict|does a agree|inconsist/.test(q)) return "contradict";
  if (/leakage|biggest financial|where is (the )?money/.test(q)) return "leakage";
  if (/supplier|related.party|conflict of interest/.test(q)) return "suppliers";
  if (/who (runs|owns|controls)|named (people|persons)|which directors|who (are|is) the directors|list (of )?directors/.test(q))
    return "directors";
  if (/board|governance|segregation|controls/.test(q)) return "governance";
  if (/director/.test(q) && !/related/.test(q)) return "directors";
  if (/fix first|what should management|remediat|priority/.test(q)) return "fix";
  if (/missing|what information|what (are we|do we) miss/.test(q)) return "missing";
  if (/why.*(score|68|give us)|what would (an investor|a lender)/.test(q)) return "score";
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
  acquisition?: AcquisitionAssessment | null;
  health?: FinancialHealth | null;
  truthScore?: TruthScore | null;
  governance?: GovernanceAssessment | null;
  digger?: DiggerReport | null;
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
  if (intent === "contradict") {
    const rows = input.acquisition?.conflicts ?? [];
    headline = rows.length
      ? `${rows.length} contradiction${rows.length === 1 ? "" : "s"} on the evidence graph. Each requires validation.`
      : "No two-source amount or claim contradiction is on file yet. Upload searchable accounts and a bank statement, or wait for a scan.";
    return {
      intent,
      question: input.question,
      call,
      headline,
      supporting: rows.slice(0, 4).map((row) => row.why),
      risks: rows.map((row) => row.claim),
      unresolved: [],
      documents: ["Management/audited accounts", "Bank statement"],
      questions: [],
      disclaimer:
        "Contradictions are evidence conflicts, not fraud findings. VERIQ does not scrape BRS or invent KES.",
    };
  }
  if (intent === "leakage") {
    const anomalies = input.health?.anomalies ?? [];
    headline = anomalies.length
      ? anomalies[0].why
      : "No authorised ledger amounts were extracted, so financial leakage is UNKNOWN.";
    return {
      intent,
      question: input.question,
      call,
      headline,
      supporting: (input.health?.ratios ?? [])
        .filter((row) => row.status === "computed")
        .map((row) => `${row.label}: ${row.display}`),
      risks: anomalies.map((row) => row.title),
      unresolved: input.health?.missing.slice(0, 4) ?? [],
      documents: ["Bank statement", "Accounts"],
      questions: [],
      disclaimer:
        "Patterns require investigation. They are not accusations. Missing inputs stay UNKNOWN.",
    };
  }
  if (intent === "suppliers") {
    const related = (input.acquisition?.edges ?? []).filter((edge) => edge.kind === "related_party");
    headline = related.length
      ? `${related.length} possible related-party edge${related.length === 1 ? "" : "s"} require human validation.`
      : "No related-party edge is on the graph yet. People from the website are unverified, not CR12 directors.";
    return {
      intent,
      question: input.question,
      call,
      headline,
      supporting: related.map((edge) => edge.why),
      risks: related.map((edge) => edge.why),
      unresolved: ["CR12 / official extract for directors"],
      documents: ["CR12 / company extract"],
      questions: [],
      disclaimer: "Website names are not directors. LinkedIn is not scraped.",
    };
  }
  if (intent === "missing") {
    const missing = [
      ...(input.health?.missing ?? []),
      ...(input.acquisition?.domains ?? [])
        .filter((row) => row.status !== "connected")
        .map((row) => row.need),
    ].slice(0, 8);
    headline = missing.length
      ? `${missing.length} evidence gaps. No evidence = no conclusion.`
      : "Connected sources cover the starter set. Ownership and ledgers may still be incomplete.";
    return {
      intent,
      question: input.question,
      call,
      headline,
      supporting: [],
      risks: [],
      unresolved: missing,
      documents: missing,
      questions: [],
      disclaimer: "Ask VERIQ lists missing artefacts. It does not fill them in.",
    };
  }
  if (intent === "score") {
    headline = input.truthScore?.summary ?? `Public risk score ${input.trust?.risk ?? "—"}/100 is not a clearance.`;
    const lender =
      /lender|lend|credit/.test(input.question.toLowerCase())
        ? [
            "Lender worry: cash vs revenue contradiction, ownership extract, licence standing.",
            ...(input.health?.missing.slice(0, 3) ?? []),
          ]
        : /investor/.test(input.question.toLowerCase())
          ? [
              "Investor worry: growth without inflows, related-party edges, unverified headcount.",
              ...(input.acquisition?.conflicts.slice(0, 2).map((row) => row.why) ?? []),
            ]
          : [];
    return {
      intent,
      question: input.question,
      call,
      headline,
      supporting: [
        ...(input.truthScore?.dimensions ?? [])
          .filter((row) => row.score != null)
          .map((row) => `${row.label}: ${row.score}/100. ${row.why}`),
        ...lender,
      ].slice(0, 8),
      risks: [],
      unresolved: input.truthScore?.unknown.map((row) => `${row} is UNKNOWN.`) ?? [],
      documents: [],
      questions: [],
      disclaimer:
        "The organizational truth score averages evidenced dimensions only. UNKNOWN is omitted, never scored as zero.",
    };
  }
  if (intent === "governance") {
    const gov = input.governance;
    headline = gov?.summary ?? "Governance stays UNKNOWN until ownership or board artefacts are uploaded.";
    return {
      intent,
      question: input.question,
      call,
      headline,
      supporting: (gov?.findings ?? []).map((row) => `${row.title}: ${row.why}`),
      risks: (gov?.findings ?? [])
        .filter((row) => row.status === "requires_validation")
        .map((row) => row.title),
      unresolved: gov?.missing ?? [],
      documents: ["CR12 / company extract", "Board minutes", "Policy"],
      questions: [],
      disclaimer: "Governance findings require human validation. Not a legal opinion.",
    };
  }
  if (intent === "directors") {
    const officers =
      input.acquisition?.entities.filter(
        (row) => row.kind === "director" || row.kind === "shareholder",
      ) ?? [];
    const directors = officers.filter((row) => row.kind === "director");
    const people = input.digger?.people ?? [];
    headline = directors.length
      ? `${directors.length} director name(s) parsed from an authorised ownership extract text layer.`
      : people.length
        ? `${people.length} people named on the public site — unverified, not CR12 directors.`
        : "No people were extracted. Ownership stays UNKNOWN without a searchable CR12.";
    return {
      intent,
      question: input.question,
      call,
      headline,
      supporting: [
        ...directors.map((row) => `${row.label} · director (from extract)`),
        ...officers
          .filter((row) => row.kind === "shareholder")
          .map((row) => `${row.label} · shareholder (from extract)`),
        ...people.map((row) => `${row.name} · ${row.role} (website, unverified)`),
      ],
      risks: (input.acquisition?.edges ?? [])
        .filter((edge) => edge.kind === "related_party")
        .map((edge) => edge.why),
      unresolved: directors.length
        ? ["Confirm parsed names against the original CR12 PDF"]
        : ["Upload a searchable CR12 before treating anyone as a director"],
      documents: ["CR12 / company extract"],
      questions: [],
      disclaimer:
        "Parsed extract names require human confirmation. Website names are not directors. LinkedIn and BRS are not scraped.",
    };
  }
  if (intent === "fix") {
    const anomalies = input.health?.anomalies ?? [];
    const conflicts = input.acquisition?.conflicts ?? [];
    headline = "Fix evidence gaps and contradictions first. VERIQ does not invent a remediation plan.";
    return {
      intent,
      question: input.question,
      call,
      headline,
      supporting: [
        ...conflicts.slice(0, 2).map((row) => `Reconcile: ${row.claim}`),
        ...anomalies.slice(0, 2).map((row) => `Investigate: ${row.title}`),
        ...(input.governance?.missing.slice(0, 2).map((row) => `Upload: ${row}`) ?? []),
      ],
      risks: anomalies.map((row) => row.title),
      unresolved: input.health?.missing.slice(0, 4) ?? [],
      documents: ["Accounts", "Bank statement", "CR12"],
      questions: challengeQs.slice(0, 4),
      disclaimer: "Priority is evidence completeness, not a project plan.",
    };
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
