"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/ui/page-header";
import { CertaintyBadge, SeverityBadge } from "@/components/ui/badge";
import { Badge } from "@/components/ui/badge";
import { ActionStatusSelect, RiskStatusSelect } from "@/components/triage-controls";
import { AttestRegulation } from "@/components/attest-regulation";
import { ValidateFinding } from "@/components/validate-finding";
import { TRUST_LABELS, formatDateTime } from "@/lib/utils";
import { certaintyWhy, isOverdue } from "@/lib/risk/certainty";
import {
  STAGE_LABELS,
  VALIDATION_LABELS,
  type ValidationStatus,
} from "@/lib/risk/validate";
import type { Action, Evidence, EvidenceDocument, Risk, ValidationEvent } from "@/lib/database.types";
import { NODE_TYPE_LABELS, neighborsOf, type RiskGraph } from "@/lib/graph/build";
import type { RegulationAssessment } from "@/lib/regulations/assess";
import {
  parseRegulationAttestations,
  regulationCodeFromFinding,
  REGULATION_ATTEST_ASSET,
  type ArtefactBand,
} from "@/lib/regulations/attest";

function ifYouDoNothing(risk: Risk) {
  if (risk.severity === "critical") {
    return "If this stays open, a material incident can start from evidence we already hold — with little warning.";
  }
  if (risk.severity === "high") {
    return "If this stays open, the exposure remains available to attackers, regulators or counterparties.";
  }
  return "If this stays open, it continues to pull down the VERIQ Score and will reappear on the next scan.";
}

export default function FindingDetailPage() {
  const params = useParams<{ id: string }>();
  const [risk, setRisk] = useState<Risk | null>(null);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [related, setRelated] = useState<RiskGraph["nodes"]>([]);
  const [statute, setStatute] = useState<RegulationAssessment | null>(null);
  const [savedAttest, setSavedAttest] = useState<Record<string, ArtefactBand>>({});
  const [documents, setDocuments] = useState<EvidenceDocument[]>([]);
  const [events, setEvents] = useState<ValidationEvent[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const [{ data: riskRow }, { data: evidenceRows }, { data: actionRows }, { data: docs }, { data: trail }] =
        await Promise.all([
          supabase.from("risks").select("*").eq("id", params.id).single(),
          supabase
            .from("evidence")
            .select("*")
            .eq("risk_id", params.id)
            .order("observed_at", { ascending: false }),
          supabase.from("actions").select("*").eq("risk_id", params.id),
          supabase
            .from("evidence_documents")
            .select("*")
            .eq("risk_id", params.id)
            .order("created_at", { ascending: false }),
          supabase
            .from("validation_events")
            .select("*")
            .eq("risk_id", params.id)
            .order("created_at", { ascending: false }),
        ]);
      const nextRisk = (riskRow as Risk) ?? null;
      const nextEvidence = (evidenceRows as Evidence[]) ?? [];
      setRisk(nextRisk);
      setEvidence(nextEvidence);
      setActions((actionRows as Action[]) ?? []);
      setDocuments((docs as EvidenceDocument[]) ?? []);
      setEvents((trail as ValidationEvent[]) ?? []);

      if (nextRisk) {
        const code = regulationCodeFromFinding({
          fingerprint: nextRisk.fingerprint,
          evidence: nextEvidence,
        });
        const [{ data: scans }, { data: asset }] = await Promise.all([
          supabase
            .from("scans")
            .select("summary")
            .eq("organization_id", nextRisk.organization_id)
            .eq("status", "completed")
            .order("created_at", { ascending: false })
            .limit(1),
          supabase
            .from("assets")
            .select("metadata")
            .eq("organization_id", nextRisk.organization_id)
            .eq("type", REGULATION_ATTEST_ASSET.type)
            .eq("name", REGULATION_ATTEST_ASSET.name)
            .maybeSingle(),
        ]);
        const summary = scans?.[0]?.summary as
          | { graph?: RiskGraph; regulatory?: RegulationAssessment[] }
          | undefined;
        const graph = summary?.graph;
        const nodeId = `risk:${nextRisk.fingerprint}`;
        setRelated(graph ? neighborsOf(graph, nodeId) : []);
        setStatute(
          code
            ? (summary?.regulatory?.find((item) => item.code === code) ?? null)
            : null,
        );
        setSavedAttest(
          code ? (parseRegulationAttestations(asset?.metadata)[code] ?? {}) : {},
        );
      }
      setLoaded(true);
    }
    void load();
  }, [params.id, tick]);

  if (!loaded) {
    return <p className="text-sm text-[var(--muted)]">Loading finding…</p>;
  }

  if (!risk) {
    return (
      <div>
        <Link href="/findings" className="text-sm text-[var(--muted)]">
          ← Findings
        </Link>
        <p className="mt-4 text-sm text-[var(--muted)]">
          This finding does not exist or you do not have access.
        </p>
      </div>
    );
  }

  return (
    <div>
      <Link
        href="/findings"
        className="text-sm text-[var(--muted)] hover:text-[var(--accent)]"
      >
        ← Findings
      </Link>
      <PageHeader
        title={risk.title}
        description={risk.description}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <SeverityBadge severity={risk.severity} />
            <CertaintyBadge certainty={risk.certainty ?? "potential"} />
            <Badge variant="muted">
              {STAGE_LABELS[risk.intelligence_stage ?? "finding"]}
            </Badge>
            <Badge variant="warning">
              {VALIDATION_LABELS[risk.validation_status ?? "pending"]}
            </Badge>
          </div>
        }
        className="mt-4"
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="space-y-4 lg:col-span-2">
          <div className="rounded-2xl border border-[var(--accent)] bg-[var(--accent-dim)] p-6">
            <h2 className="font-display text-xl">What should I do?</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--ink)]">
              {risk.recommendation ??
                "Request evidence, then mark this finding resolved or upload an artefact so VERIQ can reassess. Do nothing is a decision."}
            </p>
            {actions[0] && (
              <p className="mt-3 text-sm text-[var(--muted)]">
                Open action: {actions[0].title}
                {actions[0].owner_role ? ` · ${actions[0].owner_role}` : ""}
              </p>
            )}
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h2 className="font-display text-xl">Why this matters</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              {risk.why_it_matters}
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h2 className="font-display text-xl">How sure is VERIQ</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              {certaintyWhy({
                certainty: risk.certainty ?? "potential",
                confidence: risk.confidence,
                evidence,
              })}
            </p>
          </div>
          {related.length > 0 && (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
              <h2 className="font-display text-xl">Why this is material</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                Individual findings are not enough. These nodes sit next to this risk on the
                company graph.
              </p>
              <ul className="mt-4 space-y-2">
                {related.map((node) => (
                  <li key={node.id}>
                    {node.href ? (
                      <Link
                        href={node.href}
                        className="block rounded-xl border border-[var(--border)] bg-[var(--elevated)] px-3 py-2 hover:border-[var(--accent)]"
                      >
                        <p className="text-sm text-[var(--ink)]">{node.label}</p>
                        <p className="mt-0.5 text-xs text-[var(--muted)]">
                          {NODE_TYPE_LABELS[node.type]}
                        </p>
                      </Link>
                    ) : (
                      <div className="rounded-xl border border-[var(--border)] bg-[var(--elevated)] px-3 py-2">
                        <p className="text-sm text-[var(--ink)]">{node.label}</p>
                        <p className="mt-0.5 text-xs text-[var(--muted)]">
                          {NODE_TYPE_LABELS[node.type]}
                        </p>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
              <Link
                href="/graph"
                className="mt-3 inline-block text-sm text-[var(--accent)] hover:underline"
              >
                Open risk graph
              </Link>
            </div>
          )}
          <div className="rounded-2xl border border-[var(--critical)]/30 bg-[var(--surface)] p-6">
            <h2 className="font-display text-xl">If you do nothing</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              {ifYouDoNothing(risk)}
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h2 className="font-display text-xl">Evidence</h2>
            {evidence.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--muted)]">
                No evidence rows stored for this finding.
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {evidence.map((item) => (
                  <li
                    key={item.id}
                    className="rounded-xl border border-[var(--border)] bg-[var(--elevated)] p-4"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge>{item.source_type}</Badge>
                      <Badge variant="muted">
                        {TRUST_LABELS[item.trust_status]}
                      </Badge>
                      <span className="text-xs text-[var(--muted)]">
                        {item.confidence}% · {formatDateTime(item.observed_at)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-[var(--ink)]">{item.content}</p>
                    {item.source_reference && (
                      <p className="mt-2 break-all text-xs text-[var(--muted)]">
                        {item.source_reference}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h2 className="font-display text-xl">Recommended action</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              {risk.recommendation}
            </p>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--muted)]">Owner</dt>
                <dd>{risk.owner_role ?? "Unassigned"}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-[var(--muted)]">Status</dt>
                <dd>
                  <RiskStatusSelect
                    organizationId={risk.organization_id}
                    riskId={risk.id}
                    status={risk.status}
                  />
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--muted)]">Likelihood</dt>
                <dd>{risk.likelihood}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--muted)]">Impact</dt>
                <dd>{risk.impact}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--muted)]">Confidence</dt>
                <dd>{risk.confidence}%</dd>
              </div>
            </dl>
          </div>
          <ValidateFinding
            organizationId={risk.organization_id}
            riskId={risk.id}
            requiredDocument={risk.required_document}
            validationStatus={(risk.validation_status ?? "pending") as ValidationStatus}
            documents={documents}
            events={events}
            onDone={() => setTick((value) => value + 1)}
          />
          {statute && (
            <div className="space-y-3">
              <Link
                href={`/regulations/${statute.code}`}
                className="text-sm text-[var(--accent)] hover:underline"
              >
                Open {statute.code}
              </Link>
              <AttestRegulation
                organizationId={risk.organization_id}
                code={statute.code}
                items={statute.evidence}
                saved={savedAttest}
              />
            </div>
          )}
          {actions.map((action) => (
            <div
              key={action.id}
              className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6"
            >
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                Action
              </p>
              <p className="mt-2 text-sm text-[var(--ink)]">{action.title}</p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                {action.owner_role} · {action.priority}
                {action.deadline
                  ? ` · due ${formatDateTime(action.deadline)}`
                  : ""}
                {isOverdue(action.deadline, action.status) ? " · overdue" : ""}
              </p>
              <div className="mt-3">
                <ActionStatusSelect
                  organizationId={action.organization_id}
                  actionId={action.id}
                  status={action.status}
                />
              </div>
            </div>
          ))}
        </aside>
      </div>
    </div>
  );
}
