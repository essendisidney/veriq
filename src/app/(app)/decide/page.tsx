"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DoorOpen } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ScanButton } from "@/components/scan-button";
import { answerAsk, type AskIntent } from "@/lib/truth/ask";
import { TRUST_CALL_LABELS } from "@/lib/truth/call";
import type { ClaimsAssessment } from "@/lib/claims/assess";
import type { TrustProfile } from "@/lib/truth/profile";
import type { ChangeSet } from "@/lib/changes/diff";
import type { Risk } from "@/lib/database.types";

const ROOMS: { id: AskIntent; title: string; question: string; href: string }[] = [
  { id: "lend", title: "Loan room", question: "Can we lend this company?", href: "/reports/credit" },
  { id: "invest", title: "Investment room", question: "Should we invest?", href: "/reports/diligence" },
  { id: "procure", title: "Procurement room", question: "Should we award this supplier?", href: "/reports/procurement" },
  { id: "insure", title: "Insurance room", question: "Should we insure this business?", href: "/reports/credit" },
  { id: "partner", title: "Partnership room", question: "Should we partner?", href: "/truth" },
];

export default function DecidePage() {
  const { currentOrg } = useWorkspace();
  const [room, setRoom] = useState<AskIntent>("lend");
  const [claims, setClaims] = useState<ClaimsAssessment | null>(null);
  const [trust, setTrust] = useState<TrustProfile | null>(null);
  const [changes, setChanges] = useState<ChangeSet | null>(null);
  const [critical, setCritical] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!currentOrg) return;
    async function load() {
      const supabase = createClient();
      const [{ data: scans }, { data: risks }] = await Promise.all([
        supabase
          .from("scans")
          .select("summary")
          .eq("organization_id", currentOrg!.id)
          .eq("status", "completed")
          .order("created_at", { ascending: false })
          .limit(1),
        supabase
          .from("risks")
          .select("severity")
          .eq("organization_id", currentOrg!.id)
          .eq("status", "open")
          .eq("severity", "critical"),
      ]);
      const summary = scans?.[0]?.summary as
        | { claims?: ClaimsAssessment; trust?: TrustProfile; changes?: ChangeSet }
        | undefined;
      setClaims(summary?.claims ?? null);
      setTrust(summary?.trust ?? null);
      setChanges(summary?.changes ?? null);
      setCritical((risks ?? []).length);
      setLoaded(true);
    }
    void load();
  }, [currentOrg]);

  if (!currentOrg) return null;
  const meta = ROOMS.find((item) => item.id === room)!;
  const answer =
    loaded && (trust || claims)
      ? answerAsk({
          question: meta.question,
          company: currentOrg.name,
          trust,
          claims,
          changes,
          critical,
        })
      : null;

  return (
    <div>
      <PageHeader
        title="Decision rooms"
        description="The same evidence, a different question. This is not a comment thread and not a credit committee. It is the file you walk in with."
        actions={<ScanButton organizationId={currentOrg.id} label="Rescan" />}
      />
      <div className="mb-6 flex flex-wrap gap-2">
        {ROOMS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setRoom(item.id)}
            className={`rounded-full border px-3 py-1 text-sm ${
              room === item.id
                ? "border-[var(--accent)] bg-[var(--accent-dim)] text-[var(--accent)]"
                : "border-[var(--border)] text-[var(--muted)]"
            }`}
          >
            {item.title}
          </button>
        ))}
      </div>
      {!loaded ? (
        <p className="text-sm text-[var(--muted)]">Assembling the room…</p>
      ) : !answer ? (
        <EmptyState
          icon={DoorOpen}
          title="No scan in this room"
          description="Run a scan. VERIQ will not invent a committee paper."
        />
      ) : (
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
          <p className="eyebrow">{meta.title}</p>
          <p className="mt-3 font-display text-5xl italic">{TRUST_CALL_LABELS[answer.call]}</p>
          <p className="mt-3 text-sm leading-6 text-[var(--ink)]">{answer.headline}</p>
          <h2 className="mt-6 text-xs uppercase tracking-wide text-[var(--muted)]">What to do</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {answer.documents.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <Link href={meta.href} className="mt-6 inline-block text-sm text-[var(--accent)] hover:underline">
            Open the evidence pack
          </Link>
          <p className="mt-4 text-xs text-[var(--muted)]">{answer.disclaimer}</p>
        </section>
      )}
    </div>
  );
}
