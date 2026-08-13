"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { simulateScenarios } from "@/lib/scenarios/simulate";
import { assessFinance, DEFAULT_ATTESTED } from "@/lib/finance/assess";
import type { AiAssessment } from "@/lib/ai/assess";
import type { ChangeSet, ScanSnapshot } from "@/lib/changes/diff";
import type { WorldAssessment } from "@/lib/world/assess";
import type { Action, Risk, Score } from "@/lib/database.types";
import type { Exposure } from "@/lib/scan/exposure";
import type { RegulationAssessment } from "@/lib/regulations/assess";
import type { VendorMap } from "@/lib/vendors/assess";
import type { RiskGraph } from "@/lib/graph/build";
import type { FinanceAssessment } from "@/lib/finance/assess";
import { type ReportBundle } from "@/lib/reports/institutional";

export function useReportBundle() {
  const { currentOrg } = useWorkspace();
  const [bundle, setBundle] = useState<ReportBundle | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!currentOrg) return;
    async function load() {
      const supabase = createClient();
      const orgId = currentOrg!.id;
      const [{ data: scores }, { data: topRisks }, { data: openActions }, { data: scans }] =
        await Promise.all([
          supabase
            .from("scores")
            .select("*")
            .eq("organization_id", orgId)
            .order("created_at", { ascending: false })
            .limit(2),
          supabase
            .from("risks")
            .select("*")
            .eq("organization_id", orgId)
            .eq("status", "open")
            .order("created_at", { ascending: false })
            .limit(30),
          supabase
            .from("actions")
            .select("*")
            .eq("organization_id", orgId)
            .eq("status", "open")
            .limit(10),
          supabase
            .from("scans")
            .select("summary")
            .eq("organization_id", orgId)
            .eq("status", "completed")
            .order("created_at", { ascending: false })
            .limit(2),
        ]);

      const latest = scans?.[0]?.summary as
        | {
            exposure?: Exposure;
            regulatory?: RegulationAssessment[];
            vendors?: VendorMap;
            graph?: RiskGraph;
            finance?: FinanceAssessment;
            ai?: AiAssessment;
            changes?: ChangeSet;
            world?: WorldAssessment;
            snapshot?: ScanSnapshot;
            risks?: number;
          }
        | undefined;
      const previousSummary = scans?.[1]?.summary as { risks?: number } | undefined;
      const vendors = latest?.vendors ?? null;
      const regulatory = latest?.regulatory ?? [];
      const graph = latest?.graph ?? null;

      setBundle({
        score: (scores?.[0] as Score) ?? null,
        previous: (scores?.[1] as Score) ?? null,
        risks: (topRisks as Risk[]) ?? [],
        actions: (openActions as Action[]) ?? [],
        previousRiskCount: previousSummary?.risks ?? null,
        regulatory,
        vendors,
        finance:
          latest?.finance ??
          assessFinance({
            vendors,
            industry: currentOrg!.industry,
            attested: DEFAULT_ATTESTED,
          }),
        ai: latest?.ai ?? null,
        changelog: latest?.changes ?? null,
        world: latest?.world ?? null,
        graph,
        scenarios: simulateScenarios({
          graph,
          vendors,
          assessments: regulatory,
        }),
        exposure: latest?.exposure ?? null,
        snapshot: latest?.snapshot ?? null,
      });
      setLoaded(true);
    }
    void load();
  }, [currentOrg]);

  return { currentOrg, bundle, loaded };
}
