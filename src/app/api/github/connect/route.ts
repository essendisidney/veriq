import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  githubAuthorizeUrl,
  githubOAuthConfigured,
  signGithubState,
} from "@/lib/github/oauth";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const orgId = searchParams.get("org");
  if (!orgId) {
    return NextResponse.redirect(`${origin}/settings?github=missing_org`);
  }

  if (!githubOAuthConfigured()) {
    return NextResponse.redirect(`${origin}/settings?github=not_configured`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(`${origin}/login?next=/settings`);
  }

  const { data: membership } = await supabase
    .from("memberships")
    .select("id")
    .eq("organization_id", orgId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) {
    return NextResponse.redirect(`${origin}/settings?github=forbidden`);
  }

  const state = signGithubState({
    orgId,
    userId: user.id,
    exp: Date.now() + 10 * 60_000,
  });

  return NextResponse.redirect(githubAuthorizeUrl(origin, state));
}
