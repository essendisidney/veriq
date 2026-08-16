import dns from "node:dns/promises";
import tls from "node:tls";
import { assertPublicHostname, isPrivateAddress } from "@/lib/webhooks/ssrf";
import { safeFetch, safeFetchOk } from "@/lib/scan/safe-fetch";

export type TlsInfo = {
  issuer: string | null;
  validFrom: string | null;
  validTo: string | null;
  daysRemaining: number | null;
  altNames: string[];
};

export type DnsInfo = {
  a: string[];
  aaaa: string[];
  mx: string[];
  ns: string[];
  txt: string[];
};

export type JoinedHostname = {
  hostname: string;
  join: string;
};

export type Exposure = {
  hostname: string;
  httpsRedirect: boolean | null;
  securityTxt: boolean;
  robotsTxt: boolean;
  spf: boolean;
  dmarc: boolean;
  dmarcPolicy: string | null;
  dns: DnsInfo;
  tls: TlsInfo | null;
  hostnames: string[];
  joined?: JoinedHostname[];
  posture: number;
};

const UA = "VERIQ-Scan/0.1 (corporate-risk-intelligence)";

function clamp(value: number, min = 12, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

export function registrableDomain(hostname: string) {
  const parts = hostname.toLowerCase().split(".").filter(Boolean);
  const second = new Set([
    "co",
    "or",
    "ac",
    "go",
    "ne",
    "sc",
    "me",
    "com",
    "net",
    "org",
    "gov",
    "edu",
  ]);
  if (parts.length >= 3 && second.has(parts[parts.length - 2]!)) {
    return parts.slice(-3).join(".");
  }
  return parts.slice(-2).join(".");
}

async function resolveSafe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

async function exists(url: string) {
  return safeFetchOk(url, 3500);
}

async function httpRedirectsToHttps(hostname: string) {
  const result = await safeFetch(`http://${hostname}/`, {
    method: "GET",
    timeoutMs: 3500,
  });
  if ("error" in result) return null;
  const location = result.response.headers.get("location") ?? "";
  if (result.response.status >= 300 && result.response.status < 400) {
    return location.startsWith("https://");
  }
  try {
    return new URL(result.url).protocol === "https:";
  } catch {
    return null;
  }
}

function readCertificate(hostname: string): Promise<TlsInfo | null> {
  return new Promise((resolve) => {
    const socket = tls.connect(
      {
        host: hostname,
        port: 443,
        servername: hostname,
        timeout: 8000,
        rejectUnauthorized: false,
      },
      () => {
        const cert = socket.getPeerCertificate();
        socket.end();
        if (!cert || Object.keys(cert).length === 0) {
          resolve(null);
          return;
        }
        const validTo = cert.valid_to ? new Date(cert.valid_to) : null;
        const daysRemaining = validTo
          ? Math.ceil((validTo.getTime() - Date.now()) / 86_400_000)
          : null;
        const altNames = String(cert.subjectaltname ?? "")
          .split(",")
          .map((part) => part.replace(/^DNS:/i, "").trim())
          .filter(Boolean);
        const issuerValue = cert.issuer?.O ?? cert.issuer?.CN ?? null;
        const issuer = Array.isArray(issuerValue)
          ? issuerValue.join(", ")
          : issuerValue;
        resolve({
          issuer,
          validFrom: cert.valid_from ? new Date(cert.valid_from).toISOString() : null,
          validTo: validTo ? validTo.toISOString() : null,
          daysRemaining,
          altNames,
        });
      },
    );
    socket.on("error", () => resolve(null));
    socket.on("timeout", () => {
      socket.destroy();
      resolve(null);
    });
  });
}

async function publicHostnames(hostname: string) {
  const root = registrableDomain(hostname);
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const response = await fetch(
      `https://crt.sh/?q=${encodeURIComponent(root)}&output=json`,
      { signal: controller.signal, headers: { "user-agent": UA } },
    );
    clearTimeout(timeout);
    if (!response.ok) return [hostname];
    const payload = (await response.json()) as { name_value?: string }[];
    const names = new Set<string>();
    for (const row of payload.slice(0, 200)) {
      for (const name of String(row.name_value ?? "").split("\n")) {
        const host = name.trim().toLowerCase().replace(/^\*\./, "");
        if (!host || host.includes(" ")) continue;
        if (host === root || host.endsWith(`.${root}`)) names.add(host);
      }
    }
    names.add(hostname.toLowerCase());
    return [...names].sort().slice(0, 25);
  } catch {
    return [hostname];
  }
}

function dmarcPolicy(records: string[]) {
  const record = records.find((item) => item.toLowerCase().startsWith("v=dmarc1"));
  if (!record) return null;
  const match = record.match(/\bp=([a-z]+)/i);
  return match?.[1]?.toLowerCase() ?? "none";
}

export function scoreExposure(exposure: Omit<Exposure, "posture">) {
  let score = 90;
  if (exposure.httpsRedirect === false) score -= 10;
  if (!exposure.spf) score -= 8;
  if (!exposure.dmarc) score -= 12;
  else if (exposure.dmarcPolicy === "none") score -= 6;
  if (!exposure.tls) score -= 14;
  else if (exposure.tls.daysRemaining !== null) {
    if (exposure.tls.daysRemaining < 0) score -= 24;
    else if (exposure.tls.daysRemaining < 14) score -= 16;
    else if (exposure.tls.daysRemaining < 30) score -= 8;
  }
  if ((exposure.joined?.length ?? 0) > 6) score -= 5;
  if (!exposure.securityTxt) score -= 2;
  return clamp(score);
}

export async function scanExposure(hostname: string): Promise<Exposure> {
  const allowed = await assertPublicHostname(hostname);
  if ("error" in allowed) {
    const blocked = {
      hostname,
      httpsRedirect: null,
      securityTxt: false,
      robotsTxt: false,
      spf: false,
      dmarc: false,
      dmarcPolicy: null,
      dns: { a: [] as string[], aaaa: [] as string[], mx: [] as string[], ns: [] as string[], txt: [] as string[] },
      tls: null,
      hostnames: [hostname],
      joined: [] as JoinedHostname[],
    };
    return { ...blocked, posture: scoreExposure(blocked) };
  }

  const [a, aaaa, mx, ns, txt, dmarcTxt, tlsInfo, httpsRedirect, securityTxt, robotsTxt, hostnames] =
    await Promise.all([
      resolveSafe(() => dns.resolve4(hostname), [] as string[]),
      resolveSafe(() => dns.resolve6(hostname), [] as string[]),
      resolveSafe(
        async () => (await dns.resolveMx(hostname)).map((item) => item.exchange),
        [] as string[],
      ),
      resolveSafe(() => dns.resolveNs(hostname), [] as string[]),
      resolveSafe(
        async () => (await dns.resolveTxt(hostname)).map((item) => item.join("")),
        [] as string[],
      ),
      resolveSafe(
        async () =>
          (await dns.resolveTxt(`_dmarc.${hostname}`)).map((item) => item.join("")),
        [] as string[],
      ),
      readCertificate(hostname),
      httpRedirectsToHttps(hostname),
      exists(`https://${hostname}/.well-known/security.txt`),
      exists(`https://${hostname}/robots.txt`),
      publicHostnames(hostname),
    ]);

  const spf = txt.some((item) => item.toLowerCase().startsWith("v=spf1"));
  const policy = dmarcPolicy(dmarcTxt);
  const base = {
    hostname,
    httpsRedirect,
    securityTxt,
    robotsTxt,
    spf,
    dmarc: Boolean(policy),
    dmarcPolicy: policy,
    dns: {
      a: a.filter((ip) => !isPrivateAddress(ip)),
      aaaa: aaaa.filter((ip) => !isPrivateAddress(ip)),
      mx,
      ns,
      txt: txt.slice(0, 8),
    },
    tls: tlsInfo,
    hostnames,
    joined: [] as JoinedHostname[],
  };

  return { ...base, posture: scoreExposure(base) };
}

const SURFACE_LABELS = new Set([
  "mail",
  "smtp",
  "imap",
  "pop",
  "vpn",
  "remote",
  "citrix",
  "owa",
  "autodiscover",
  "staging",
  "stage",
  "dev",
  "test",
  "uat",
  "qa",
  "api",
  "app",
  "admin",
  "portal",
  "sso",
  "auth",
  "login",
  "idp",
  "pay",
  "checkout",
  "billing",
  "payments",
  "git",
  "gitlab",
  "github",
  "jenkins",
  "ci",
  "grafana",
  "kibana",
  "sentry",
  "vault",
  "cdn",
  "static",
  "assets",
  "media",
]);

export function joinPublicHostnames(input: {
  root: string;
  hostnames: string[];
  mx?: string[];
  vendorNames?: string[];
}): JoinedHostname[] {
  const root = registrableDomain(input.root);
  const apex = input.root.toLowerCase();
  const mxHosts = (input.mx ?? []).map((item) =>
    item.toLowerCase().replace(/\.$/, ""),
  );
  const vendorNeedles = (input.vendorNames ?? [])
    .map((name) => name.toLowerCase().replace(/[^a-z0-9]+/g, ""))
    .filter((name) => name.length >= 4);
  const seen = new Set<string>();
  const out: JoinedHostname[] = [];

  for (const raw of input.hostnames) {
    const host = raw.toLowerCase().replace(/\.$/, "");
    if (seen.has(host)) continue;
    if (host === apex || host === root || host === `www.${root}`) continue;

    const labels = host.endsWith(`.${root}`)
      ? host.slice(0, -(root.length + 1)).split(".")
      : host.split(".");
    const first = labels[0] ?? "";
    let join: string | null = null;

    if (SURFACE_LABELS.has(first)) {
      join = `${first} operational surface`;
    } else if (
      mxHosts.some(
        (mx) => mx === host || mx.endsWith(`.${host}`) || host.endsWith(`.${mx}`),
      )
    ) {
      join = "MX / mail cousin";
    } else {
      const vendor = vendorNeedles.find((needle) =>
        host.replace(/[^a-z0-9]+/g, "").includes(needle),
      );
      if (vendor) join = `vendor ${vendor}`;
    }

    if (!join) continue;
    seen.add(host);
    out.push({ hostname: host, join });
    if (out.length >= 12) break;
  }

  return out;
}

export function withJoinedHostnames(
  exposure: Exposure,
  vendorNames: string[] = [],
): Exposure {
  const joined = joinPublicHostnames({
    root: exposure.hostname,
    hostnames: exposure.hostnames,
    mx: exposure.dns.mx,
    vendorNames,
  });
  const next = { ...exposure, joined };
  return { ...next, posture: scoreExposure(next) };
}
