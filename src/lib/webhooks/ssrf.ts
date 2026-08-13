import { isIP } from "node:net";
import { lookup } from "node:dns/promises";

const BLOCKED_HOSTS = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata.google.com",
  "kubernetes.default",
  "kubernetes.default.svc",
]);

export function parseWebhookUrl(raw: string): URL | { error: string } {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return { error: "URL is not valid" };
  }
  if (url.protocol !== "https:") {
    return { error: "Webhooks must use HTTPS" };
  }
  if (url.username || url.password) {
    return { error: "URL must not contain credentials" };
  }
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!host) return { error: "Host is required" };
  if (BLOCKED_HOSTS.has(host) || host.endsWith(".localhost") || host.endsWith(".local")) {
    return { error: "That host is not allowed" };
  }
  if (host === "0.0.0.0" || host.startsWith("127.") || host === "::1") {
    return { error: "That host is not allowed" };
  }
  if (isIP(host) && isPrivateAddress(host)) {
    return { error: "Private and link-local addresses are not allowed" };
  }
  return url;
}

export async function assertPublicHttpsUrl(raw: string): Promise<{ url: URL } | { error: string }> {
  const parsed = parseWebhookUrl(raw);
  if ("error" in parsed) return parsed;
  return assertResolvedPublic(parsed);
}

export async function assertPublicScanUrl(
  raw: string,
): Promise<{ url: URL } | { error: string }> {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return { error: "URL is not valid" };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { error: "Only HTTP and HTTPS targets can be scanned" };
  }
  if (url.username || url.password) {
    return { error: "URL must not contain credentials" };
  }
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!host) return { error: "Host is required" };
  if (BLOCKED_HOSTS.has(host) || host.endsWith(".localhost") || host.endsWith(".local")) {
    return { error: "That host is not allowed" };
  }
  if (isIP(host) && isPrivateAddress(host)) {
    return { error: "Private and link-local addresses are not allowed" };
  }
  return assertResolvedPublic(url);
}

export async function assertPublicHostname(
  hostname: string,
): Promise<{ ok: true } | { error: string }> {
  const host = hostname.trim().toLowerCase().replace(/\.$/, "");
  if (!host) return { error: "Host is required" };
  if (host.includes("/") || host.includes(":") || host.includes(" ")) {
    return { error: "Host is not valid" };
  }
  const checked = await assertPublicScanUrl(`https://${host}/`);
  if ("error" in checked) return checked;
  return { ok: true };
}

async function assertResolvedPublic(url: URL): Promise<{ url: URL } | { error: string }> {
  const records = await lookup(url.hostname, { all: true }).catch(() => null);
  if (!records?.length) return { error: "Host could not be resolved" };
  for (const row of records) {
    if (isPrivateAddress(row.address)) {
      return { error: "Host resolves to a private or link-local address" };
    }
  }
  return { url };
}

export function isPrivateAddress(ip: string): boolean {
  if (ip.includes(":")) return isPrivateV6(ip);
  const parts = ip.split(".").map((item) => Number(item));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true;
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a >= 224) return true;
  return false;
}

function isPrivateV6(ip: string): boolean {
  const value = ip.toLowerCase();
  if (value === "::" || value === "::1" || value === "0:0:0:0:0:0:0:1") return true;
  if (value.startsWith("fc") || value.startsWith("fd")) return true;
  if (value.startsWith("fe80")) return true;
  if (value.startsWith("ff")) return true;
  if (value.startsWith("::ffff:")) {
    const v4 = value.slice("::ffff:".length);
    if (isIP(v4) === 4) return isPrivateAddress(v4);
  }
  return false;
}
