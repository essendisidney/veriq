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
const PROBE_MS = 2800;
const JSON_MS = 2800;

type Candidate = {
  website: string;
  hostname: string;
  score: number;
  method: IdentityMethod;
};

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
  return [...new Set([compact, hyphen, first])].filter(
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

async function jsonFetch<T>(url: string, timeoutMs = JSON_MS): Promise<T | null> {
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
    `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(name)}&language=en&limit=3&format=json`,
  );
  const id =
    (search?.search ?? []).find((row) => nameScore(name, row.label ?? "") >= 0.5)?.id ??
    search?.search?.[0]?.id;
  if (!id) return null;

  const entities = await jsonFetch<{
    entities?: Record<
      string,
      { claims?: { P856?: { mainsnak?: { datavalue?: { value?: string } } }[] } }
    >;
  }>(
    `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${id}&props=claims&format=json`,
  );
  const value = entities?.entities?.[id]?.claims?.P856?.[0]?.mainsnak?.datavalue?.value;
  return typeof value === "string" && /^https?:\/\//i.test(value) ? value : null;
}

async function probeWebsite(url: string, name: string): Promise<Candidate | null> {
  const fetched = await safeFetch(url, { timeoutMs: PROBE_MS, maxBytes: 40_000 });
  if ("error" in fetched || !fetched.response.ok) return null;
  const html = (await fetched.response.text().catch(() => "")).slice(0, 40_000);
  let hostname = "";
  try {
    hostname = new URL(fetched.url || url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, " ") ?? "";
  const text = stripToText(html).slice(0, 800);
  const hostScore = nameScore(name, hostname.replace(/\./g, " "));
  const pageScore = Math.max(nameScore(name, title), nameScore(name, text));
  const score = hostScore * 0.55 + pageScore * 0.45;
  if (pageScore < 0.34 && hostScore < 0.5) return null;
  return {
    website: `https://${hostname}`,
    hostname,
    score,
    method: "hostname",
  };
}

async function fromHostGuesses(name: string) {
  const slugs = slugsFromName(name).slice(0, 2);
  const guesses = slugs.flatMap((slug) => [`https://${slug}.co.ke/`, `https://${slug}.com/`]);
  const probed = await Promise.all(guesses.map((url) => probeWebsite(url, name)));
  return probed.filter((row): row is Candidate => Boolean(row));
}

async function fromWikidataProbed(name: string): Promise<Candidate | null> {
  const wiki = await fromWikidata(name);
  if (!wiki) return null;
  const probed = await probeWebsite(wiki, name);
  if (!probed) return null;
  return { ...probed, score: probed.score + 0.25, method: "wikidata" };
}

function pickWinner(candidates: Candidate[]) {
  const ranked = [...candidates].sort((a, b) => b.score - a.score);
  return ranked.find((row) => row.score >= 0.42) ?? ranked[0] ?? null;
}

export async function resolveCompanyIdentity(
  name: string,
): Promise<{ identity: CompanyIdentity } | { error: string }> {
  const trimmed = name.trim();
  if (trimmed.length < 2) {
    return { error: "Enter a company name." };
  }

  const guessed = await fromHostGuesses(trimmed);
  const candidates: Candidate[] = [...guessed];
  const hostWinner = pickWinner(guessed);

  if (!hostWinner || hostWinner.score < 0.55) {
    const wiki = await fromWikidataProbed(trimmed);
    if (wiki) candidates.push(wiki);
  }

  const winner = pickWinner(candidates);
  if (!winner) {
    return {
      error:
        "VERIQ could not resolve a public website from that name quickly. Paste the site URL. We do not scrape BRS or eCitizen.",
    };
  }

  const note =
    winner.method === "wikidata"
      ? "Official website taken from Wikidata (P856), then fetched. This is not a CR12 or BRS extract."
      : "A public hostname matching the name answered, and the page used the name. This is not a company extract.";

  return {
    identity: {
      name: trimmed,
      website: winner.website,
      hostname: winner.hostname,
      method: winner.method,
      note,
      githubLogin: null,
      alternatives: [
        ...new Set(candidates.map((row) => row.hostname).filter((host) => host !== winner.hostname)),
      ].slice(0, 4),
    },
  };
}
