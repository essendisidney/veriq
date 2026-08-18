import { safeFetch } from "@/lib/scan/safe-fetch";

export type RobotsRules = {
  fetched: boolean;
  disallows: string[];
};

export async function loadRobots(origin: string): Promise<RobotsRules> {
  const fetched = await safeFetch(new URL("/robots.txt", origin).toString(), {
    timeoutMs: 2500,
    maxBytes: 20_000,
  });
  if ("error" in fetched || !fetched.response.ok) {
    return { fetched: false, disallows: [] };
  }
  const text = await fetched.response.text().catch(() => "");
  const disallows: string[] = [];
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
    if (applies && key === "disallow" && value) disallows.push(value);
  }
  return { fetched: true, disallows };
}

export function robotsAllows(rules: RobotsRules, pathname: string) {
  for (const rule of rules.disallows) {
    if (rule === "/") return false;
    if (pathname.startsWith(rule)) return false;
  }
  return true;
}
