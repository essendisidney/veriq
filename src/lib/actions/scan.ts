"use server";

import { createClient } from "@/lib/supabase/server";
import {
  buildRisks,
  scanGithub,
  scanWebsite,
  scoreFromRisks,
} from "@/lib/scan/engine";
import { scanExposure, withJoinedHostnames } from "@/lib/scan/exposure";
import { assessRegulations } from "@/lib/regulations/assess";
import {
  parseRegulationAttestations,
  REGULATION_ATTEST_ASSET,
} from "@/lib/regulations/attest";
import { assessVendors } from "@/lib/vendors/assess";
import { declaredFromAsset, detectVendors } from "@/lib/vendors/detect";
import { buildRiskGraph } from "@/lib/graph/build";
import { assessFinance, parseAttested } from "@/lib/finance/assess";
import { assessAi, detectAi, parseAttestedAi, systemFromAsset } from "@/lib/ai/assess";
import { assessWorld } from "@/lib/world/assess";
import { assessIntegrity } from "@/lib/integrity/assess";
import {
  assessClaims,
  extractObservedClaims,
  parseAttestedClaims,
  CLAIMS_ASSET,
} from "@/lib/claims/assess";
import { buildTrustProfile } from "@/lib/truth/profile";
import { buildTruthScore } from "@/lib/truth/score";
import { packForIndustry } from "@/lib/packs/sector";
import {
  buildSnapshot,
  criticalityFor,
  diffSnapshots,
  significantChanges,
  snapshotFromSummary,
  type ScanSummarySlice,
} from "@/lib/changes/diff";
import { slaDeadlineIso } from "@/lib/risk/certainty";
import type { Json, ScanType, Severity } from "@/lib/database.types";
import {
  postWebhook,
  webhookFromAsset,
  webhookPayload,
} from "@/lib/webhooks/deliver";
import { computeNextDue, parseCadence } from "@/lib/webhooks/cadence";
import { resolveCompanyIdentity } from "@/lib/truth/identity";
import { assessAcquisition } from "@/lib/acquire/assess";
import { persistAcquisition } from "@/lib/acquire/persist";
import { runKenyaConnectors } from "@/lib/acquire/kenya";
import { EMPTY_DIGGER } from "@/lib/digger/types";
import { runDigger } from "@/lib/digger/run";
import { persistDigger } from "@/lib/digger/persist";

const SCAN_COOLDOWN_MS = 90_000;
const SCAN_STALE_MS = 10 * 60_000;

async function isolate<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

export async function runOrganizationScan(
  organizationId: string,
  options?: { githubToken?: string },
) {
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

  const staleBefore = new Date(Date.now() - SCAN_STALE_MS).toISOString();
  await supabase
    .from("scans")
    .update({
      status: "failed",
      completed_at: new Date().toISOString(),
      error: "Scan timed out",
    })
    .eq("organization_id", organizationId)
    .eq("status", "running")
    .lt("started_at", staleBefore);

  const { data: running } = await supabase
    .from("scans")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("status", "running")
    .maybeSingle();
  if (running) return { error: "A scan is already running for this company" };

  const { data: recent } = await supabase
    .from("scans")
    .select("created_at")
    .eq("organization_id", organizationId)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (
    recent?.created_at &&
    Date.now() - new Date(recent.created_at).getTime() < SCAN_COOLDOWN_MS
  ) {
    return { error: "Wait a minute before running another scan" };
  }

  const { data: monitoring } = await supabase
    .from("assets")
    .select("id, metadata")
    .eq("organization_id", organizationId)
    .eq("type", "monitoring")
    .eq("name", "Monitoring")
    .maybeSingle();
  const cadence = parseCadence(
    (monitoring?.metadata as { cadence?: string } | null)?.cadence,
  );
  const dueAt = (monitoring?.metadata as { nextDueAt?: string } | null)?.nextDueAt;
  const due = Boolean(dueAt && new Date(dueAt).getTime() <= Date.now());
  const scanType: ScanType = due
    ? cadence === "weekly"
      ? "weekly"
      : cadence === "daily"
        ? "daily"
        : org.github_login || org.website
          ? "on_demand"
          : "initial"
    : org.github_login || org.website
      ? "on_demand"
      : "initial";

  const { data: scan, error: scanError } = await supabase
    .from("scans")
    .insert({
      organization_id: organizationId,
      type: scanType,
      status: "running",
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (scanError || !scan) return { error: scanError?.message ?? "Scan failed" };

  try {
    let websiteUrl = org.website;
    let githubLogin = org.github_login;
    if (!websiteUrl && org.name) {
      const resolved = await isolate(() => resolveCompanyIdentity(org.name), null);
      if (resolved && "identity" in resolved) {
        websiteUrl = resolved.identity.website;
        githubLogin = githubLogin || resolved.identity.githubLogin;
        await supabase
          .from("organizations")
          .update({
            website: websiteUrl,
            github_login: githubLogin,
          })
          .eq("id", organizationId);
      }
    }

    let hostname: string | null = null;
    if (websiteUrl) {
      try {
        const withProtocol = /^https?:\/\//i.test(websiteUrl)
          ? websiteUrl
          : `https://${websiteUrl}`;
        hostname = new URL(withProtocol).hostname;
      } catch {
        hostname = null;
      }
    }

    const [website, github, exposure, previousScan, previousOpen] = await Promise.all([
      websiteUrl
        ? isolate(() => scanWebsite(websiteUrl!), null)
        : Promise.resolve(null),
      githubLogin
        ? isolate(() => scanGithub(githubLogin!, options?.githubToken), null)
        : Promise.resolve(null),
      hostname
        ? isolate(() => scanExposure(hostname), null)
        : Promise.resolve(null),
      supabase
        .from("scans")
        .select("id, summary")
        .eq("organization_id", organizationId)
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("risks")
        .select("id, fingerprint, title, severity, status")
        .eq("organization_id", organizationId)
        .in("status", ["open", "in_progress", "acknowledged"]),
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

    const { data: regulationAttest } = await supabase
      .from("assets")
      .select("metadata")
      .eq("organization_id", organizationId)
      .eq("type", REGULATION_ATTEST_ASSET.type)
      .eq("name", REGULATION_ATTEST_ASSET.name)
      .maybeSingle();

    const assessments = assessRegulations({
      country: org.country,
      industry: org.industry,
      website,
      github,
      exposure,
      attestations: parseRegulationAttestations(regulationAttest?.metadata),
    });

    const { data: vendorAssets } = await supabase
      .from("assets")
      .select("id, name, criticality, metadata")
      .eq("organization_id", organizationId)
      .eq("type", "vendor");

    const declared = (vendorAssets ?? []).flatMap((row) => {
      const vendor = declaredFromAsset({
        name: row.name,
        criticality: row.criticality,
        metadata: row.metadata,
      });
      return vendor ? [vendor] : [];
    });

    const detected = detectVendors({
      html: `${website?.html ?? ""}\n${website?.storyHtml ?? ""}`,
      headers: website?.responseHeaders,
      technologies: website?.technologies,
      packages: github?.packages,
    });
    const vendorMap = assessVendors({ detected, declared });

    const { data: aiAssets } = await supabase
      .from("assets")
      .select("id, name, metadata")
      .eq("organization_id", organizationId)
      .eq("type", "ai");
    const { data: aiGovernance } = await supabase
      .from("assets")
      .select("metadata")
      .eq("organization_id", organizationId)
      .eq("type", "ai_governance")
      .eq("name", "AI governance")
      .maybeSingle();
    const declaredAi = (aiAssets ?? []).flatMap((row) => {
      const system = systemFromAsset(row);
      return system ? [system] : [];
    });
    const ai = assessAi({
      detected: detectAi({
        html: `${website?.html ?? ""}\n${website?.storyHtml ?? ""}\n${website?.storyText ?? ""}`,
        packages: github?.packages,
        vendors: vendorMap,
      }),
      declared: declaredAi,
      attested: parseAttestedAi(aiGovernance?.metadata),
    });
    const { data: vaultDocs } = await supabase
      .from("evidence_documents")
      .select("kind, filename, sha256, created_at, extracted_text")
      .eq("organization_id", organizationId)
      .limit(80);
    const { data: priorPages } = await supabase
      .from("veriq_crawl_pages")
      .select("url, content_hash")
      .eq("organization_id", organizationId)
      .limit(80);

    const observedClaims = extractObservedClaims({
      html: website?.storyText || website?.html,
      teamFootprint: website?.teamFootprint,
      teamPageUrl: website?.teamPageUrl,
      githubPublicRepos: github?.publicRepos ?? github?.repos.length ?? 0,
      vendors: vendorMap,
    });
    let origin: string | null = null;
    if (website?.url) {
      try {
        origin = new URL(website.url).origin;
      } catch {
        origin = null;
      }
    }
    const scanned = website;
    const digger = scanned?.reachable
      ? await isolate(
          () =>
            runDigger({
              origin,
              homepageUrl: scanned.url,
              homepageHtml: scanned.html,
              storyHtml: scanned.storyHtml,
              storyText: scanned.storyText,
              storyPages: scanned.storyPages,
              companyName: org.name,
              vault: (vaultDocs ?? []).map((row) => ({
                filename: row.filename,
                kind: row.kind,
                text: row.extracted_text ?? null,
              })),
              previousHashes: (priorPages ?? []).map((row) => ({
                url: row.url,
                content_hash: row.content_hash,
              })),
            }),
          EMPTY_DIGGER,
        )
      : EMPTY_DIGGER;
    if (website) {
      website.html = "";
      website.storyHtml = "";
      website.storyText = "";
    }

    const { data: financeAsset } = await supabase
      .from("assets")
      .select("metadata")
      .eq("organization_id", organizationId)
      .eq("type", "finance")
      .eq("name", "Financial signals")
      .maybeSingle();
    const { data: claimsAsset } = await supabase
      .from("assets")
      .select("metadata")
      .eq("organization_id", organizationId)
      .eq("type", CLAIMS_ASSET.type)
      .eq("name", CLAIMS_ASSET.name)
      .maybeSingle();
    const finance = assessFinance({
      vendors: vendorMap,
      industry: org.industry,
      attested: parseAttested(financeAsset?.metadata),
      documents: (vaultDocs ?? []).map((row) => ({
        kind: row.kind,
        filename: row.filename,
        extractedText: row.extracted_text ?? null,
      })),
    });
    const world = assessWorld({
      country: org.country,
      industry: org.industry,
      vendors: vendorMap,
      ai,
      assessments,
      exposure,
      packageCount: github?.packages.length ?? 0,
    });
    const exposureJoined = exposure
      ? withJoinedHostnames(
          exposure,
          vendorMap.vendors.map((item) => item.name),
        )
      : null;
    const integrity = assessIntegrity({
      country: org.country,
      industry: org.industry,
      privacyPolicyUrl: website?.privacyPolicyUrl ?? null,
      privacyPolicyExcerpt: website?.privacyPolicyExcerpt ?? null,
      githubConnected: Boolean(github?.connected),
      relatedOrgs: github?.relatedOrgs ?? [],
      vendors: vendorMap,
      ai,
      finance,
      assessments,
    });
    const claims = assessClaims({
      attested: parseAttestedClaims(claimsAsset?.metadata),
      observed: observedClaims,
      industry: org.industry,
    });
    const acquisition = assessAcquisition({
      organizationId,
      name: org.name,
      country: org.country,
      website,
      github,
      exposure,
      claims,
      documents: (vaultDocs ?? []).map((row) => ({
        kind: row.kind,
        filename: row.filename,
        sha256: row.sha256,
        created_at: row.created_at,
        extractedText: row.extracted_text ?? null,
      })),
      githubToken: Boolean(options?.githubToken),
      digger,
      integrity,
    });
    const kenyaRuns = runKenyaConnectors({
      organizationId,
      name: org.name,
      country: org.country,
      websiteHostname: website?.hostname ?? null,
      websiteHttps: website?.https ?? null,
      websiteReachable: Boolean(website?.reachable),
      storyPageCount: website?.storyPages.length ?? 0,
      githubLogin: github && !github.error ? github.login : null,
      documents: (vaultDocs ?? []).map((row) => ({
        kind: row.kind,
        filename: row.filename,
        sha256: row.sha256,
        extractedText: row.extracted_text ?? null,
      })),
    });
    await isolate(async () => {
      await persistAcquisition(supabase, organizationId, acquisition, kenyaRuns);
      await persistDigger(supabase, organizationId, digger);
      return true;
    }, false);

    for (const vendor of vendorMap.vendors) {
      const existing = (vendorAssets ?? []).find((row) => {
        const meta = row.metadata as { vendorId?: string } | null;
        return meta?.vendorId === vendor.id;
      });
      const metadata: Json = {
        vendorId: vendor.id,
        category: vendor.category,
        processesData: vendor.processesData,
        connectsToProduction: vendor.connectsToProduction,
        dataClasses: vendor.dataClasses,
        origin: vendor.origin,
        sources: vendor.sources,
        risk: vendor.risk,
        reason: vendor.reason,
      };
      if (existing) {
        await supabase
          .from("assets")
          .update({
            name: vendor.name,
            criticality: vendor.criticality,
            metadata,
          })
          .eq("id", existing.id);
      } else {
        await supabase.from("assets").insert({
          organization_id: organizationId,
          name: vendor.name,
          type: "vendor",
          criticality: vendor.criticality,
          metadata,
        });
      }
    }

    for (const system of ai.systems) {
      const existing = (aiAssets ?? []).find((row) => {
        const meta = row.metadata as { systemId?: string } | null;
        return meta?.systemId === system.id;
      });
      const metadata: Json = {
        systemId: system.id,
        category: system.category,
        processesData: system.processesData,
        origin: system.origin,
        sources: system.sources,
      };
      if (existing) {
        await supabase
          .from("assets")
          .update({ name: system.name, criticality: "high", metadata })
          .eq("id", existing.id);
      } else {
        await supabase.from("assets").insert({
          organization_id: organizationId,
          name: system.name,
          type: "ai",
          criticality: "high",
          metadata,
        });
      }
    }

    const { data: catalog } = await supabase.from("regulations").select("*");
    const byCode = new Map((catalog ?? []).map((row) => [row.code, row]));

    for (const assessment of assessments) {
      const row = byCode.get(assessment.code);
      if (!row) continue;
      await supabase.from("organization_regulations").upsert(
        {
          organization_id: organizationId,
          regulation_id: row.id,
          applicability: "applicable",
          notes: `Coverage ${assessment.coverage}% of observable evidence`,
        },
        { onConflict: "organization_id,regulation_id" },
      );
    }

    const drafts = buildRisks({
      website,
      github,
      exposure: exposureJoined,
      assessments,
      vendors: vendorMap,
      finance,
      ai,
      world,
      claims,
      country: org.country,
      industry: org.industry,
    });

    const graph = buildRiskGraph({
      company: {
        name: org.name,
        country: org.country,
        industry: org.industry,
      },
      website,
      github,
      assessments,
      vendors: vendorMap,
      ai,
      world,
      claims,
      risks: drafts,
      acquisition,
    });

    for (const draft of drafts) {
      const { data: existing } = await supabase
        .from("risks")
        .select("id, status, fingerprint, title, severity, validation_status, validated_at")
        .eq("organization_id", organizationId)
        .eq("fingerprint", draft.fingerprint)
        .maybeSingle();

      const preserved =
        existing?.status === "accepted" ||
        existing?.status === "acknowledged" ||
        existing?.status === "in_progress"
          ? existing.status
          : "open";
      const humanValidated = Boolean(existing?.validated_at);
      const validationStatus = humanValidated
        ? (existing?.validation_status ?? draft.validation_status ?? "pending")
        : (draft.validation_status ?? "pending");
      if (humanValidated) {
        draft.validation_status = validationStatus;
      }

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
            certainty: draft.certainty ?? "potential",
            why_it_matters: draft.why_it_matters,
            recommendation: draft.recommendation,
            owner_role: draft.owner_role,
            status: preserved,
            validation_status: validationStatus,
            required_document: draft.required_document ?? null,
            ...(humanValidated
              ? {}
              : {
                  intelligence_stage: draft.intelligence_stage ?? "finding",
                  validation_method: draft.validation_method ?? "observed",
                }),
          })
          .eq("id", riskId);
        await supabase
          .from("evidence")
          .delete()
          .eq("risk_id", riskId)
          .neq("source_type", "document");
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
            certainty: draft.certainty ?? "potential",
            why_it_matters: draft.why_it_matters,
            recommendation: draft.recommendation,
            owner_role: draft.owner_role,
            fingerprint: draft.fingerprint,
            validation_status: draft.validation_status ?? "pending",
            intelligence_stage: draft.intelligence_stage ?? "finding",
            validation_method: draft.validation_method ?? "observed",
            required_document: draft.required_document ?? null,
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

      if (draft.action && preserved !== "accepted") {
        const { data: existingAction } = await supabase
          .from("actions")
          .select("id")
          .eq("organization_id", organizationId)
          .eq("risk_id", riskId)
          .in("status", ["open", "in_progress"])
          .maybeSingle();

        if (!existingAction) {
          await supabase.from("actions").insert({
            organization_id: organizationId,
            risk_id: riskId,
            title: draft.action.title,
            owner_role: draft.action.owner_role,
            priority: draft.action.priority,
            deadline: slaDeadlineIso(draft.action.priority),
          });
        }
      }
    }

    const currentFingerprints = new Set(drafts.map((draft) => draft.fingerprint));
    for (const row of previousOpen.data ?? []) {
      if (currentFingerprints.has(row.fingerprint)) continue;
      await supabase
        .from("risks")
        .update({ status: "resolved", scan_id: scan.id })
        .eq("id", row.id);
    }

    const score = scoreFromRisks(drafts);
    const truthScore = buildTruthScore({
      riskOverall: score.overall,
      cyber: score.cybersecurity,
      regulatory: score.regulatory,
      operational: score.operational,
      vendor: score.vendor,
      financial: score.financial,
      data: score.data,
      acquisition,
      health: finance.health,
      conflictCount: acquisition.conflicts.length,
    });
    const sectorPack = packForIndustry(org.industry);
    await supabase
      .from("organizations")
      .update({ sector_pack: sectorPack.id, updated_at: new Date().toISOString() })
      .eq("id", organizationId);
    const trust = buildTrustProfile({
      risk: score.overall,
      claims,
      integrity,
      risks: drafts,
    });
    const previousFindings = (previousOpen.data ?? []).map((row) => ({
      fingerprint: row.fingerprint,
      title: row.title,
      severity: row.severity as Severity,
    }));
    const snapshot = buildSnapshot({
      website: website?.hostname ?? null,
      github: github?.login ?? null,
      overall: score.overall,
      repos: github?.repos.map((repo) => repo.fullName) ?? [],
      packages: github?.packages ?? [],
      vendors: vendorMap,
      regulations: assessments,
      ai,
      exposure: exposureJoined,
      findings: drafts.map((draft) => ({
        fingerprint: draft.fingerprint,
        title: draft.title,
        severity: draft.severity,
      })),
    });
    const previousSummary = previousScan.data?.summary as ScanSummarySlice | null | undefined;
    const changes = diffSnapshots({
      previousScanId: previousScan.data?.id ?? null,
      previous: previousScan.data
        ? snapshotFromSummary(previousSummary, previousFindings)
        : null,
      current: snapshot,
    });
    const alerts = significantChanges(changes);
    if (alerts.length) {
      await supabase.from("assets").insert(
        alerts.map((change) => ({
          organization_id: organizationId,
          name: change.title,
          type: "notification",
          criticality: criticalityFor(change),
          metadata: {
            kind: change.kind,
            polarity: change.polarity,
            detail: change.detail,
            href: change.href ?? "/changes",
            scanId: scan.id,
            changeId: change.id,
            read: false,
          } satisfies Json,
        })),
      );
    }

    try {
      const { data: hooks } = await supabase
        .from("assets")
        .select("id, name, metadata")
        .eq("organization_id", organizationId)
        .eq("type", "webhook");
      const payload = webhookPayload({
        event: "scan.completed",
        organization: { id: org.id, slug: org.slug, name: org.name },
        scanId: scan.id,
        overall: score.overall,
        changes,
        alerts,
      });
      await Promise.all(
        (hooks ?? []).map(async (row) => {
          const stored = webhookFromAsset(row);
          if (!stored) return;
          const result = await postWebhook({
            url: stored.url,
            secret: stored.secret,
            payload,
          });
          await supabase
            .from("assets")
            .update({
              metadata: {
                ...((row.metadata as Record<string, unknown>) ?? {}),
                lastStatus: result.status,
                lastError: result.error,
                lastDeliveredAt: new Date().toISOString(),
              },
            })
            .eq("id", row.id);
        }),
      );
    } catch {
      // Delivery must never fail the scan.
    }

    if (monitoring && cadence !== "off") {
      try {
        await supabase
          .from("assets")
          .update({
            metadata: {
              ...((monitoring.metadata as Record<string, unknown>) ?? {}),
              lastScanAt: new Date().toISOString(),
              nextDueAt: computeNextDue(cadence),
            },
          })
          .eq("id", monitoring.id);
      } catch {
        // Cadence stamp must never fail the scan.
      }
    }

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
          regulations: assessments.length,
          regulatory: assessments,
          vendors: vendorMap,
          graph,
          finance,
          ai,
          world,
          integrity,
          claims,
          trust,
          acquisition,
          digger,
          truthScore,
          sectorPack: sectorPack.id,
          overall: score.overall,
          exposure: exposureJoined,
          snapshot,
          changes,
          coverage: {
            pages: website?.storyPages ?? [],
            pageCount: (website?.reachable ? 1 : 0) + (website?.storyPages.length ?? 0),
            reposInspected: github?.repos.length ?? 0,
            publicRepos: github?.publicRepos ?? 0,
            filesInspected: (github?.repos ?? []).reduce(
              (sum, repo) => sum + (repo.fileCount ?? 0),
              0,
            ),
          },
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
