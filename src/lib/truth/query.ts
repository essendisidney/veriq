export type PublicQuery =
  | { kind: "website"; website: string }
  | { kind: "blocked"; error: string };

function looksLikeDomain(value: string) {
  return /^[a-z0-9][a-z0-9.-]+\.[a-z]{2,}$/i.test(value) && !value.includes(" ");
}

export function resolvePublicQuery(input: string): PublicQuery {
  const raw = input.trim();
  if (!raw) return { kind: "blocked", error: "Enter a public website, or an email whose domain we can observe." };

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
        "VERIQ will not look up a Kenyan company by phone. Paste a public website, or sign up and add the company with a CR12 you provide.",
    };
  }

  return {
    kind: "blocked",
    error:
      "A company name or registration number is not a public website. VERIQ does not scrape BRS or eCitizen. Paste the website, or sign up and upload an official extract.",
  };
}
