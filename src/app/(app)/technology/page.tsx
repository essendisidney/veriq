"use client";

import { useEffect, useState } from "react";
import { Server } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import type { Domain } from "@/lib/database.types";

export default function TechnologyPage() {
  const { currentOrg } = useWorkspace();
  const [domains, setDomains] = useState<Domain[]>([]);

  useEffect(() => {
    if (!currentOrg) return;
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from("domains")
        .select("*")
        .eq("organization_id", currentOrg!.id)
        .order("created_at", { ascending: false });
      setDomains((data as Domain[]) ?? []);
    }
    void load();
  }, [currentOrg]);

  return (
    <div>
      <PageHeader
        title="Technology"
        description="Publicly observable domains, transport security and technology fingerprints."
      />
      {domains.length === 0 ? (
        <EmptyState
          icon={Server}
          title="No domains discovered"
          description="Add a website on the company profile and run a scan."
        />
      ) : (
        <div className="grid gap-4">
          {domains.map((domain) => (
            <article
              key={domain.id}
              className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6"
            >
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-2xl">{domain.hostname}</h2>
                <Badge variant={domain.https ? "accent" : "danger"}>
                  {domain.https ? "HTTPS" : "No HTTPS"}
                </Badge>
                {domain.status_code && (
                  <Badge variant="muted">{domain.status_code}</Badge>
                )}
              </div>
              <p className="mt-2 break-all text-sm text-[var(--muted)]">
                {domain.url}
              </p>
              {domain.technologies.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {domain.technologies.map((tech) => (
                    <Badge key={tech}>{tech}</Badge>
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
