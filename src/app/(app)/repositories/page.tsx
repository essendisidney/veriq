"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { GitBranch } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import type { Repository } from "@/lib/database.types";

export default function RepositoriesPage() {
  const { currentOrg } = useWorkspace();
  const [repos, setRepos] = useState<Repository[]>([]);

  useEffect(() => {
    if (!currentOrg) return;
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from("repositories")
        .select("*")
        .eq("organization_id", currentOrg!.id)
        .order("stars", { ascending: false });
      setRepos((data as Repository[]) ?? []);
    }
    void load();
  }, [currentOrg]);

  return (
    <div>
      <PageHeader
        title="Repositories"
        description="Public repos from the GitHub username on Settings, plus private repos when GitHub OAuth is connected for this company."
        actions={
          currentOrg ? (
            <Link href="/settings" className="text-sm text-[var(--accent)] hover:underline">
              Connect GitHub
            </Link>
          ) : null
        }
      />
      {repos.length === 0 ? (
        <EmptyState
          icon={GitBranch}
          title="No repositories yet"
          description="Add a public GitHub username in Settings, or Connect GitHub for private org access, then rescan."
        />
      ) : (
        <ul className="space-y-3">
          {repos.map((repo) => (
            <li
              key={repo.id}
              className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-5 py-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={repo.url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-[var(--ink)] hover:text-[var(--accent)]"
                >
                  {repo.full_name}
                </a>
                <Badge variant="muted">{repo.visibility}</Badge>
                {repo.language && <Badge>{repo.language}</Badge>}
              </div>
              {repo.description && (
                <p className="mt-2 text-sm text-[var(--muted)]">{repo.description}</p>
              )}
              <p className="mt-2 text-xs text-[var(--muted)]">
                {repo.stars} stars
                {repo.has_license === false ? " · no license" : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
