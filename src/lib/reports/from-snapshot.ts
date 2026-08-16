import type { Action, Risk, Score } from "@/lib/database.types";
import { simulateScenarios } from "@/lib/scenarios/simulate";
import { assessFinance, DEFAULT_ATTESTED } from "@/lib/finance/assess";
import type { AiAssessment } from "@/lib/ai/assess";
import type { ChangeSet, ScanSnapshot } from "@/lib/changes/diff";
import type { WorldAssessment } from "@/lib/world/assess";
import type { IntegrityAssessment } from "@/lib/integrity/assess";
import type { Exposure } from "@/lib/scan/exposure";
import type { RegulationAssessment } from "@/lib/regulations/assess";
import type { VendorMap } from "@/lib/vendors/assess";
import type { RiskGraph } from "@/lib/graph/build";
import type { FinanceAssessment } from "@/lib/finance/assess";
import {
  buildCreditReport,
  buildDiligenceReport,
  buildRestructuringReport,
  type InstitutionalReport,
  type ReportBundle,
} from "@/lib/reports/institutional";
import { parsePackKind, type PackKind } from "@/lib/reports/pack";
import type { ApiSnapshotPayload } from "@/lib/api/serve";

type ScanSummary = {
  exposure?: Exposure;
  regulatory?: RegulationAssessment[];
  vendors?: VendorMap;
  graph?: RiskGraph;
  finance?: FinanceAssessment;
  ai?: AiAssessment;
  changes?: ChangeSet;
  world?: WorldAssessment;
  integrity?: IntegrityAssessment;
  snapshot?: ScanSnapshot;
  risks?: number;
};

export function bundleFromSnapshot(payload: ApiSnapshotPayload): ReportBundle | null {
  const org = payload.company;
  if (!org || payload.score == null) return null;

  const latest = (payload.summary ?? {}) as ScanSummary;
  const vendors = latest.vendors ?? null;
  const regulatory = latest.regulatory ?? [];
  const graph = latest.graph ?? null;

  return {
    score: asScore(payload, org.id),
    previous: null,
    risks: (payload.findings ?? []).map((row) => asRisk(row, org.id)),
    actions: (payload.actions ?? []).map((row) => asAction(row, org.id)),
    previousRiskCount: latest.risks ?? null,
    regulatory,
    vendors,
    finance:
      latest.finance ??
      assessFinance({
        vendors,
        industry: org.industry,
        attested: DEFAULT_ATTESTED,
      }),
    ai: latest.ai ?? null,
    changelog: latest.changes ?? null,
    world: latest.world ?? null,
    graph,
    scenarios: simulateScenarios({
      graph,
      vendors,
      assessments: regulatory,
    }),
    exposure: latest.exposure ?? null,
    snapshot: latest.snapshot ?? null,
    integrity: latest.integrity ?? null,
  };
}

export function reportFromSnapshot(
  kind: PackKind,
  payload: ApiSnapshotPayload,
): InstitutionalReport | null {
  const org = payload.company;
  const bundle = bundleFromSnapshot(payload);
  if (!org || !bundle) return null;
  const pack = parsePackKind(kind);
  if (pack === "diligence") return buildDiligenceReport(org, bundle);
  if (pack === "credit") return buildCreditReport(org, bundle);
  return buildRestructuringReport(org, bundle);
}

function asScore(payload: ApiSnapshotPayload, orgId: string): Score {
  return {
    id: "snapshot",
    organization_id: orgId,
    scan_id: null,
    overall: payload.score ?? 0,
    cybersecurity: payload.cybersecurity ?? 0,
    regulatory: payload.regulatory ?? 0,
    technology: payload.technology ?? 0,
    operational: payload.operational ?? 0,
    vendor: payload.vendor ?? 0,
    financial: payload.financial ?? 0,
    data: payload.data ?? 0,
    ai: payload.ai ?? 0,
    reputation: payload.reputation ?? 0,
    created_at: payload.scanned_at ?? new Date().toISOString(),
  };
}

function asRisk(
  row: NonNullable<ApiSnapshotPayload["findings"]>[number],
  orgId: string,
): Risk {
  return {
    id: row.id,
    organization_id: orgId,
    scan_id: null,
    title: row.title,
    description: row.description ?? "",
    category: row.category,
    severity: (row.severity as Risk["severity"]) ?? "medium",
    likelihood: 0,
    impact: 0,
    confidence: row.confidence ?? 0,
    status: (row.status as Risk["status"]) ?? "open",
    certainty: "potential",
    why_it_matters: row.why_it_matters,
    recommendation: row.recommendation ?? null,
    owner_role: row.owner_role ?? null,
    fingerprint: row.fingerprint ?? row.id,
    created_at: "",
    updated_at: "",
  };
}

function asAction(
  row: NonNullable<ApiSnapshotPayload["actions"]>[number],
  orgId: string,
): Action {
  return {
    id: row.id,
    organization_id: orgId,
    risk_id: null,
    title: row.title,
    owner_role: row.owner_role ?? null,
    priority: (row.priority as Action["priority"]) ?? "medium",
    deadline: row.deadline ?? null,
    status: (row.status as Action["status"]) ?? "open",
    created_at: "",
    updated_at: "",
  };
}
