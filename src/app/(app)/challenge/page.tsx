"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Swords } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { ScanButton } from "@/components/scan-button";
import { CLAIM_VERDICT_LABELS, normalizeVerdict } from "@/lib/claims/catalog";
import type { ClaimsAssessment } from "@/lib/claims/assess";
import { challengeCompany } from "@/lib/truth/challenge";

export default function ChallengePage() {
  const { currentOrg } = useWorkspace();
  const [claims, setClaims] = useState<ClaimsAssessment | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!currentOrg) return;
    async function load() {
      const supabase = createClient();
      const { data: scans } = await supabase
        .from("scans")
        .select("summary")
        .eq("organization_id", currentOrg!.id)
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(1);
      const summary = scans?.[0]?.summary as { claims?: ClaimsAssessment } | undefined;
      setClaims(summary?.claims ?? null);
      setLoaded(true);
    }
    void load();
  }, [currentOrg]);

  if (!currentOrg) return null;
  const attacks = challengeCompany(claims);

  return (
    <div>
      <PageHeader
        title="VERIQ Challenge"
        description="Don't just verify the story. Try to break it. VERIQ only uses permitted sources. It will not scrape BRS, LinkedIn or a KYB database — and it will not invent fraud."
        actions={<ScanButton organizationId={currentOrg.id} label="Rescan" />}
      />

      {!loaded ? (
        <p className="text-sm text-[var(--muted)]">Loading challenge…</p>
      ) : attacks.length === 0 ? (
        <EmptyState
          icon={Swords}
          title="Nothing to challenge yet"
          description="Attest claims on the Truth page, then rescan. Challenge is adversarial reading of evidence you already have."
          action={
            <Link href="/truth" className="text-sm text-[var(--accent)] hover:underline">
              Open the claim ledger
            </Link>
          }
        />
      ) : (
        <div className="space-y-4">
          {attacks.map((item) => (
            <section
              key={item.claimId}
              className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6"
            >
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-2xl">{item.title}</h2>
                <Badge variant={item.verdict === "contradicted" ? "danger" : "muted"}>
                  {CLAIM_VERDICT_LABELS[normalizeVerdict(item.verdict)]}
                </Badge>
                {item.inference && <Badge variant="warning">Inference — not a fact</Badge>}
              </div>
              <p className="mt-2 text-sm text-[var(--muted)]">Claim: {item.claim}</p>
              <p className="mt-4 text-sm leading-6 text-[var(--ink)]">{item.attack}</p>
              <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{item.current}</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
                    Permitted sources
                  </p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--ink)]">
                    {item.permittedSources.map((source) => (
                      <li key={source}>{source}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
                    Refused
                  </p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--muted)]">
                    {item.refusedSources.map((source) => (
                      <li key={source}>{source}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
