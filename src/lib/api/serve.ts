import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { bearerToken, hashApiKey } from "@/lib/api/keys";

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

export type ApiSnapshotPayload = ApiRiskPayload & {
  pack?: string;
  summary?: Record<string, unknown>;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
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

  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

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

  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

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

  return { status: 200, body: { ...payload, disclaimer: API_DISCLAIMER } };
}

export async function loadInstitutionalPack(
  authorization: string | null,
  company: string,
  kind: "diligence" | "credit",
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
