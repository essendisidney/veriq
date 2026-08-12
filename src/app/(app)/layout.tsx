import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/layout/app-shell";
import {
  WorkspaceProvider,
  type WorkspaceOrg,
} from "@/components/workspace/workspace-provider";
import type { MembershipRole, Organization } from "@/lib/database.types";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const headersList = await headers();
  const pathname = headersList.get("x-pathname") ?? "";
  const isOnboarding = pathname.startsWith("/onboarding");

  const { data: memberships } = await supabase
    .from("memberships")
    .select("id, role, organization_id, organizations(*)")
    .eq("user_id", user.id);

  const organizations: WorkspaceOrg[] =
    memberships
      ?.map((m) => {
        const org = m.organizations as unknown as Organization | Organization[] | null;
        const record = Array.isArray(org) ? org[0] : org;
        if (!record) return null;
        return {
          membershipId: m.id,
          role: m.role as MembershipRole,
          ...record,
        };
      })
      .filter((item): item is WorkspaceOrg => Boolean(item)) ?? [];

  if (!organizations.length && isOnboarding) {
    return <>{children}</>;
  }

  if (!organizations.length) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg)] px-4">
        <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
            VERIQ
          </p>
          <h1 className="mt-2 font-display text-3xl text-[var(--ink)]">
            Create your company
          </h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Every organisation gets a living risk model — start with a name,
            website and GitHub source.
          </p>
          <Link
            href="/onboarding"
            className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-medium text-[var(--bg)]"
          >
            Set up company
          </Link>
        </div>
      </div>
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return (
    <WorkspaceProvider
      initialOrganizations={organizations}
      initialUser={{
        id: user.id,
        email: user.email ?? "",
        fullName: profile?.full_name ?? user.email ?? "User",
      }}
    >
      <AppShell>{children}</AppShell>
    </WorkspaceProvider>
  );
}
