import { safeFetch } from "@/lib/scan/safe-fetch";
import { stripToText } from "@/lib/scan/story";

export type IdentityMethod = "website" | "wikidata" | "hostname" | "search";

export type CompanyIdentity = {
  name: string;
  website: string;
  hostname: string;
  method: IdentityMethod;
  note: string;
  githubLogin: string | null;
  alternatives: string[];
};

const LEGAL_NOISE =
  /\b(limited|ltd|plc|llc|inc|incorporated|company|co|group|holdings|kenya|the|public)\b/gi;

const UA = { "user-agent": "VERIQ-Scan/0.1 (company-identity)" };

function tokens(name: string) {
  return name
    .toLowerCase()
    .replace(LEGAL_NOISE, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((part) => part.length >= 2);
}

function slugsFromName(name: string) {
  const parts = tokens(name);
  const compact = parts.join("");
  const hyphen = parts.join("-");
  const first = parts[0] ?? "";
  return [...new Set([compact, hyphen, first, `${compact}kenya`, `${hyphen}-kenya`])].filter(
    (slug) => slug.length >= 3 && slug.length <= 40,
  );
}

function nameScore(name: string, haystack: string) {
  const parts = tokens(name);
  if (!parts.length) return 0;
  const hay = haystack.toLowerCase();
  const hits = parts.filter((part) => hay.includes(part)).length;
  return hits / parts.length;
}

async function jsonFetch<T>(url: string, timeoutMs = 8000): Promise<T | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { headers: UA, signal: controller.signal });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function fromWikidata(name: string): Promise<string | null> {
  const search = await jsonFetch<{
    search?: { id: string; label?: string }[];
  }>(
    `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(name)}&language=en&limit=5&format=json`,
  );
  const ids = (search?.search ?? [])
    .filter((row) => nameScore(name, row.label ?? "") >= 0.5)
    .map((row) => row.id)
    .slice(0, 3);
  if (!ids.length && search?.search?.[0]?.id) ids.push(search.search[0].id);
  if (!ids.length) return null;

  const entities = await jsonFetch<{
    entities?: Record<
      string,
      { claims?: { P856?: { mainsnak?: { datavalue?: { value?: string } } }[] } }
    >;
  }>(
    `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${ids.join("|")}&props=claims&format=json`,
  );
  for (const id of ids) {
    const value = entities?.entities?.[id]?.claims?.P856?.[0]?.mainsnak?.datavalue?.value;
    if (typeof value === "string" && /^https?:\/\//i.test(value)) return value;
  }
  return null;
}

async function fromSearch(name: string): Promise<string[]> {
  const query = `${name} Kenya official website`;
  const fetched = await safeFetch(
    `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
    { timeoutMs: 7000, maxBytes: 80_000 },
  );
  if ("error" in fetched || !fetched.response.ok) return [];
  const html = await fetched.response.text().catch(() => "");
  const urls: string[] = [];
  for (const match of html.matchAll(/uddg=([^&"]+)/g)) {
    try {
      const target = decodeURIComponent(match[1]!);
      if (/^https?:\/\//i.test(target)) urls.push(target);
    } catch {
      // Ignore malformed redirects.
    }
  }
  for (const match of html.matchAll(/href="(https?:\/\/[^"]+)"/g)) {
    const href = match[1]!;
    if (/duckduckgo|youtube|facebook|linkedin|twitter|x\.com|wikipedia/i.test(href)) continue;
    urls.push(href);
  }
  return [...new Set(urls)].slice(0, 6);
}

async function probeWebsite(url: string, name: string) {
  const fetched = await safeFetch(url, { timeoutMs: 6000, maxBytes: 80_000 });
  if ("error" in fetched || !fetched.response.ok) return null;
  const html = (await fetched.response.text().catch(() => "")).slice(0, 80_000);
  const text = stripToText(html).slice(0, 4000);
  let hostname = "";
  try {
    hostname = new URL(fetched.url || url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, " ") ?? "";
  const hostScore = nameScore(name, hostname.replace(/\./g, " "));
  const pageScore = Math.max(nameScore(name, title), nameScore(name, text.slice(0, 800)));
  const score = hostScore * 0.55 + pageScore * 0.45;
  if (pageScore < 0.34 && hostScore < 0.5) return null;
  return {
    website: `https://${hostname}`,
    hostname,
    score,
  };
}

async function fromHostGuesses(name: string) {
  const slugs = slugsFromName(name).slice(0, 4);
  const tlds = [".co.ke", ".com", ".ke", ".org"];
  const guesses = slugs.flatMap((slug) => tlds.map((tld) => `https://${slug}${tld}/`)).slice(0, 10);
  const probed = await Promise.all(guesses.map((url) => probeWebsite(url, name)));
  return probed.filter((row): row is NonNullable<typeof row> => Boolean(row));
}

async function githubLoginFor(name: string, hostname: string) {
  const slug = slugsFromName(name)[0];
  if (!slug) return null;
  const payload = await jsonFetch<{
    items?: { login: string; type: string }[];
  }>(`https://api.github.com/search/users?q=${encodeURIComponent(slug)}+type:org&per_page=5`);
  const items = payload?.items ?? [];
  const hostStub = hostname.split(".")[0] ?? "";
  const match = items.find(
    (item) =>
      item.type === "Organization" &&
      (item.login.toLowerCase() === slug ||
        item.login.toLowerCase() === hostStub ||
        nameScore(name, item.login) >= 0.6),
  );
  return match?.login ?? null;
}

export async function resolveCompanyIdentity(
  name: string,
): Promise<{ identity: CompanyIdentity } | { error: string }> {
  const trimmed = name.trim();
  if (trimmed.length < 2) {
    return { error: "Enter a company name." };
  }

  const candidates: { website: string; hostname: string; score: number; method: IdentityMethod }[] =
    [];

  const wiki = await fromWikidata(trimmed);
  if (wiki) {
    const probed = await probeWebsite(wiki, trimmed);
    if (probed) {
      candidates.push({ ...probed, score: probed.score + 0.25, method: "wikidata" });
    }
  }

  const guessed = await fromHostGuesses(trimmed);
  for (const row of guessed) {
    candidates.push({ ...row, method: "hostname" });
  }

  if (candidates.length < 2) {
    const searched = await fromSearch(trimmed);
    for (const url of searched) {
      const probed = await probeWebsite(url, trimmed);
      if (probed) candidates.push({ ...probed, method: "search" });
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  const winner = candidates.find((row) => row.score >= 0.42) ?? candidates[0];
  if (!winner) {
    return {
      error:
        "VERIQ could not resolve a public website from that name. Paste the site, or upload a CR12 after signup. We do not scrape BRS or eCitizen.",
    };
  }

  const githubLogin = await githubLoginFor(trimmed, winner.hostname);
  const note =
    winner.method === "wikidata"
      ? "Official website taken from Wikidata (P856), then fetched. This is not a CR12 or BRS extract."
      : winner.method === "search"
        ? "Public web search pointed at this hostname, and the page used the company name. Identity is inferred — not a registry file."
        : "A public hostname matching the name answered, and the page used the name. This is not a company extract.";

  return {
    identity: {
      name: trimmed,
      website: winner.website,
      hostname: winner.hostname,
      method: winner.method,
      note,
      githubLogin,
      alternatives: [
        ...new Set(candidates.map((row) => row.hostname).filter((host) => host !== winner.hostname)),
      ].slice(0, 4),
    },
  };
}
