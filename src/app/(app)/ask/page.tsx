"use client";

import { useEffect, useState } from "react";
import { MessageSquare } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScanButton } from "@/components/scan-button";
import { answerAsk, type AskAnswer } from "@/lib/truth/ask";
import { TRUST_CALL_LABELS, type TrustCall } from "@/lib/truth/call";
import type { ClaimsAssessment } from "@/lib/claims/assess";
import type { TrustProfile } from "@/lib/truth/profile";
import type { ChangeSet } from "@/lib/changes/diff";
import type { Risk } from "@/lib/database.types";
import type { AcquisitionAssessment } from "@/lib/acquire/types";
import type { FinancialHealth } from "@/lib/finance/health";
import type { TruthScore } from "@/lib/truth/score";
import type { GovernanceAssessment } from "@/lib/truth/governance";
import type { DiggerReport } from "@/lib/digger/types";

const PROMPTS = [
  "Why did you give us this score?",
  "Show me every contradiction.",
  "Where is our biggest financial leakage?",
  "Which directors have potential conflicts?",
  "What would a lender worry about?",
  "What should management fix first?",
  "What information are we missing?",
  "Can I lend this company money?",
];

export default function AskPage() {
  const { currentOrg } = useWorkspace();
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<AskAnswer | null>(null);
  const [claims, setClaims] = useState<ClaimsAssessment | null>(null);
  const [trust, setTrust] = useState<TrustProfile | null>(null);
  const [changes, setChanges] = useState<ChangeSet | null>(null);
  const [critical, setCritical] = useState(0);
  const [acquisition, setAcquisition] = useState<AcquisitionAssessment | null>(null);
  const [health, setHealth] = useState<FinancialHealth | null>(null);
  const [truthScore, setTruthScore] = useState<TruthScore | null>(null);
  const [governance, setGovernance] = useState<GovernanceAssessment | null>(null);
  const [digger, setDigger] = useState<DiggerReport | null>(null);
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
        | {
            claims?: ClaimsAssessment;
            trust?: TrustProfile;
            changes?: ChangeSet;
            acquisition?: AcquisitionAssessment;
            finance?: { health?: FinancialHealth };
            truthScore?: TruthScore;
            governance?: GovernanceAssessment;
            digger?: DiggerReport;
          }
        | undefined;
      setClaims(summary?.claims ?? null);
      setTrust(summary?.trust ?? null);
      setChanges(summary?.changes ?? null);
      setAcquisition(summary?.acquisition ?? null);
      setHealth(summary?.finance?.health ?? null);
      setTruthScore(summary?.truthScore ?? null);
      setGovernance(summary?.governance ?? null);
      setDigger(summary?.digger ?? null);
      setCritical((risks as Risk[] | null)?.length ?? 0);
      setLoaded(true);
    }
    void load();
  }, [currentOrg]);

  if (!currentOrg) return null;

  function onAsk(next?: string) {
    const q = (next ?? question).trim();
    if (!q) return;
    setQuestion(q);
    setAnswer(
      answerAsk({
        question: q,
        company: currentOrg!.name,
        trust,
        claims,
        changes,
        critical,
        acquisition,
        health,
        truthScore,
        governance,
        digger,
      }),
    );
  }

  return (
    <div>
      <PageHeader
        title="Ask VERIQ"
        description="One intelligence engine. Different decisions. Answers come from evidence on this company — not a chatbot guessing KES amounts."
        actions={<ScanButton organizationId={currentOrg.id} label="Rescan" />}
      />
      {!loaded ? (
        <p className="text-sm text-[var(--muted)]">Loading evidence…</p>
      ) : !trust && !claims ? (
        <EmptyState
          icon={MessageSquare}
          title="Nothing to ask yet"
          description="Run a scan first. Ask VERIQ will not invent an answer."
          action={<ScanButton organizationId={currentOrg.id} />}
        />
      ) : (
        <div className="space-y-6">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              onAsk();
            }}
            className="flex flex-col gap-3 sm:flex-row"
          >
            <Input
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Can I lend this company KSh 20M?"
              className="flex-1"
            />
            <Button type="submit">Ask</Button>
          </form>
          <div className="flex flex-wrap gap-2">
            {PROMPTS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => onAsk(item)}
                className="rounded-full border border-[var(--border)] px-3 py-1 text-xs text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--ink)]"
              >
                {item}
              </button>
            ))}
          </div>
          {answer && <AnswerCard answer={answer} />}
        </div>
      )}
    </div>
  );
}

function AnswerCard({ answer }: { answer: AskAnswer }) {
  const color: Record<TrustCall, string> = {
    proceed: "var(--good)",
    investigate: "var(--medium)",
    stop: "var(--critical)",
  };
  return (
    <section className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
      <Badge variant="muted">{answer.intent}</Badge>
      <p className="font-display text-5xl italic" style={{ color: color[answer.call] }}>
        {TRUST_CALL_LABELS[answer.call]}
      </p>
      <p className="text-sm leading-6 text-[var(--ink)]">{answer.headline}</p>
      <Block title="Supporting" items={answer.supporting} />
      <Block title="Material risks" items={answer.risks} />
      <Block title="Unresolved" items={answer.unresolved} />
      <Block title="What to request" items={answer.documents} />
      {answer.questions.length > 0 && answer.intent === "challenge" && (
        <Block title="Challenge management" items={answer.questions} />
      )}
      <p className="text-xs leading-5 text-[var(--muted)]">{answer.disclaimer}</p>
    </section>
  );
}

function Block({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h2 className="text-xs uppercase tracking-wide text-[var(--muted)]">{title}</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--ink)]">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
