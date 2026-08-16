export type PublicQuery =
  | { kind: "website"; website: string }
  | { kind: "name"; name: string }
  | { kind: "blocked"; error: string };

function looksLikeDomain(value: string) {
  return /^[a-z0-9][a-z0-9.-]+\.[a-z]{2,}$/i.test(value) && !value.includes(" ");
}

function looksLikeRegistration(value: string) {
  const v = value.trim().toUpperCase();
  return (
    /^(PVT[-/]?[A-Z0-9]{4,}|C\.?\d{4,}|CPR[-/]\d+|BN[-/]?\d{4,}|P\/?N[O]?[-/]?\d+)/.test(v) ||
    /^\d{6,}$/.test(v)
  );
}

export function resolvePublicQuery(input: string): PublicQuery {
  const raw = input.trim();
  if (!raw) {
    return {
      kind: "blocked",
      error: "Name the company, or paste a public website.",
    };
  }

  const email = raw.match(/^[^\s@]+@([^\s@]+\.[^\s@]+)$/i);
  if (email) {
    return { kind: "website", website: `https://${email[1]!.toLowerCase()}` };
  }

  if (/^https?:\/\//i.test(raw) || looksLikeDomain(raw)) {
    return { kind: "website", website: raw };
  }

  if (/^\+?\d[\d\s-]{6,}$/.test(raw)) {
    return {
      kind: "blocked",
      error:
        "VERIQ will not look up a Kenyan company by phone. Name the company, paste a public website, or sign up and add a CR12 you provide.",
    };
  }

  if (looksLikeRegistration(raw)) {
    return {
      kind: "blocked",
      error:
        "A registration number is not a public website. VERIQ does not scrape BRS or eCitizen. Name the company, or upload an official extract after signup.",
    };
  }

  if (/[a-zA-Z]{2,}/.test(raw)) {
    return { kind: "name", name: raw };
  }

  return {
    kind: "blocked",
    error: "Name the company, or paste a public website.",
  };
}
