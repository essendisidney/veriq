"use server";

import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/database.types";
import { assertPublicHttpsUrl } from "@/lib/webhooks/ssrf";
import {
  generateWebhookSecret,
  postWebhook,
  webhookFromAsset,
  webhookPayload,
} from "@/lib/webhooks/deliver";
import { computeNextDue, parseCadence } from "@/lib/webhooks/cadence";

const MAX_HOOKS = 3;

export async function createOrgWebhook(input: {
  organizationId: string;
  name: string;
  url: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const allowed = await assertPublicHttpsUrl(input.url);
  if ("error" in allowed) return { error: allowed.error };

  const { data: existing } = await supabase
    .from("assets")
    .select("id")
    .eq("organization_id", input.organizationId)
    .eq("type", "webhook");
  if ((existing ?? []).length >= MAX_HOOKS) {
    return { error: "Maximum of 3 webhooks per organisation" };
  }

  const generated = generateWebhookSecret();
  const name = input.name.trim() || "Webhook";
  const metadata: Json = {
    url: allowed.url.toString(),
    secret: generated.secret,
    secretHash: generated.hash,
    prefix: generated.prefix,
    enabled: true,
    createdAt: new Date().toISOString(),
  };
  const { error } = await supabase.from("assets").insert({
    organization_id: input.organizationId,
    name,
    type: "webhook",
    criticality: "high",
    metadata,
  });
  if (error) return { error: error.message };
  return { secret: generated.secret, prefix: generated.prefix };
}

export async function revokeOrgWebhook(input: { organizationId: string; id: string }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("assets")
    .delete()
    .eq("id", input.id)
    .eq("organization_id", input.organizationId)
    .eq("type", "webhook");
  if (error) return { error: error.message };
  return { ok: true };
}

export async function testOrgWebhook(input: { organizationId: string; id: string }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const [{ data: hook }, { data: org }] = await Promise.all([
    supabase
      .from("assets")
      .select("id, name, metadata")
      .eq("id", input.id)
      .eq("organization_id", input.organizationId)
      .eq("type", "webhook")
      .maybeSingle(),
    supabase.from("organizations").select("id, slug, name").eq("id", input.organizationId).single(),
  ]);
  const stored = hook ? webhookFromAsset(hook) : null;
  if (!hook || !stored || !org) return { error: "Webhook not found" };

  const result = await postWebhook({
    url: stored.url,
    secret: stored.secret,
    payload: webhookPayload({
      event: "webhook.test",
      organization: org,
    }),
  });
  await supabase
    .from("assets")
    .update({
      metadata: {
        ...((hook.metadata as Record<string, unknown>) ?? {}),
        lastStatus: result.status,
        lastError: result.error,
        lastDeliveredAt: new Date().toISOString(),
      },
    })
    .eq("id", hook.id);
  if (result.error) return { error: result.error };
  return { ok: true, status: result.status };
}

export async function saveScanCadence(input: {
  organizationId: string;
  cadence: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const cadence = parseCadence(input.cadence);
  const { data: existing } = await supabase
    .from("assets")
    .select("id, metadata")
    .eq("organization_id", input.organizationId)
    .eq("type", "monitoring")
    .eq("name", "Monitoring")
    .maybeSingle();
  const prior = (existing?.metadata as { lastScanAt?: string } | null) ?? {};
  const metadata: Json = {
    ...((existing?.metadata as Record<string, unknown>) ?? {}),
    cadence,
    nextDueAt: prior.lastScanAt
      ? computeNextDue(cadence, new Date(prior.lastScanAt))
      : cadence === "off"
        ? null
        : new Date().toISOString(),
  };
  if (existing) {
    const { error } = await supabase.from("assets").update({ metadata }).eq("id", existing.id);
    if (error) return { error: error.message };
    return { ok: true };
  }
  const { error } = await supabase.from("assets").insert({
    organization_id: input.organizationId,
    name: "Monitoring",
    type: "monitoring",
    criticality: "medium",
    metadata,
  });
  if (error) return { error: error.message };
  return { ok: true };
}
