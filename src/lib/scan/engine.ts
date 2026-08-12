import type { ActionPriority, Severity, TrustStatus } from "@/lib/database.types";

export type DraftRisk = {
  fingerprint: string;
  title: string;
  description: string;
  category: string;
  severity: Severity;
  likelihood: number;
  impact: number;
  confidence: number;
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
};

export type GithubScan = {
  login: string;
  kind: "User" | "Organization" | "unknown";
  publicRepos: number;
  repos: GithubRepoScan[];
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

export async function scanWebsite(website: string): Promise<WebsiteScan | null> {
  const parsed = normalizeUrl(website);
  if (!parsed) return null;

  const url = parsed.toString();
  const https = parsed.protocol === "https:";

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: { "user-agent": "VERIQ-Scan/0.1 (corporate-risk-intelligence)" },
    });
    clearTimeout(timeout);
    const html = await response.text().catch(() => "");
    const securityHeaders: Record<string, string | null> = {};
    for (const key of HEADER_KEYS) {
      securityHeaders[key] = response.headers.get(key);
    }

    return {
      hostname: parsed.hostname,
      url: response.url || url,
      https: new URL(response.url || url).protocol === "https:" && https,
      statusCode: response.status,
      reachable: response.ok || response.status < 500,
      securityHeaders,
      technologies: detectTechnologies(html.slice(0, 80_000), response.headers),
    };
  } catch (error) {
    return {
      hostname: parsed.hostname,
      url,
      https,
      statusCode: null,
      reachable: false,
      securityHeaders: {},
      technologies: [],
      error: error instanceof Error ? error.message : "Website unreachable",
    };
  }
}

async function githubJson<T>(path: string): Promise<T | null> {
  const response = await fetch(`https://api.github.com${path}`, {
    headers: {
      accept: "application/vnd.github+json",
      "user-agent": "VERIQ-Scan/0.1",
      "x-github-api-version": "2022-11-28",
    },
    next: { revalidate: 0 },
  });
  if (!response.ok) return null;
  return (await response.json()) as T;
}

async function githubExists(fullName: string, filePath: string) {
  const response = await fetch(
    `https://api.github.com/repos/${fullName}/contents/${filePath}`,
    {
      headers: {
        accept: "application/vnd.github+json",
        "user-agent": "VERIQ-Scan/0.1",
        "x-github-api-version": "2022-11-28",
      },
    },
  );
  return response.status === 200;
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

export async function scanGithub(login: string): Promise<GithubScan | null> {
  const handle = login.trim().replace(/^@/, "");
  if (!handle) return null;

  const user = await githubJson<GithubUser>(`/users/${handle}`);
  if (!user) {
    return {
      login: handle,
      kind: "unknown",
      publicRepos: 0,
      repos: [],
      error: "GitHub account not found or not publicly reachable",
    };
  }

  const repos =
    (await githubJson<GithubRepo[]>(
      `/users/${handle}/repos?per_page=8&sort=updated&type=owner`,
    )) ?? [];

  const scanned = await Promise.all(
    repos.slice(0, 5).map(async (repo) => {
      const [sensitiveHits, hasGitignore, hasPackageJson] = await Promise.all([
        Promise.all(
          SENSITIVE_PATHS.map(async (file) =>
            (await githubExists(repo.full_name, file)) ? file : null,
          ),
        ),
        githubExists(repo.full_name, ".gitignore"),
        githubExists(repo.full_name, "package.json"),
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
        hasPackageJson,
      };
    }),
  );

  return {
    login: user.login,
    kind: user.type,
    publicRepos: user.public_repos,
    repos: scanned,
  };
}

export function buildRisks(input: {
  website: WebsiteScan | null;
  github: GithubScan | null;
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

  if (input.country === "KE") {
    risks.push({
      fingerprint: `reg:ke-dpa:${input.industry}`,
      title: "Kenya Data Protection Act obligations likely apply",
      description:
        "Based on country and industry, the organisation is likely a data controller or processor under the Kenya Data Protection Act, 2019.",
      category: "regulatory",
      severity: "medium",
      likelihood: 75,
      impact: 70,
      confidence: 72,
      why_it_matters:
        "DPA duties include lawful basis, security safeguards, data subject rights and possible ODPC registration. Gaps here become both regulatory and customer-trust issues.",
      recommendation:
        "Map personal data processed, appoint a data protection contact, and collect evidence of security safeguards.",
      owner_role: "Compliance",
      evidence: [
        {
          source_type: "regulation",
          source_reference: "KE-DPA",
          content: `Country=KE, industry=${input.industry}. Applicability inferred from company profile, not from a legal opinion.`,
          confidence: 72,
          trust_status: "inferred",
        },
      ],
      action: {
        title: "Collect DPA evidence: data inventory and safeguards",
        owner_role: "Compliance",
        priority: "high",
      },
    });

    if (input.industry === "fintech" || input.industry === "financial_services") {
      risks.push({
        fingerprint: "reg:ke-aml-cbk",
        title: "AML/CFT and CBK cybersecurity expectations apply",
        description:
          "Kenyan financial and payment businesses are typically in scope for AML/CFT controls and CBK cybersecurity guidance.",
        category: "regulatory",
        severity: "high",
        likelihood: 80,
        impact: 85,
        confidence: 74,
        why_it_matters:
          "Supervisory findings in AML or cyber governance can restrict licensing, banking relationships and growth.",
        recommendation:
          "Confirm licence perimeter, CDD/AML programme ownership, and cyber incident response evidence.",
        owner_role: "Compliance",
        evidence: [
          {
            source_type: "regulation",
            source_reference: "KE-AML / KE-CBK-CYBER",
            content: "Inferred from Kenya + financial/fintech industry profile.",
            confidence: 74,
            trust_status: "inferred",
          },
        ],
        action: {
          title: "Document AML programme and cyber governance evidence",
          owner_role: "Compliance",
          priority: "high",
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

  return risks;
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
