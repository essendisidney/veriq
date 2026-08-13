import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { hashApiKey } from "@/lib/api/keys";
import { assertPublicHttpsUrl } from "@/lib/webhooks/ssrf";
import type { ChangeItem, ChangeSet } from "@/lib/changes/diff";
import type { Json } from "@/lib/database.types";

export const WEBHOOK_SECRET_PREFIX = "vq_hook_";

export type WebhookPayload = {
  event: "scan.completed" | "webhook.test";
  organization: { id: string; slug: string; name: string };
  scanId: string | null;
  overall: number | null;
  changes: { added: number; removed: number; changed: number; summary: string };
  alerts: { title: string; kind: string; polarity: string; href?: string }[];
  generatedAt: string;
};

export function generateWebhookSecret() {
  const secret = `${WEBHOOK_SECRET_PREFIX}${randomBytes(32).toString("base64url")}`;
  return {
    secret,
    hash: hashApiKey(secret),
    prefix: secret.slice(0, 16),
  };
}

export function signWebhookBody(secret: string, body: string) {
  return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
}

export function webhookPayload(input: {
  event: WebhookPayload["event"];
  organization: { id: string; slug: string; name: string };
  scanId?: string | null;
  overall?: number | null;
  changes?: ChangeSet | null;
  alerts?: ChangeItem[];
}): WebhookPayload {
  return {
    event: input.event,
    organization: input.organization,
    scanId: input.scanId ?? null,
    overall: input.overall ?? null,
    changes: {
      added: input.changes?.added ?? 0,
      removed: input.changes?.removed ?? 0,
      changed: input.changes?.changed ?? 0,
      summary: input.changes?.summary ?? "No comparison on this event.",
    },
    alerts: (input.alerts ?? []).map((item) => ({
      title: item.title,
      kind: item.kind,
      polarity: item.polarity,
      href: item.href,
    })),
    generatedAt: new Date().toISOString(),
  };
}

export async function postWebhook(input: {
  url: string;
  secret: string;
  payload: WebhookPayload;
}): Promise<{ status: number | null; error: string | null }> {
  const allowed = await assertPublicHttpsUrl(input.url);
  if ("error" in allowed) return { status: null, error: allowed.error };

  const body = JSON.stringify(input.payload);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(allowed.url, {
      method: "POST",
      redirect: "manual",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        "user-agent": "VERIQ-Webhook/0.1",
        "x-veriq-event": input.payload.event,
        "x-veriq-delivery": randomUUID(),
        "x-veriq-signature": signWebhookBody(input.secret, body),
      },
      body,
    });
    if (response.status >= 300 && response.status < 400) {
      return { status: response.status, error: "Redirects are not followed" };
    }
    if (!response.ok) {
      return { status: response.status, error: `HTTP ${response.status}` };
    }
    return { status: response.status, error: null };
  } catch (error) {
    return {
      status: null,
      error: error instanceof Error ? error.message : "Delivery failed",
    };
  } finally {
    clearTimeout(timer);
  }
}

export type StoredWebhook = {
  id: string;
  name: string;
  url: string;
  secret: string;
  enabled: boolean;
};

export function webhookFromAsset(row: {
  id: string;
  name: string;
  metadata: Json | null;
}): StoredWebhook | null {
  const meta = (row.metadata ?? {}) as {
    url?: string;
    secret?: string;
    enabled?: boolean;
  };
  if (!meta.url || !meta.secret || meta.enabled === false) return null;
  return { id: row.id, name: row.name, url: meta.url, secret: meta.secret, enabled: true };
}
