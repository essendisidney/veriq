import { bearerToken, hashApiKey, isShareToken } from "@/lib/api/keys";
import type { Json } from "@/lib/database.types";
import { createAdminClient } from "@/lib/supabase/admin";

function lookupClient() {
  return createAdminClient();
}

export const API_DISCLAIMER =
  "VERIQ is intelligence, not a legal, audit or credit opinion. Final decisions remain with authorised professionals.";

export type ApiFinding = {
  id: string;
  title: string;
  description?: string;
  severity: string;
  category: string;
  confidence: number;
  status?: string;
  why_it_matters: string | null;
  recommendation?: string | null;
  owner_role?: string | null;
  fingerprint?: string;
};

export type ApiRiskPayload = {
  error?: string;
  company?: {
    id: string;
    slug: string;
    name: string;
    country: string;
    industry: string;
  };
  scanned_at?: string | null;
  score?: number | null;
  cybersecurity?: number | null;
  regulatory?: number | null;
  technology?: number | null;
  operational?: number | null;
  vendor?: number | null;
  financial?: number | null;
  data?: number | null;
  ai?: number | null;
  reputation?: number | null;
  findings?: ApiFinding[];
  disclaimer?: string;
};

export type ApiAction = {
  id: string;
  title: string;
  owner_role?: string | null;
  priority: string;
  deadline?: string | null;
  status?: string;
};

export type ApiSnapshotPayload = ApiRiskPayload & {
  pack?: string;
  summary?: Record<string, unknown>;
  actions?: ApiAction[];
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Max-Age": "86400",
};

const WINDOW_MS = 60_000;
const MAX_HITS = 30;
const hits = new Map<string, number[]>();

function rateLimited(key: string) {
  const now = Date.now();
  const stamps = (hits.get(key) ?? []).filter((stamp) => now - stamp < WINDOW_MS);
  if (stamps.length >= MAX_HITS) {
    hits.set(key, stamps);
    return true;
  }
  stamps.push(now);
  hits.set(key, stamps);
  return false;
}

export function apiJson(body: unknown, status = 200, extra?: HeadersInit) {
  return Response.json(body, {
    status,
    headers: {
      ...corsHeaders,
      "Cache-Control": "no-store",
      ...(status === 429 ? { "Retry-After": "60" } : {}),
      ...extra,
    },
  });
}

export function apiOptions() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function loadCompanyRisk(
  authorization: string | null,
  company: string,
): Promise<{ status: number; body: ApiRiskPayload }> {
  const token = bearerToken(authorization);
  if (!token) {
    return { status: 401, body: { error: "unauthorized" } };
  }

  const tokenHash = hashApiKey(token);
  if (rateLimited(tokenHash)) {
    return { status: 429, body: { error: "rate_limited" } };
  }

  const supabase = lookupClient();
  if (!supabase) {
    return { status: 503, body: { error: "misconfigured" } };
  }

  const { data, error } = await supabase.rpc("veriq_api_risk", {
    p_token_hash: tokenHash,
    p_company: company,
  });

  if (error) {
    return { status: 500, body: { error: "lookup_failed" } };
  }

  const payload = (data ?? {}) as ApiRiskPayload;
  if (payload.error === "unauthorized") {
    return { status: 401, body: { error: "unauthorized" } };
  }
  if (payload.error === "forbidden") {
    return { status: 403, body: { error: "forbidden" } };
  }
  if (payload.error) {
    return { status: 400, body: { error: payload.error } };
  }

  return { status: 200, body: { ...payload, disclaimer: API_DISCLAIMER } };
}

export async function loadCompanySnapshot(
  token: string,
  company: string | null,
): Promise<{ status: number; body: ApiSnapshotPayload }> {
  const tokenHash = hashApiKey(token);
  if (rateLimited(tokenHash)) {
    return { status: 429, body: { error: "rate_limited" } };
  }

  const supabase = lookupClient();
  if (!supabase) {
    return { status: 503, body: { error: "misconfigured" } };
  }

  const { data, error } = await supabase.rpc("veriq_api_snapshot", {
    p_token_hash: tokenHash,
    p_company: company ?? "",
  });

  if (error) {
    return { status: 500, body: { error: "lookup_failed" } };
  }

  const payload = (data ?? {}) as ApiSnapshotPayload;
  if (payload.error === "unauthorized") {
    return { status: 401, body: { error: "unauthorized" } };
  }
  if (payload.error === "forbidden") {
    return { status: 403, body: { error: "forbidden" } };
  }
  if (payload.error) {
    return { status: 400, body: { error: payload.error } };
  }

  if (isShareToken(token)) {
    await recordShareOpen(supabase, tokenHash);
  }

  return { status: 200, body: { ...payload, disclaimer: API_DISCLAIMER } };
}

async function recordShareOpen(
  supabase: NonNullable<ReturnType<typeof lookupClient>>,
  tokenHash: string,
) {
  try {
    const { data: row } = await supabase
      .from("assets")
      .select("id, metadata")
      .eq("type", "share_link")
      .contains("metadata", { keyHash: tokenHash })
      .maybeSingle();
    if (!row) return;
    const meta =
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : {};
    const openCount = typeof meta.openCount === "number" ? meta.openCount : 0;
    await supabase
      .from("assets")
      .update({
        metadata: {
          ...meta,
          openCount: openCount + 1,
          lastOpenedAt: new Date().toISOString(),
        } as Json,
      })
      .eq("id", row.id);
  } catch {
    // Viewing the pack must not fail because the open log did not write.
  }
}

export async function loadCompanyAcquisition(
  authorization: string | null,
  company: string,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const { status, body } = await loadCompanyRisk(authorization, company);
  if (status !== 200 || !body.company) {
    return { status, body: { error: body.error ?? "lookup_failed" } };
  }

  const supabase = lookupClient();
  if (!supabase) {
    return { status: 503, body: { error: "misconfigured" } };
  }

  const orgId = body.company.id;
  const [{ data: sources }, { data: entities }, { data: facts }, { data: conflicts }] =
    await Promise.all([
      supabase
        .from("veriq_source_runs")
        .select("source_id, registry_status, observed, note, evidence_count, ran_at")
        .eq("organization_id", orgId)
        .order("source_id"),
      supabase
        .from("veriq_entities")
        .select("entity_key, kind, label, keys, related_keys")
        .eq("organization_id", orgId)
        .limit(80),
      supabase
        .from("veriq_facts")
        .select("claim, value, connector_id, source_type, confidence, access_method, observed_at, amount_minor, currency")
        .eq("organization_id", orgId)
        .order("observed_at", { ascending: false })
        .limit(100),
      supabase
        .from("veriq_fact_conflicts")
        .select("claim, why, variance_pct, left_value, right_value, validation_status")
        .eq("organization_id", orgId)
        .limit(40),
    ]);

  return {
    status: 200,
    body: {
      company: body.company,
      sources: sources ?? [],
      entities: entities ?? [],
      facts: facts ?? [],
      conflicts: conflicts ?? [],
      disclaimer: API_DISCLAIMER,
      note: "This is authorised coverage, not a BRS scrape. Missing sources stay to_connect.",
    },
  };
}

export async function loadCompanyRelationships(
  authorization: string | null,
  company: string,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const { status, body } = await loadCompanyRisk(authorization, company);
  if (status !== 200 || !body.company) {
    return { status, body: { error: body.error ?? "lookup_failed" } };
  }
  const supabase = lookupClient();
  if (!supabase) return { status: 503, body: { error: "misconfigured" } };
  const orgId = body.company.id;
  const [{ data: entities }, { data: edges }] = await Promise.all([
    supabase
      .from("veriq_entities")
      .select("entity_key, kind, label, related_keys")
      .eq("organization_id", orgId)
      .limit(120),
    supabase
      .from("veriq_edges")
      .select("from_key, to_key, kind, confidence, validation_status, why")
      .eq("organization_id", orgId)
      .limit(200),
  ]);
  return {
    status: 200,
    body: {
      company: body.company,
      entities: entities ?? [],
      edges: edges ?? [],
      disclaimer: API_DISCLAIMER,
      note: "People from the website are unverified. Related-party edges require human validation.",
    },
  };
}

export async function loadCompanyConflicts(
  authorization: string | null,
  company: string,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const { status, body } = await loadCompanyRisk(authorization, company);
  if (status !== 200 || !body.company) {
    return { status, body: { error: body.error ?? "lookup_failed" } };
  }
  const supabase = lookupClient();
  if (!supabase) return { status: 503, body: { error: "misconfigured" } };
  const { data: conflicts } = await supabase
    .from("veriq_fact_conflicts")
    .select("claim, why, variance_pct, left_value, right_value, validation_status, created_at")
    .eq("organization_id", body.company.id)
    .limit(80);
  return {
    status: 200,
    body: {
      company: body.company,
      conflicts: conflicts ?? [],
      disclaimer: API_DISCLAIMER,
      note: "A contradiction is two evidenced values that disagree. It is not a fraud finding.",
    },
  };
}

export async function loadCompanyFinancialHealth(
  authorization: string | null,
  company: string,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const token = bearerToken(authorization);
  if (!token) {
    return { status: 401, body: { error: "unauthorized" } };
  }
  const { status, body } = await loadCompanySnapshot(token, company);
  if (status !== 200) {
    return { status, body: { error: body.error ?? "lookup_failed" } };
  }
  const summary = (body.summary ?? {}) as {
    finance?: { health?: unknown };
    truthScore?: unknown;
  };
  const health = summary.finance && typeof summary.finance === "object"
    ? (summary.finance as { health?: { ratios?: { status: string }[] } }).health
    : null;
  const computed = health?.ratios?.filter((row) => row.status === "computed").length ?? 0;
  if (!computed) {
    return {
      status: 200,
      body: {
        company: body.company,
        health: null,
        error: "insufficient_facts",
        note: "Financial health is published only when authorised documents yielded extractable amounts. UNKNOWN is not zero.",
        disclaimer: API_DISCLAIMER,
      },
    };
  }
  return {
    status: 200,
    body: {
      company: body.company,
      health,
      truthScore: summary.truthScore ?? null,
      disclaimer: API_DISCLAIMER,
    },
  };
}

/** Composite organisational verify pack — evidence only, never invented. */
export async function loadCompanyVerify(
  authorization: string | null,
  company: string,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const token = bearerToken(authorization);
  if (!token) {
    return { status: 401, body: { error: "unauthorized" } };
  }
  const { status, body } = await loadCompanySnapshot(token, company);
  if (status !== 200 || !body.company) {
    return { status, body: { error: body.error ?? "lookup_failed" } };
  }
  const [relationships, conflicts, financial, risk] = await Promise.all([
    loadCompanyRelationships(authorization, company),
    loadCompanyConflicts(authorization, company),
    loadCompanyFinancialHealth(authorization, company),
    loadCompanyRisk(authorization, company),
  ]);
  const summary = (body.summary ?? {}) as {
    truthScore?: unknown;
    governance?: unknown;
    acquisition?: { coverage?: number; confidence?: unknown };
    digger?: { people?: unknown[]; summary?: string };
  };
  return {
    status: 200,
    body: {
      company: body.company,
      risk: {
        overall: risk.body.score ?? body.score ?? null,
        findings: risk.body.findings ?? [],
      },
      coverage: summary.acquisition?.coverage ?? null,
      confidence: summary.acquisition?.confidence ?? null,
      truthScore: summary.truthScore ?? null,
      governance: summary.governance ?? null,
      relationships: relationships.body.edges ?? [],
      entities: relationships.body.entities ?? [],
      conflicts: conflicts.body.conflicts ?? [],
      financialHealth: financial.body.health ?? null,
      financialError: financial.body.error ?? null,
      digger: summary.digger?.summary ?? null,
      disclaimer: API_DISCLAIMER,
      note: "Verify is a composite of evidenced surfaces. UNKNOWN stays UNKNOWN. Not a KYB clearance or credit opinion.",
    },
  };
}

export async function loadInstitutionalPack(
  authorization: string | null,
  company: string,
  kind: "diligence" | "credit" | "restructuring",
): Promise<{ status: number; body: Record<string, unknown> }> {
  const token = bearerToken(authorization);
  if (!token) {
    return { status: 401, body: { error: "unauthorized" } };
  }

  const { status, body } = await loadCompanySnapshot(token, company);
  if (status !== 200) {
    return { status, body: { error: body.error } };
  }

  const pack = body.pack ?? "full";
  if (pack !== "full" && pack !== kind) {
    return { status: 403, body: { error: "wrong_pack" } };
  }

  const { reportFromSnapshot } = await import("@/lib/reports/from-snapshot");
  const report = reportFromSnapshot(kind, body);
  if (!report) {
    return { status: 404, body: { error: "no_snapshot" } };
  }

  return { status: 200, body: report as unknown as Record<string, unknown> };
}
