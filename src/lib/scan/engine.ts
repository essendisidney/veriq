import type { ActionPriority, Severity, TrustStatus } from "@/lib/database.types";
import type { Exposure } from "@/lib/scan/exposure";
import type { RegulationAssessment } from "@/lib/regulations/assess";
import type { VendorMap } from "@/lib/vendors/assess";
import type { FinanceAssessment } from "@/lib/finance/assess";
import type { AiAssessment } from "@/lib/ai/assess";
import type { WorldAssessment } from "@/lib/world/assess";
import { certaintyFor, type Certainty } from "@/lib/risk/certainty";
import { safeFetch } from "@/lib/scan/safe-fetch";

export type DraftRisk = {
  fingerprint: string;
  title: string;
  description: string;
  category: string;
  severity: Severity;
  likelihood: number;
  impact: number;
  confidence: number;
  certainty?: Certainty;
  why_it_matters: string;
  recommendation: string;
  owner_role: string;
  evidence: {
    source_type: string;
    source_reference?: string;
    content: string;
    confidence: number;
    trust_status: TrustStatus;
  }[];
  action?: {
    title: string;
    owner_role: string;
    priority: ActionPriority;
  };
};

export type WebsiteScan = {
  hostname: string;
  url: string;
  https: boolean;
  statusCode: number | null;
  reachable: boolean;
  securityHeaders: Record<string, string | null>;
  responseHeaders: Record<string, string | null>;
  html: string;
  technologies: string[];
  error?: string;
};

export type GithubRepoScan = {
  id: number;
  name: string;
  fullName: string;
  url: string;
  visibility: string;
  defaultBranch: string | null;
  language: string | null;
  description: string | null;
  stars: number;
  hasLicense: boolean;
  sensitiveFiles: string[];
  hasGitignore: boolean;
  hasPackageJson: boolean;
  packages: string[];
};

export type GithubScan = {
  login: string;
  kind: "User" | "Organization" | "unknown";
  publicRepos: number;
  repos: GithubRepoScan[];
  packages: string[];
  error?: string;
};

const HEADER_KEYS = [
  "strict-transport-security",
  "content-security-policy",
  "x-frame-options",
  "x-content-type-options",
  "referrer-policy",
  "permissions-policy",
] as const;

const SENSITIVE_PATHS = [".env", "credentials.json"];
const GITHUB_HEADERS = {
  accept: "application/vnd.github+json",
  "user-agent": "VERIQ-Scan/0.1",
  "x-github-api-version": "2022-11-28",
} as const;

export function normalizeGithubLogin(input: string) {
  const handle = input.trim().replace(/^@/, "");
  if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/.test(handle)) {
    return null;
  }
  if (handle.includes("--")) return null;
  return handle;
}

function normalizeUrl(input: string) {
  const trimmed = input.trim();
  if (!trimmed) return null;
  try {
    const withProtocol = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;
    const url = new URL(withProtocol);
    return url;
  } catch {
    return null;
  }
}

function detectTechnologies(html: string, headers: Headers) {
  const tech = new Set<string>();
  const server = headers.get("server");
  const powered = headers.get("x-powered-by");
  const generator = headers.get("x-generator");
  if (server) tech.add(server.split("/")[0]!);
  if (powered) tech.add(powered.split("/")[0]!);
  if (generator) tech.add(generator);
  if (html.includes("__NEXT_DATA__") || html.includes("_next/static"))
    tech.add("Next.js");
  if (html.includes("wp-content") || html.includes("wordpress"))
    tech.add("WordPress");
  if (html.includes("cdn.shopify.com")) tech.add("Shopify");
  if (html.includes("react") || html.includes("data-reactroot"))
    tech.add("React");
  if (html.includes("vercel")) tech.add("Vercel");
  if (html.includes("cloudflare")) tech.add("Cloudflare");
  if (headers.get("cf-ray")) tech.add("Cloudflare");
  if (headers.get("x-vercel-id") || headers.get("x-vercel-cache"))
    tech.add("Vercel");
  return [...tech];
}

function unreachableWebsite(
  parsed: URL,
  url: string,
  https: boolean,
  error: string,
): WebsiteScan {
  return {
    hostname: parsed.hostname,
    url,
    https,
    statusCode: null,
    reachable: false,
    securityHeaders: {},
    responseHeaders: {},
    html: "",
    technologies: [],
    error,
  };
}

export async function scanWebsite(website: string): Promise<WebsiteScan | null> {
  const parsed = normalizeUrl(website);
  if (!parsed) return null;

  const url = parsed.toString();
  const https = parsed.protocol === "https:";
  const fetched = await safeFetch(url, { timeoutMs: 12000, maxBytes: 500_000 });
  if ("error" in fetched) {
    return unreachableWebsite(parsed, url, https, fetched.error);
  }

  try {
    const { response } = fetched;
    const html = (await response.text().catch(() => "")).slice(0, 80_000);
    const securityHeaders: Record<string, string | null> = {};
    for (const key of HEADER_KEYS) {
      securityHeaders[key] = response.headers.get(key);
    }
    const extraHeaderKeys = [
      "server",
      "x-powered-by",
      "cf-ray",
      "x-vercel-id",
      "x-vercel-cache",
      "x-nf-request-id",
      "x-amz-cf-id",
      "x-amz-request-id",
    ];
    const responseHeaders: Record<string, string | null> = { ...securityHeaders };
    for (const key of extraHeaderKeys) {
      responseHeaders[key] = response.headers.get(key);
    }
    const finalUrl = fetched.url || url;

    return {
      hostname: parsed.hostname,
      url: finalUrl,
      https: new URL(finalUrl).protocol === "https:" && https,
      statusCode: response.status,
      reachable: response.ok || response.status < 500,
      securityHeaders,
      responseHeaders,
      html,
      technologies: detectTechnologies(html, response.headers),
    };
  } catch (error) {
    return unreachableWebsite(
      parsed,
      url,
      https,
      error instanceof Error ? error.message : "Website unreachable",
    );
  }
}

async function githubFetch(
  path: string,
  opts?: { accept?: string; token?: string },
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    return await fetch(`https://api.github.com${path}`, {
      headers: {
        ...GITHUB_HEADERS,
        ...(opts?.accept ? { accept: opts.accept } : {}),
        ...(opts?.token ? { authorization: `Bearer ${opts.token}` } : {}),
      },
      signal: controller.signal,
      next: { revalidate: 0 },
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function githubJson<T>(path: string, token?: string): Promise<T | null> {
  const response = await githubFetch(path, { token });
  if (!response?.ok) return null;
  return (await response.json()) as T;
}

async function githubPackageNames(
  fullName: string,
  token?: string,
): Promise<{ exists: boolean; names: string[] }> {
  const response = await githubFetch(
    `/repos/${fullName}/contents/package.json`,
    { accept: "application/vnd.github.raw+json", token },
  );
  if (!response?.ok) return { exists: false, names: [] };
  try {
    const pkg = (await response.json()) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    return {
      exists: true,
      names: [
        ...Object.keys(pkg.dependencies ?? {}),
        ...Object.keys(pkg.devDependencies ?? {}),
      ],
    };
  } catch {
    return { exists: true, names: [] };
  }
}

async function githubExists(fullName: string, filePath: string, token?: string) {
  const response = await githubFetch(`/repos/${fullName}/contents/${filePath}`, {
    token,
  });
  return response?.status === 200;
}

type GithubUser = {
  login: string;
  type: "User" | "Organization";
  public_repos: number;
};

type GithubRepo = {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  private: boolean;
  default_branch: string;
  language: string | null;
  description: string | null;
  stargazers_count: number;
  license: { spdx_id: string } | null;
};

export async function scanGithub(
  login: string,
  token?: string,
): Promise<GithubScan | null> {
  const handle = normalizeGithubLogin(login);
  if (!handle) {
    return {
      login: login.trim().replace(/^@/, "") || "unknown",
      kind: "unknown",
      publicRepos: 0,
      repos: [],
      packages: [],
      error: "GitHub login is not a valid username or organisation",
    };
  }

  const user = await githubJson<GithubUser>(`/users/${handle}`, token);
  if (!user) {
    return {
      login: handle,
      kind: "unknown",
      publicRepos: 0,
      repos: [],
      packages: [],
      error: "GitHub account not found or not publicly reachable",
    };
  }

  const perPage = token ? 30 : 8;
  const scanLimit = token ? 12 : 5;
  const repos =
    (await githubJson<GithubRepo[]>(
      `/users/${handle}/repos?per_page=${perPage}&sort=updated&type=owner`,
      token,
    )) ?? [];

  const scanned = await Promise.all(
    repos.slice(0, scanLimit).map(async (repo) => {
      const [sensitiveHits, hasGitignore, pkg] = await Promise.all([
        Promise.all(
          SENSITIVE_PATHS.map(async (file) =>
            (await githubExists(repo.full_name, file, token)) ? file : null,
          ),
        ),
        githubExists(repo.full_name, ".gitignore", token),
        githubPackageNames(repo.full_name, token),
      ]);

      return {
        id: repo.id,
        name: repo.name,
        fullName: repo.full_name,
        url: repo.html_url,
        visibility: repo.private ? "private" : "public",
        defaultBranch: repo.default_branch,
        language: repo.language,
        description: repo.description,
        stars: repo.stargazers_count,
        hasLicense: Boolean(repo.license),
        sensitiveFiles: sensitiveHits.filter((file): file is string =>
          Boolean(file),
        ),
        hasGitignore,
        hasPackageJson: pkg.exists,
        packages: pkg.names,
      };
    }),
  );

  return {
    login: user.login,
    kind: user.type,
    publicRepos: user.public_repos,
    repos: scanned,
    packages: [...new Set(scanned.flatMap((repo) => repo.packages))],
  };
}

export function buildRisks(input: {
  website: WebsiteScan | null;
  github: GithubScan | null;
  exposure: Exposure | null;
  assessments: RegulationAssessment[];
  vendors: VendorMap | null;
  finance: FinanceAssessment | null;
  ai: AiAssessment | null;
  world: WorldAssessment | null;
  country: string;
  industry: string;
}): DraftRisk[] {
  const risks: DraftRisk[] = [];

  if (input.website) {
    if (!input.website.reachable) {
      risks.push({
        fingerprint: `web:unreachable:${input.website.hostname}`,
        title: "Primary website is unreachable",
        description: `The company website ${input.website.hostname} did not respond during this scan.`,
        category: "technology",
        severity: "high",
        likelihood: 70,
        impact: 70,
        confidence: 90,
        why_it_matters:
          "Customers, partners and attackers all observe availability. An unreachable site can indicate outage, misconfiguration or abandoned infrastructure.",
        recommendation:
          "Confirm DNS, TLS and hosting health. If the domain is unused, retire it to reduce impersonation risk.",
        owner_role: "Engineering",
        evidence: [
          {
            source_type: "website",
            source_reference: input.website.url,
            content: input.website.error ?? "No HTTP response within timeout",
            confidence: 90,
            trust_status: "observed",
          },
        ],
        action: {
          title: "Restore or retire the primary domain",
          owner_role: "Engineering",
          priority: "high",
        },
      });
    } else {
      if (!input.website.https) {
        risks.push({
          fingerprint: `web:no-https:${input.website.hostname}`,
          title: "Website is not served over HTTPS",
          description: `${input.website.hostname} was reached without transport encryption.`,
          category: "cybersecurity",
          severity: "critical",
          likelihood: 80,
          impact: 85,
          confidence: 95,
          why_it_matters:
            "Unencrypted traffic can be intercepted. Browsers also mark the site as insecure, damaging trust.",
          recommendation:
            "Terminate TLS on the primary domain, redirect HTTP to HTTPS, and enable HSTS.",
          owner_role: "Engineering",
          evidence: [
            {
              source_type: "website",
              source_reference: input.website.url,
              content: "Site was fetched without HTTPS",
              confidence: 95,
              trust_status: "observed",
            },
          ],
          action: {
            title: "Enable HTTPS and redirect all HTTP traffic",
            owner_role: "Engineering",
            priority: "critical",
          },
        });
      }

      const missing = HEADER_KEYS.filter(
        (key) => !input.website!.securityHeaders[key],
      );
      if (missing.length >= 3) {
        risks.push({
          fingerprint: `web:headers:${input.website.hostname}`,
          title: "Missing browser security headers",
          description: `${input.website.hostname} is missing ${missing.length} standard security headers.`,
          category: "cybersecurity",
          severity: missing.includes("strict-transport-security")
            ? "medium"
            : "low",
          likelihood: 60,
          impact: 55,
          confidence: 92,
          why_it_matters:
            "Security headers reduce clickjacking, MIME sniffing and protocol downgrade risk. Their absence is a common control gap in audits.",
          recommendation:
            "Add HSTS, CSP, X-Frame-Options, X-Content-Type-Options and Referrer-Policy at the edge or application layer.",
          owner_role: "Engineering",
          evidence: [
            {
              source_type: "website",
              source_reference: input.website.url,
              content: `Missing headers: ${missing.join(", ")}`,
              confidence: 92,
              trust_status: "observed",
            },
          ],
          action: {
            title: "Deploy standard HTTP security headers",
            owner_role: "Engineering",
            priority: "medium",
          },
        });
      }
    }
  }

  if (input.exposure) {
    const { hostname, tls, httpsRedirect, spf, dmarc, dmarcPolicy, hostnames } =
      input.exposure;

    if (tls?.daysRemaining !== null && tls && tls.daysRemaining < 21) {
      const expired = tls.daysRemaining < 0;
      risks.push({
        fingerprint: `tls:expiry:${hostname}`,
        title: expired
          ? "TLS certificate has expired"
          : "TLS certificate expires soon",
        description: expired
          ? `The certificate for ${hostname} expired ${Math.abs(tls.daysRemaining)} days ago.`
          : `The certificate for ${hostname} expires in ${tls.daysRemaining} days.`,
        category: "cybersecurity",
        severity: expired || tls.daysRemaining < 7 ? "critical" : "high",
        likelihood: 85,
        impact: 80,
        confidence: 96,
        why_it_matters:
          "Expired or soon-to-expire certificates cause outages, browser warnings and lost customer trust. They are also a common operational-risk finding for boards.",
        recommendation:
          "Renew the certificate, enable auto-renewal, and monitor expiry with at least 30 days of lead time.",
        owner_role: "Engineering",
        evidence: [
          {
            source_type: "tls",
            source_reference: hostname,
            content: `Issuer: ${tls.issuer ?? "unknown"}. Valid to: ${tls.validTo ?? "unknown"}.`,
            confidence: 96,
            trust_status: "observed",
          },
        ],
        action: {
          title: `Renew TLS for ${hostname}`,
          owner_role: "Engineering",
          priority: expired ? "critical" : "high",
        },
      });
    }

    if (httpsRedirect === false) {
      risks.push({
        fingerprint: `web:http-redirect:${hostname}`,
        title: "HTTP does not redirect to HTTPS",
        description: `${hostname} still answers on HTTP without sending visitors to HTTPS.`,
        category: "cybersecurity",
        severity: "high",
        likelihood: 70,
        impact: 70,
        confidence: 90,
        why_it_matters:
          "Users and integrations that type the domain without https:// can be served an unencrypted first hop.",
        recommendation:
          "Redirect all HTTP requests to HTTPS at the edge, then enable HSTS.",
        owner_role: "Engineering",
        evidence: [
          {
            source_type: "website",
            source_reference: `http://${hostname}/`,
            content: "HTTP response did not redirect to an https:// location",
            confidence: 90,
            trust_status: "observed",
          },
        ],
        action: {
          title: "Force HTTPS redirects on the primary domain",
          owner_role: "Engineering",
          priority: "high",
        },
      });
    }

    if (!spf || !dmarc) {
      risks.push({
        fingerprint: `dns:email-auth:${hostname}`,
        title: "Email authentication records are incomplete",
        description: `${hostname} is missing ${[
          !spf ? "SPF" : null,
          !dmarc ? "DMARC" : null,
        ]
          .filter(Boolean)
          .join(" and ")}.`,
        category: "cybersecurity",
        severity: !dmarc ? "medium" : "low",
        likelihood: 65,
        impact: 60,
        confidence: 88,
        why_it_matters:
          "Without SPF and DMARC, the domain can be spoofed. That becomes a fraud, brand and customer-trust risk — not only an IT issue.",
        recommendation:
          "Publish an SPF record and a DMARC policy (start with p=quarantine, then p=reject).",
        owner_role: "Engineering",
        evidence: [
          {
            source_type: "dns",
            source_reference: hostname,
            content: `SPF=${spf ? "present" : "missing"}; DMARC=${dmarc ? `present (${dmarcPolicy})` : "missing"}`,
            confidence: 88,
            trust_status: "observed",
          },
        ],
        action: {
          title: "Publish SPF and DMARC for the company domain",
          owner_role: "Engineering",
          priority: "medium",
        },
      });
    } else if (dmarcPolicy === "none") {
      risks.push({
        fingerprint: `dns:dmarc-none:${hostname}`,
        title: "DMARC policy is monitor-only",
        description: `${hostname} has DMARC with p=none, so spoofed mail is not quarantined or rejected.`,
        category: "cybersecurity",
        severity: "low",
        likelihood: 55,
        impact: 50,
        confidence: 86,
        why_it_matters:
          "A none policy is useful while monitoring. It does not protect customers from lookalike mail.",
        recommendation:
          "Move DMARC from p=none to p=quarantine, then p=reject, once legitimate sources are aligned.",
        owner_role: "Engineering",
        evidence: [
          {
            source_type: "dns",
            source_reference: `_dmarc.${hostname}`,
            content: "DMARC policy observed: p=none",
            confidence: 86,
            trust_status: "observed",
          },
        ],
      });
    }

    if (hostnames.length > 8) {
      risks.push({
        fingerprint: `ct:surface:${hostname}`,
        title: "Broad public hostname surface",
        description: `Certificate transparency lists ${hostnames.length} hostnames under this domain.`,
        category: "technology",
        severity: "informational",
        likelihood: 40,
        impact: 45,
        confidence: 80,
        why_it_matters:
          "Every public hostname is part of the attack surface. Forgotten staging or dev names often linger in certificates.",
        recommendation:
          "Review the hostname list, retire unused names, and keep development endpoints off the public internet.",
        owner_role: "Engineering",
        evidence: [
          {
            source_type: "certificate-transparency",
            source_reference: hostname,
            content: `Observed hostnames: ${hostnames.slice(0, 15).join(", ")}`,
            confidence: 80,
            trust_status: "observed",
          },
        ],
      });
    }
  }

  if (input.github) {
    if (input.github.error) {
      risks.push({
        fingerprint: `github:missing:${input.github.login}`,
        title: "GitHub account could not be verified",
        description: `No public GitHub profile was found for ${input.github.login}.`,
        category: "technology",
        severity: "informational",
        likelihood: 40,
        impact: 30,
        confidence: 70,
        why_it_matters:
          "Without a verified source repository, VERIQ cannot observe code, secrets or dependency risk.",
        recommendation:
          "Confirm the GitHub organisation name, or connect a readable integration in a later scan.",
        owner_role: "Engineering",
        evidence: [
          {
            source_type: "github",
            source_reference: input.github.login,
            content: input.github.error,
            confidence: 70,
            trust_status: "observed",
          },
        ],
      });
    } else {
      const exposed = input.github.repos.filter((r) => r.sensitiveFiles.length);
      for (const repo of exposed) {
        risks.push({
          fingerprint: `github:sensitive:${repo.fullName}`,
          title: `Potentially sensitive file in public repository ${repo.name}`,
          description: `Public repository ${repo.fullName} contains file(s) that often hold secrets: ${repo.sensitiveFiles.join(", ")}. Contents were not stored.`,
          category: "cybersecurity",
          severity: "critical",
          likelihood: 85,
          impact: 95,
          confidence: 88,
          why_it_matters:
            "Credential material in a public repository is one of the fastest paths to unauthorised access. VERIQ records the path only — not the secret.",
          recommendation:
            "Remove the file from git history, rotate any credentials that may have been present, and add the path to .gitignore.",
          owner_role: "Engineering",
          evidence: [
            {
              source_type: "github",
              source_reference: `${repo.url}`,
              content: `Public file path(s) observed: ${repo.sensitiveFiles.join(", ")}. Secret values were not retrieved or stored.`,
              confidence: 88,
              trust_status: "observed",
            },
          ],
          action: {
            title: `Review and rotate credentials related to ${repo.name}`,
            owner_role: "Engineering",
            priority: "critical",
          },
        });
      }

      const unlicensed = input.github.repos.filter((r) => !r.hasLicense);
      if (unlicensed.length >= 3) {
        risks.push({
          fingerprint: `github:license:${input.github.login}`,
          title: "Multiple public repositories have no license",
          description: `${unlicensed.length} scanned public repositories do not declare a license.`,
          category: "operational",
          severity: "low",
          likelihood: 50,
          impact: 35,
          confidence: 80,
          why_it_matters:
            "Unlicensed public code creates legal ambiguity for reuse, contribution and downstream vendor diligence.",
          recommendation:
            "Add an explicit license to public repositories, or make internal repositories private.",
          owner_role: "Legal",
          evidence: [
            {
              source_type: "github",
              source_reference: `https://github.com/${input.github.login}`,
              content: `Repositories without license: ${unlicensed.map((r) => r.fullName).join(", ")}`,
              confidence: 80,
              trust_status: "observed",
            },
          ],
        });
      }

      const missingIgnore = input.github.repos.filter(
        (r) => r.hasPackageJson && !r.hasGitignore,
      );
      if (missingIgnore.length) {
        risks.push({
          fingerprint: `github:gitignore:${input.github.login}`,
          title: "Software repositories missing .gitignore",
          description: `${missingIgnore.length} Node.js repositories have package.json but no .gitignore, increasing the chance of committing local secrets or build artefacts.`,
          category: "cybersecurity",
          severity: "medium",
          likelihood: 55,
          impact: 60,
          confidence: 78,
          why_it_matters:
            "Without ignore rules, .env files, keys and IDE artefacts are easier to commit accidentally.",
          recommendation:
            "Add a language-appropriate .gitignore to every active repository.",
          owner_role: "Engineering",
          evidence: [
            {
              source_type: "github",
              source_reference: missingIgnore[0]!.url,
              content: `Affected repositories: ${missingIgnore.map((r) => r.fullName).join(", ")}`,
              confidence: 78,
              trust_status: "observed",
            },
          ],
          action: {
            title: "Add .gitignore to active software repositories",
            owner_role: "Engineering",
            priority: "medium",
          },
        });
      }

      if (input.github.publicRepos > 0) {
        risks.push({
          fingerprint: `github:public-surface:${input.github.login}`,
          title: "Public source code is part of the attack surface",
          description: `${input.github.login} has ${input.github.publicRepos} public repositories. This is not inherently a finding — it is observed exposure.`,
          category: "technology",
          severity: "informational",
          likelihood: 40,
          impact: 40,
          confidence: 95,
          why_it_matters:
            "Public repositories are continuously readable by anyone. They should be treated as an external asset, not an internal one.",
          recommendation:
            "Keep production configuration and credentials out of public repos. Review visibility of each repository.",
          owner_role: "Engineering",
          evidence: [
            {
              source_type: "github",
              source_reference: `https://github.com/${input.github.login}`,
              content: `${input.github.publicRepos} public repositories. Scanned ${input.github.repos.length} most recently updated.`,
              confidence: 95,
              trust_status: "observed",
            },
          ],
        });
      }
    }
  } else {
    risks.push({
      fingerprint: "github:not-connected",
      title: "No GitHub source connected",
      description:
        "This company has not connected a GitHub organisation, so repository risk is unknown.",
      category: "technology",
      severity: "medium",
      likelihood: 50,
      impact: 55,
      confidence: 70,
      why_it_matters:
        "Most technology risk evidence lives in source control. Without it, the VERIQ Company Model is incomplete.",
      recommendation:
        "Add a GitHub organisation or username and rescan.",
      owner_role: "Engineering",
      evidence: [
        {
          source_type: "platform",
          content: "github_login is empty on the organisation record",
          confidence: 90,
          trust_status: "observed",
        },
      ],
      action: {
        title: "Connect GitHub and run a new scan",
        owner_role: "Engineering",
        priority: "high",
      },
    });
  }

  for (const assessment of input.assessments) {
    const unknown = assessment.evidence.filter((item) => item.status === "unknown");
    const gaps = assessment.evidence.filter((item) => item.status === "gap");
    const publicSecretGap = gaps.some((item) => item.key === "no_public_secrets");

    if (publicSecretGap && assessment.category === "privacy") {
      risks.push({
        fingerprint: `reg:secrets-x-privacy:${assessment.code}`,
        title: `Public credential exposure under ${assessment.code}`,
        description: `${assessment.name} expects security safeguards, and this scan observed a public file that often holds secrets.`,
        category: "regulatory",
        severity: "critical",
        likelihood: 80,
        impact: 90,
        confidence: 84,
        why_it_matters:
          "A privacy statute plus an observed credential-class file is correlated risk: unauthorised access can become a notifiable incident.",
        recommendation:
          "Treat this as a security and privacy event. Remove the file, rotate credentials, and record the incident path.",
        owner_role: "Compliance",
        evidence: [
          {
            source_type: "regulation",
            source_reference: assessment.code,
            content: `${assessment.name} mapped. Observable coverage ${assessment.coverage}%. Public secret-class file observed.`,
            confidence: 84,
            trust_status: "inferred",
          },
        ],
        action: {
          title: `Open a privacy/security incident path for ${assessment.code}`,
          owner_role: "Compliance",
          priority: "critical",
        },
      });
    }

    if (unknown.length >= 2) {
      risks.push({
        fingerprint: `reg:missing-evidence:${assessment.code}`,
        title: `Missing evidence for ${assessment.name}`,
        description: `${unknown.length} required artefacts were not observed and cannot be inferred from this scan.`,
        category: "regulatory",
        severity: assessment.category === "aml" ? "high" : "medium",
        likelihood: 70,
        impact: assessment.category === "aml" ? 80 : 65,
        confidence: 70,
        why_it_matters: assessment.impact,
        recommendation:
          "Collect the missing artefacts. VERIQ marks these as UNKNOWN until evidence exists — it will not invent compliance.",
        owner_role: "Compliance",
        evidence: [
          {
            source_type: "regulation",
            source_reference: assessment.code,
            content: `Unknown: ${unknown.map((item) => item.label).join("; ")}`,
            confidence: 70,
            trust_status: "unknown",
          },
        ],
        action: {
          title: `Collect evidence pack for ${assessment.code}`,
          owner_role: "Compliance",
          priority: assessment.category === "aml" ? "high" : "medium",
        },
      });
    } else if (assessment.coverage < 50 && gaps.length) {
      risks.push({
        fingerprint: `reg:weak-safeguards:${assessment.code}`,
        title: `Weak observed safeguards for ${assessment.code}`,
        description: `Observable coverage is ${assessment.coverage}%. Gaps: ${gaps.map((item) => item.label).join(", ")}.`,
        category: "regulatory",
        severity: "medium",
        likelihood: 60,
        impact: 65,
        confidence: 78,
        why_it_matters: assessment.impact,
        recommendation: "Close the observed technical gaps, then attach the attested artefacts.",
        owner_role: "Compliance",
        evidence: [
          {
            source_type: "regulation",
            source_reference: assessment.code,
            content: `Coverage ${assessment.coverage}% of observable controls.`,
            confidence: 78,
            trust_status: "observed",
          },
        ],
      });
    }
  }

  if (input.vendors) {
    const map = input.vendors;
    const payments = map.vendors.filter((item) => item.category === "payments");
    const trackers = map.vendors.filter(
      (item) => item.category === "analytics" || item.category === "ads",
    );
    const hosting = map.vendors.filter((item) => item.category === "hosting");

    if (map.vendors.length === 0) {
      risks.push({
        fingerprint: "vendor:unknown-surface",
        title: "Third-party surface is unknown",
        description:
          "No vendors were observed on the public website or in scanned package manifests, and none have been declared.",
        category: "vendor",
        severity: "medium",
        likelihood: 55,
        impact: 55,
        confidence: 70,
        why_it_matters:
          "Most companies depend on processors they have not listed. Until a register exists, vendor concentration, breach notification and substitution stay UNKNOWN.",
        recommendation:
          "Declare critical vendors (hosting, payments, identity) and rescan the public site.",
        owner_role: "Procurement",
        evidence: [
          {
            source_type: "vendor",
            content: "No observed or declared vendors in this scan",
            confidence: 70,
            trust_status: "unknown",
          },
        ],
        action: {
          title: "Start a critical vendor register",
          owner_role: "Procurement",
          priority: "medium",
        },
      });
    }

    if (map.criticalCount >= 3) {
      risks.push({
        fingerprint: "vendor:concentration",
        title: "High vendor concentration on critical services",
        description: `${map.criticalCount} high or critical vendors sit on hosting, payments or identity paths. Substitution is not evidenced.`,
        category: "vendor",
        severity: "high",
        likelihood: 65,
        impact: 80,
        confidence: 78,
        why_it_matters:
          "A single vendor incident can stop operations when several critical services have no attested replacement.",
        recommendation:
          "Name an owner, record DPAs, and document a replacement for each critical vendor.",
        owner_role: "Procurement",
        evidence: [
          {
            source_type: "vendor",
            content: `Critical/high vendors: ${map.vendors
              .filter((item) => item.criticality === "critical" || item.criticality === "high")
              .map((item) => item.name)
              .join(", ")}`,
            confidence: 78,
            trust_status: "inferred",
          },
        ],
        action: {
          title: "Document replacements for critical vendors",
          owner_role: "Procurement",
          priority: "high",
        },
      });
    }

    for (const vendor of payments) {
      risks.push({
        fingerprint: `vendor:payments:${vendor.id}`,
        title: `${vendor.name} processes payments`,
        description: `${vendor.name} was observed as a payment processor. Customer financial data is in scope; a DPA and incident-notification path remain UNKNOWN.`,
        category: "vendor",
        severity: "high",
        likelihood: 70,
        impact: 85,
        confidence: 86,
        why_it_matters:
          "A payment-vendor incident is both a customer-trust and regulatory event. VERIQ will not invent a contract that was not attested.",
        recommendation: `Confirm the ${vendor.name} DPA, data residency, and who is notified if they are breached.`,
        owner_role: "Procurement",
        evidence: [
          {
            source_type: "vendor",
            source_reference: vendor.id,
            content: `${vendor.name} sources: ${vendor.sources.map((item) => item.reference).join(", ")}`,
            confidence: 86,
            trust_status: vendor.trustStatus,
          },
        ],
        action: {
          title: `File DPA and incident clause for ${vendor.name}`,
          owner_role: "Legal",
          priority: "high",
        },
      });
    }

    if (trackers.length >= 2) {
      risks.push({
        fingerprint: "vendor:trackers",
        title: "Multiple trackers on the public site",
        description: `${trackers.length} analytics or advertising vendors were observed: ${trackers.map((item) => item.name).join(", ")}.`,
        category: "vendor",
        severity: "medium",
        likelihood: 70,
        impact: 60,
        confidence: 88,
        why_it_matters:
          "Trackers are data processors. Under privacy statutes they need a lawful basis and, often, a DPA — neither of which this scan can observe.",
        recommendation:
          "Minimise trackers, disclose them, and attach processing records for each remaining vendor.",
        owner_role: "Compliance",
        evidence: [
          {
            source_type: "vendor",
            content: trackers.map((item) => item.name).join(", "),
            confidence: 88,
            trust_status: "observed",
          },
        ],
        action: {
          title: "Review tracker inventory against the privacy notice",
          owner_role: "Compliance",
          priority: "medium",
        },
      });
    }

    if (hosting.length === 1) {
      const vendor = hosting[0]!;
      risks.push({
        fingerprint: `vendor:single-host:${vendor.id}`,
        title: `Single hosting vendor: ${vendor.name}`,
        description: `${vendor.name} is the only observed production host. There is no attested alternate.`,
        category: "vendor",
        severity: "medium",
        likelihood: 50,
        impact: 75,
        confidence: 80,
        why_it_matters:
          "Hosting concentration is an operational-risk question for the board: what happens if this vendor is unavailable?",
        recommendation:
          "Document recovery assumptions and whether a second region or provider exists.",
        owner_role: "Engineering",
        evidence: [
          {
            source_type: "vendor",
            source_reference: vendor.id,
            content: `${vendor.name} observed via ${vendor.sources.map((item) => item.reference).join(", ")}`,
            confidence: 80,
            trust_status: "inferred",
          },
        ],
      });
    }
  }

  if (input.finance) {
    const finance = input.finance;
    const financialIndustry = ["fintech", "financial_services", "insurance"].includes(
      input.industry,
    );

    if (
      finance.attested.customerConcentration === "unknown" &&
      finance.attested.liquidity === "unknown" &&
      finance.attested.revenueMix === "unknown"
    ) {
      risks.push({
        fingerprint: "finance:unattested",
        title: "Financial model is unattested",
        description:
          "Revenue mix, customer concentration and liquidity have not been attested. Amounts are not estimated.",
        category: "financial",
        severity: "medium",
        likelihood: 55,
        impact: 60,
        confidence: 72,
        why_it_matters:
          "Boards ask about concentration and runway. Until those bands are attested, the financial dimension of the VERIQ score stays weakly evidenced.",
        recommendation:
          "Attest qualitative bands (not ledger amounts) for customer concentration, liquidity and revenue mix, then rescan.",
        owner_role: "Finance",
        evidence: [
          {
            source_type: "finance",
            content: finance.summary,
            confidence: 72,
            trust_status: "unknown",
          },
        ],
        action: {
          title: "Attest financial concentration bands",
          owner_role: "Finance",
          priority: "medium",
        },
      });
    }

    if (finance.paymentRails.length === 1) {
      risks.push({
        fingerprint: "finance:single-rail",
        title: `Single payment rail: ${finance.paymentRails[0]}`,
        description: `${finance.paymentRails[0]} is the only observed payment processor. Share of transactions is UNKNOWN.`,
        category: "financial",
        severity:
          finance.attested.customerConcentration === "high" ||
          finance.attested.liquidity === "tight"
            ? "critical"
            : "high",
        likelihood: 70,
        impact: 85,
        confidence: 82,
        why_it_matters:
          "Payment concentration is a business-continuity and liquidity question. A 48-hour rail outage sits on the revenue path.",
        recommendation:
          "Attest a secondary rail, or document why one processor is acceptable, then simulate a 48-hour outage.",
        owner_role: "Finance",
        evidence: [
          {
            source_type: "finance",
            content: `Observed rail: ${finance.paymentRails[0]}. Customer concentration: ${finance.attested.customerConcentration}. Liquidity: ${finance.attested.liquidity}.`,
            confidence: 82,
            trust_status: "inferred",
          },
        ],
        action: {
          title: "Establish or attest a secondary payment rail",
          owner_role: "Finance",
          priority: "high",
        },
      });
    } else if (financialIndustry && finance.paymentRails.length === 0) {
      risks.push({
        fingerprint: "finance:rail-unknown",
        title: "Payment dependency is unknown",
        description: `Industry is ${input.industry}, but no payment processor was observed on the public site or in scanned packages.`,
        category: "financial",
        severity: "high",
        likelihood: 65,
        impact: 75,
        confidence: 70,
        why_it_matters:
          "A financial-industry company almost always has a transaction rail. If VERIQ cannot see it, the revenue path is a blind spot.",
        recommendation:
          "Declare the payment processor as a vendor, or expose it on the public site and rescan.",
        owner_role: "Finance",
        evidence: [
          {
            source_type: "finance",
            content: "No payments-category vendor observed or declared",
            confidence: 70,
            trust_status: "unknown",
          },
        ],
        action: {
          title: "Declare the primary payment processor",
          owner_role: "Finance",
          priority: "high",
        },
      });
    }

    if (
      finance.attested.customerConcentration === "high" &&
      finance.paymentConcentration === "high"
    ) {
      risks.push({
        fingerprint: "finance:customer-x-payment",
        title: "Customer concentration on a single payment path",
        description:
          "High attested customer concentration plus one observed payment rail. A rail failure and a key-customer loss would stack.",
        category: "financial",
        severity: "critical",
        likelihood: 60,
        impact: 90,
        confidence: 76,
        why_it_matters:
          "This is correlated business risk, not two separate findings. Liquidity impact remains UNKNOWN as an amount.",
        recommendation:
          "Diversify rails and customers, and attest a liquidity band so the board can see runway qualitatively.",
        owner_role: "Executive",
        evidence: [
          {
            source_type: "finance",
            content: finance.summary,
            confidence: 76,
            trust_status: "inferred",
          },
        ],
        action: {
          title: "Brief the board on stacked concentration",
          owner_role: "Executive",
          priority: "critical",
        },
      });
    }

    if (finance.attested.singleSite === "yes") {
      risks.push({
        fingerprint: "finance:single-site",
        title: "Single-site operational concentration",
        description:
          "The company attested that one physical location supports critical operations.",
        category: "financial",
        severity: "medium",
        likelihood: 50,
        impact: 70,
        confidence: 80,
        why_it_matters:
          "A site outage becomes a revenue and continuity event when there is no second location.",
        recommendation:
          "Document recovery assumptions for the primary site, including remote operations.",
        owner_role: "Operations",
        evidence: [
          {
            source_type: "finance",
            content: "singleSite attested as yes",
            confidence: 80,
            trust_status: "observed",
          },
        ],
      });
    }

    if (finance.attested.keyPerson === "yes") {
      risks.push({
        fingerprint: "finance:key-person",
        title: "Key-person dependency attested",
        description:
          "The company attested that production or financial control is concentrated in a small number of people.",
        category: "financial",
        severity: "medium",
        likelihood: 45,
        impact: 75,
        confidence: 78,
        why_it_matters:
          "Key-person risk is a going-concern question for boards and lenders. Privileges were not observed in this scan.",
        recommendation:
          "Split production privileges, document deputies, and attest MFA on those accounts.",
        owner_role: "Executive",
        evidence: [
          {
            source_type: "finance",
            content: "keyPerson attested as yes",
            confidence: 78,
            trust_status: "observed",
          },
        ],
      });
    }
  }

  if (input.ai) {
    const ai = input.ai;
    if (ai.systems.length) {
      if (ai.attested.inventory !== "yes" || ai.attested.humanOversight === "unknown") {
        risks.push({
          fingerprint: "ai:governance-gap",
          title: "Observed AI without attested governance",
          description: `${ai.systems.map((item) => item.name).join(", ")} ${ai.systems.length === 1 ? "was" : "were"} mapped. Human oversight, logging and training-data use remain UNKNOWN.`,
          category: "ai",
          severity: ai.attested.customerFacing === "yes" ? "high" : "medium",
          likelihood: 65,
          impact: 70,
          confidence: 78,
          why_it_matters:
            "An AI API on the production or customer path is a data-processing system. Privacy statutes still apply to prompts and outputs.",
          recommendation:
            "Attest inventory, human oversight and whether customer data is sent to the model. Record a decision log.",
          owner_role: "Compliance",
          evidence: [
            {
              source_type: "ai",
              content: ai.systems
                .map(
                  (item) =>
                    `${item.name} (${item.origin}): ${item.sources.map((row) => row.reference).join(", ")}`,
                )
                .join("; "),
              confidence: 78,
              trust_status: "observed",
            },
          ],
          action: {
            title: "Attest AI governance for observed systems",
            owner_role: "Compliance",
            priority: "medium",
          },
        });
      }

      if (ai.attested.customerFacing === "yes" && ai.attested.humanOversight !== "yes") {
        risks.push({
          fingerprint: "ai:customer-no-oversight",
          title: "Customer-facing AI without attested human oversight",
          description:
            "The company attested that AI faces customers, but not that a human can override or review decisions.",
          category: "ai",
          severity: "high",
          likelihood: 60,
          impact: 80,
          confidence: 80,
          why_it_matters:
            "Customer-facing models create consumer, privacy and conduct risk when outputs are not reviewable.",
          recommendation:
            "Put a human in the loop for material decisions, and log those reviews.",
          owner_role: "Compliance",
          evidence: [
            {
              source_type: "ai",
              content: "customerFacing=yes; humanOversight not attested as yes",
              confidence: 80,
              trust_status: "observed",
            },
          ],
        });
      }

      if (ai.attested.trainsOnCustomerData === "yes") {
        const privacy = input.assessments.find((item) => item.category === "privacy");
        risks.push({
          fingerprint: "ai:training-data",
          title: "Customer data used to train or improve a model",
          description: privacy
            ? `Training on customer data was attested. ${privacy.code} still applies to that processing.`
            : "Training on customer data was attested. Lawful basis and retention for that processing stay UNKNOWN.",
          category: "ai",
          severity: "high",
          likelihood: 55,
          impact: 85,
          confidence: 76,
          why_it_matters:
            "Once customer data enters a training set, deletion and purpose limitation become hard. This is correlated privacy risk.",
          recommendation:
            "Confirm contractual opt-out of training, minimise prompts, and record the lawful basis.",
          owner_role: "Legal",
          evidence: [
            {
              source_type: "ai",
              source_reference: privacy?.code,
              content: "trainsOnCustomerData attested as yes",
              confidence: 76,
              trust_status: "inferred",
            },
          ],
          action: {
            title: "Confirm model-training clauses and lawful basis",
            owner_role: "Legal",
            priority: "high",
          },
        });
      }
    }
  }

  if (input.world) {
    const material = input.world.events
      .filter(
        (item) =>
          item.relevance === "material" &&
          [
            "hyperscaler-concentration",
            "payment-rail-disruption",
            "identity-provider",
            "foundation-model-api",
            "tracker-privacy",
            "oss-supply-chain",
          ].includes(item.id),
      )
      .slice(0, 3);
    for (const event of material) {
      risks.push({
        fingerprint: `world:${event.id}`,
        title: event.title,
        description: `${event.summary} ${event.reason}`,
        category: event.kind === "cyber" ? "cybersecurity" : "operational",
        severity: event.kind === "vendor" ? "high" : "medium",
        likelihood: 50,
        impact: event.kind === "vendor" ? 75 : 60,
        confidence: 72,
        why_it_matters:
          "An external condition on the company model is correlated risk. VERIQ will not invent that an incident is happening now.",
        recommendation:
          "Confirm substitution, notification and whether this condition is actually in the operating perimeter.",
        owner_role: "Executive",
        evidence: [
          {
            source_type: "world",
            source_reference: event.id,
            content: event.reason,
            confidence: 72,
            trust_status: event.trustStatus,
          },
        ],
        action: {
          title: `Review external condition: ${event.title}`,
          owner_role: "Executive",
          priority: event.kind === "vendor" ? "high" : "medium",
        },
      });
    }
  }

  if (!input.website && !input.github) {
    risks.push({
      fingerprint: "model:insufficient-evidence",
      title: "Insufficient evidence to model this company",
      description:
        "No website and no GitHub source were available, so most risk dimensions remain unknown.",
      category: "operational",
      severity: "high",
      likelihood: 60,
      impact: 60,
      confidence: 85,
      why_it_matters:
        "VERIQ will not invent certainty. A thin evidence base produces a weaker score and fewer actionable findings.",
      recommendation:
        "Add a website and GitHub organisation, then run an initial scan.",
      owner_role: "Executive",
      evidence: [
        {
          source_type: "platform",
          content: "Company profile has no reachable website or GitHub login",
          confidence: 85,
          trust_status: "observed",
        },
      ],
    });
  }

  return risks.map((risk) => ({
    ...risk,
    certainty: certaintyFor(risk),
  }));
}

export function scoreFromRisks(risks: DraftRisk[]) {
  const deduct: Record<Severity, number> = {
    critical: 16,
    high: 9,
    medium: 5,
    low: 2,
    informational: 0,
  };

  const byCategory: Record<string, DraftRisk[]> = {};
  for (const risk of risks) {
    byCategory[risk.category] ??= [];
    byCategory[risk.category].push(risk);
  }

  function dimension(categories: string[], unknownBaseline: number) {
    const relevant = categories.flatMap((c) => byCategory[c] ?? []);
    if (!relevant.length) return unknownBaseline;
    const penalty = relevant.reduce(
      (sum, risk) => sum + deduct[risk.severity],
      0,
    );
    return Math.max(12, Math.min(100, 92 - penalty));
  }

  const cybersecurity = dimension(["cybersecurity"], 68);
  const regulatory = dimension(["regulatory"], 70);
  const technology = dimension(["technology"], 66);
  const operational = dimension(["operational"], 72);
  const vendor = dimension(["vendor"], 74);
  const financial = dimension(["financial"], 74);
  const data = dimension(["data", "regulatory"], 67);
  const ai = dimension(["ai"], 72);
  const reputation = dimension(["reputation", "technology"], 76);

  const overall = Math.round(
    cybersecurity * 0.2 +
      regulatory * 0.14 +
      technology * 0.14 +
      operational * 0.1 +
      vendor * 0.08 +
      financial * 0.08 +
      data * 0.12 +
      ai * 0.06 +
      reputation * 0.08,
  );

  return {
    overall,
    cybersecurity,
    regulatory,
    technology,
    operational,
    vendor,
    financial,
    data,
    ai,
    reputation,
  };
}
