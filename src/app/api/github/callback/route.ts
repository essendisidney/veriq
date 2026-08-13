import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runOrganizationScan } from "@/lib/actions/scan";
import {
  exchangeGithubCode,
  githubIdentity,
  githubOAuthConfigured,
  readGithubState,
} from "@/lib/github/oauth";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  if (!githubOAuthConfigured()) {
    return NextResponse.redirect(`${origin}/settings?github=not_configured`);
  }

  const state = readGithubState(searchParams.get("state"));
  const code = searchParams.get("code");
  if (!state || !code) {
    return NextResponse.redirect(`${origin}/settings?github=invalid_state`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.id !== state.userId) {
    return NextResponse.redirect(`${origin}/login?next=/settings`);
  }

  const exchanged = await exchangeGithubCode(origin, code);
  if ("error" in exchanged) {
    return NextResponse.redirect(`${origin}/settings?github=exchange_failed`);
  }

  const identity = await githubIdentity(exchanged.token);
  if ("error" in identity) {
    return NextResponse.redirect(`${origin}/settings?github=identity_failed`);
  }

  const { data: org } = await supabase
    .from("organizations")
    .select("id, github_login")
    .eq("id", state.orgId)
    .single();
  if (!org) {
    return NextResponse.redirect(`${origin}/settings?github=missing_org`);
  }

  const login =
    org.github_login &&
    (identity.login === org.github_login || identity.orgs.includes(org.github_login))
      ? org.github_login
      : identity.orgs[0] ?? identity.login;

  await supabase
    .from("organizations")
    .update({ github_login: login })
    .eq("id", org.id);

  await runOrganizationScan(org.id, { githubToken: exchanged.token });

  return NextResponse.redirect(`${origin}/settings?github=connected`);
}
