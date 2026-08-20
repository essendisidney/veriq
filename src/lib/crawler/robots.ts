import { safeFetch } from "@/lib/scan/safe-fetch";

export type RobotsPolicy = {
  fetched: boolean;
  disallows: string[];
  crawlDelayMs: number;
  sitemaps: string[];
};

export async function loadRobots(origin: string): Promise<RobotsPolicy> {
  const fetched = await safeFetch(new URL("/robots.txt", origin).toString(), {
    timeoutMs: 2500,
    maxBytes: 20_000,
  });
  if ("error" in fetched || !fetched.response.ok) {
    return { fetched: false, disallows: [], crawlDelayMs: 350, sitemaps: [] };
  }
  const text = await fetched.response.text().catch(() => "");
  const disallows: string[] = [];
  const sitemaps: string[] = [];
  let crawlDelayMs = 350;
  let applies = false;
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const [rawKey, ...rest] = trimmed.split(":");
    const key = (rawKey ?? "").trim().toLowerCase();
    const value = rest.join(":").trim();
    if (key === "user-agent") {
      applies = value === "*" || /veriq/i.test(value);
      continue;
    }
    if (key === "sitemap" && value) {
      sitemaps.push(value);
      continue;
    }
    if (!applies) continue;
    if (key === "disallow" && value) disallows.push(value);
    if (key === "crawl-delay") {
      const seconds = Number(value);
      if (Number.isFinite(seconds) && seconds > 0) {
        crawlDelayMs = Math.min(4_000, Math.max(350, Math.round(seconds * 1000)));
      }
    }
  }
  return { fetched: true, disallows, crawlDelayMs, sitemaps: sitemaps.slice(0, 3) };
}

export function robotsAllows(rules: RobotsPolicy, pathname: string) {
  for (const rule of rules.disallows) {
    if (rule === "/") return false;
    if (pathname.startsWith(rule)) return false;
  }
  return true;
}
