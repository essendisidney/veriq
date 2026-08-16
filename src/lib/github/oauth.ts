import { createHmac, timingSafeEqual } from "node:crypto";

const SCOPES = "read:user read:org repo";

function signingSecret() {
  return (
    process.env.GITHUB_CLIENT_SECRET ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "veriq-github-state"
  );
}

export function githubOAuthConfigured() {
  return Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET);
}

export function signGithubState(payload: { orgId: string; userId: string; exp: number }) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", signingSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function readGithubState(state: string | null) {
  if (!state) return null;
  const [body, sig] = state.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", signingSecret()).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as {
      orgId: string;
      userId: string;
      exp: number;
    };
    if (!payload.orgId || !payload.userId || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function githubAuthorizeUrl(origin: string, state: string) {
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", process.env.GITHUB_CLIENT_ID!);
  url.searchParams.set("redirect_uri", `${origin}/api/github/callback`);
  url.searchParams.set("scope", SCOPES);
  url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangeGithubCode(origin: string, code: string) {
  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: `${origin}/api/github/callback`,
    }),
  });
  const payload = (await response.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };
  if (!payload.access_token) {
    return { error: payload.error_description ?? payload.error ?? "GitHub token exchange failed" };
  }
  return { token: payload.access_token };
}

export async function githubIdentity(token: string) {
  const response = await fetch("https://api.github.com/user", {
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "user-agent": "VERIQ-Scan/0.1",
      "x-github-api-version": "2022-11-28",
    },
  });
  if (!response.ok) return { error: "Could not read the GitHub user" };
  const user = (await response.json()) as { login: string };
  if (!user.login) return { error: "GitHub user had no login" };

  const orgsResponse = await fetch("https://api.github.com/user/orgs", {
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "user-agent": "VERIQ-Scan/0.1",
      "x-github-api-version": "2022-11-28",
    },
  });
  const orgs = orgsResponse.ok
    ? ((await orgsResponse.json()) as { login: string }[])
    : [];

  return { login: user.login, orgs: orgs.map((item) => item.login) };
}
