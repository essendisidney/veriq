"use server";

import { createClient } from "@/lib/supabase/server";
import {
  buildRisks,
  scanGithub,
  scanWebsite,
  scoreFromRisks,
} from "@/lib/scan/engine";

export async function runOrganizationScan(organizationId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", organizationId)
    .single();

  if (orgError || !org) return { error: "Organisation not found" };

  const { data: scan, error: scanError } = await supabase
    .from("scans")
    .insert({
      organization_id: organizationId,
      type: org.github_login || org.website ? "on_demand" : "initial",
      status: "running",
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (scanError || !scan) return { error: scanError?.message ?? "Scan failed" };

  try {
    const [website, github] = await Promise.all([
      org.website ? scanWebsite(org.website) : Promise.resolve(null),
      org.github_login ? scanGithub(org.github_login) : Promise.resolve(null),
    ]);

    if (website) {
      await supabase.from("domains").upsert(
        {
          organization_id: organizationId,
          hostname: website.hostname,
          url: website.url,
          https: website.https,
          status_code: website.statusCode,
          security_headers: website.securityHeaders,
          technologies: website.technologies,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: "organization_id,hostname" },
      );
    }

    if (github?.repos.length) {
      for (const repo of github.repos) {
        await supabase.from("repositories").upsert(
          {
            organization_id: organizationId,
            provider: "github",
            external_id: String(repo.id),
            name: repo.name,
            full_name: repo.fullName,
            url: repo.url,
            visibility: repo.visibility,
            default_branch: repo.defaultBranch,
            language: repo.language,
            description: repo.description,
            stars: repo.stars,
            has_license: repo.hasLicense,
            last_scanned_at: new Date().toISOString(),
            metadata: {
              sensitive_files: repo.sensitiveFiles,
              has_gitignore: repo.hasGitignore,
            },
          },
          { onConflict: "organization_id,provider,full_name" },
        );
      }
    }

    const { data: regulations } = await supabase
      .from("regulations")
      .select("*")
      .eq("jurisdiction", org.country);

    const applicable =
      regulations?.filter(
        (reg) =>
          reg.industries.length === 0 ||
          reg.industries.includes(org.industry),
      ) ?? [];

    for (const reg of applicable) {
      await supabase.from("organization_regulations").upsert(
        {
          organization_id: organizationId,
          regulation_id: reg.id,
          applicability: "applicable",
          notes: "Mapped from country and industry during scan",
        },
        { onConflict: "organization_id,regulation_id" },
      );
    }

    const drafts = buildRisks({
      website,
      github,
      country: org.country,
      industry: org.industry,
    });

    for (const draft of drafts) {
      const { data: existing } = await supabase
        .from("risks")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("fingerprint", draft.fingerprint)
        .maybeSingle();

      let riskId = existing?.id;
      if (riskId) {
        await supabase
          .from("risks")
          .update({
            scan_id: scan.id,
            title: draft.title,
            description: draft.description,
            category: draft.category,
            severity: draft.severity,
            likelihood: draft.likelihood,
            impact: draft.impact,
            confidence: draft.confidence,
            why_it_matters: draft.why_it_matters,
            recommendation: draft.recommendation,
            owner_role: draft.owner_role,
            status: "open",
          })
          .eq("id", riskId);
      } else {
        const { data: inserted, error: riskError } = await supabase
          .from("risks")
          .insert({
            organization_id: organizationId,
            scan_id: scan.id,
            title: draft.title,
            description: draft.description,
            category: draft.category,
            severity: draft.severity,
            likelihood: draft.likelihood,
            impact: draft.impact,
            confidence: draft.confidence,
            why_it_matters: draft.why_it_matters,
            recommendation: draft.recommendation,
            owner_role: draft.owner_role,
            fingerprint: draft.fingerprint,
          })
          .select("id")
          .single();
        if (riskError || !inserted) continue;
        riskId = inserted.id;
      }

      await supabase.from("evidence").insert(
        draft.evidence.map((item) => ({
          organization_id: organizationId,
          risk_id: riskId!,
          source_type: item.source_type,
          source_reference: item.source_reference ?? null,
          content: item.content,
          confidence: item.confidence,
          trust_status: item.trust_status,
        })),
      );

      if (draft.action) {
        const { data: existingAction } = await supabase
          .from("actions")
          .select("id")
          .eq("organization_id", organizationId)
          .eq("risk_id", riskId)
          .eq("status", "open")
          .maybeSingle();

        if (!existingAction) {
          await supabase.from("actions").insert({
            organization_id: organizationId,
            risk_id: riskId,
            title: draft.action.title,
            owner_role: draft.action.owner_role,
            priority: draft.action.priority,
          });
        }
      }
    }

    const score = scoreFromRisks(drafts);
    await supabase.from("scores").insert({
      organization_id: organizationId,
      scan_id: scan.id,
      ...score,
    });

    await supabase
      .from("scans")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        summary: {
          website: website?.hostname ?? null,
          github: github?.login ?? null,
          repos: github?.repos.length ?? 0,
          risks: drafts.length,
          regulations: applicable.length,
          overall: score.overall,
        },
      })
      .eq("id", scan.id);

    return { scanId: scan.id, overall: score.overall };
  } catch (error) {
    await supabase
      .from("scans")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Scan failed",
      })
      .eq("id", scan.id);
    return { error: error instanceof Error ? error.message : "Scan failed" };
  }
}
