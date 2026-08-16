import type { ClaimRow, ClaimsAssessment } from "@/lib/claims/assess";

export type ChallengeAttack = {
  claimId: string;
  claim: string;
  title: string;
  attack: string;
  permittedSources: string[];
  refusedSources: string[];
  current: string;
  verdict: ClaimRow["verdict"];
  inference: boolean;
};

export function challengeCompany(claims?: ClaimsAssessment | null): ChallengeAttack[] {
  return (claims?.claims ?? []).map((item) => attackFor(item));
}

function attackFor(item: ClaimRow): ChallengeAttack {
  const base = {
    claimId: item.id,
    claim: item.claim,
    title: item.title,
    verdict: item.verdict,
    inference: Boolean(item.inference),
    current: item.why,
  };

  if (item.id === "people-headcount") {
    return {
      ...base,
      attack:
        "Assume the headcount claim is inflated. Look for a smaller public footprint than the story.",
      permittedSources: [
        "Company website copy",
        "Team/about page links on the company's own site",
        "Customer-uploaded payroll or organogram",
      ],
      refusedSources: ["LinkedIn scrape", "Leak databases", "Guessed headcount"],
    };
  }
  if (item.id === "corporate-directors") {
    return {
      ...base,
      attack:
        "Assume the people on the website are not the statutory directors. Demand the official extract.",
      permittedSources: ["Uploaded CR12 / company extract", "Customer attestation"],
      refusedSources: ["BRS scrape", "eCitizen bypass", "Invented director names"],
    };
  }
  if (item.id === "licence-operator") {
    return {
      ...base,
      attack:
        "Assume licence language is marketing. A checkout button is not a licence to operate.",
      permittedSources: [
        "Website licensed/regulated language (as a claim, not a register)",
        "Observed payment processors",
        "Uploaded licence artefact",
      ],
      refusedSources: ["CBK/CMA/IRA list scrape", "Invented licence numbers"],
    };
  }
  if (item.id === "commercial-presence") {
    return {
      ...base,
      attack:
        "Assume ‘across Africa’ means Kenya plus a landing page. Ask which countries are licensed.",
      permittedSources: ["Website geographic copy", "Uploaded licences or contracts"],
      refusedSources: ["Invented country lists", "Scraped foreign registries"],
    };
  }
  if (item.id === "integrity-related") {
    return {
      ...base,
      attack:
        "Assume related-party suppliers exist until an official extract and a supplier list can be joined. Do not allege fraud.",
      permittedSources: ["Attestation", "Uploaded CR12", "Uploaded related-party / procurement file"],
      refusedSources: ["Invented related companies", "PEP or corruption allegations"],
    };
  }
  if (item.id === "financial-revenue") {
    return {
      ...base,
      attack:
        "Assume the revenue story is a deck, not accounts. Refuse to treat website copy as a KES figure.",
      permittedSources: [
        "Attested qualitative band",
        "Customer-uploaded accounts (human-classified, not OCR-as-fact)",
      ],
      refusedSources: ["Invented turnover", "Parsed bank-statement amounts as truth"],
    };
  }
  return {
    ...base,
    attack: "Ask what evidence would disprove this claim. If none is permitted, leave it UNKNOWN.",
    permittedSources: ["Customer-uploaded artefacts", "Observed public website"],
    refusedSources: ["Unauthorised access", "Inference presented as fact"],
  };
}
