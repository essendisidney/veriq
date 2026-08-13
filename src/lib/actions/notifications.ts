"use server";

import { createClient } from "@/lib/supabase/server";

export async function markNotificationRead(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: row } = await supabase
    .from("assets")
    .select("id, metadata")
    .eq("id", id)
    .eq("type", "notification")
    .maybeSingle();
  if (!row) return { error: "Notification not found" };

  const metadata =
    row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
      ? { ...(row.metadata as Record<string, unknown>), read: true }
      : { read: true };

  const { error } = await supabase.from("assets").update({ metadata }).eq("id", row.id);
  if (error) return { error: error.message };
  return { ok: true };
}

export async function markAllNotificationsRead(organizationId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: rows } = await supabase
    .from("assets")
    .select("id, metadata")
    .eq("organization_id", organizationId)
    .eq("type", "notification");

  for (const row of rows ?? []) {
    const meta =
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? (row.metadata as { read?: boolean })
        : {};
    if (meta.read) continue;
    const { error } = await supabase
      .from("assets")
      .update({
        metadata: { ...meta, read: true },
      })
      .eq("id", row.id);
    if (error) return { error: error.message };
  }

  return { ok: true };
}
