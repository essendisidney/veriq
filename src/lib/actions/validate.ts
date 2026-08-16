"use server";

import { createHash, randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import {
  isDocumentKind,
  isValidationStatus,
  stageFor,
  type DocumentKind,
  type ValidationStatus,
} from "@/lib/risk/validate";
import type { Certainty } from "@/lib/database.types";

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "text/plain",
  "text/csv",
]);

async function memberClient(organizationId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" as const };
  const { data: membership } = await supabase
    .from("memberships")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) return { error: "Not a member of this company" as const };
  return { supabase, user };
}

export async function uploadEvidenceDocument(formData: FormData) {
  const organizationId = String(formData.get("organizationId") ?? "");
  const riskId = String(formData.get("riskId") ?? "");
  const kindRaw = String(formData.get("kind") ?? "other");
  const file = formData.get("file");
  if (!organizationId || !riskId) return { error: "Missing finding" };
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a file" };
  if (file.size > MAX_BYTES) return { error: "File is larger than 10 MB" };
  const mime = file.type || "application/octet-stream";
  if (!ALLOWED_MIME.has(mime)) {
    return { error: "Upload a PDF, image, CSV or text artefact" };
  }
  const kind: DocumentKind = isDocumentKind(kindRaw) ? kindRaw : "other";

  const auth = await memberClient(organizationId);
  if ("error" in auth) return auth;
  const { supabase, user } = auth;

  const { data: risk } = await supabase
    .from("risks")
    .select("id, organization_id")
    .eq("id", riskId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!risk) return { error: "Finding not found" };

  const bytes = Buffer.from(await file.arrayBuffer());
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(0, 80) || "artefact";
  const path = `${organizationId}/${riskId}/${randomUUID()}-${safeName}`;

  const uploaded = await supabase.storage.from("evidence").upload(path, bytes, {
    contentType: mime,
    upsert: false,
  });
  if (uploaded.error) return { error: uploaded.error.message };

  const { error } = await supabase.from("evidence_documents").insert({
    organization_id: organizationId,
    risk_id: riskId,
    kind,
    filename: file.name.slice(0, 200),
    mime,
    byte_size: file.size,
    sha256,
    storage_path: path,
    uploaded_by: user.id,
  });
  if (error) return { error: error.message };

  await supabase.from("evidence").insert({
    organization_id: organizationId,
    risk_id: riskId,
    source_type: "document",
    source_reference: path,
    content: `Uploaded ${kind}: ${file.name} (sha256 ${sha256.slice(0, 12)}…). VERIQ stored the artefact. It did not read cash, directors or a legal opinion from the file.`,
    confidence: 90,
    trust_status: "observed",
  });

  return { ok: true, sha256 };
}

export async function validateFinding(input: {
  organizationId: string;
  riskId: string;
  status: string;
  note: string;
}) {
  const auth = await memberClient(input.organizationId);
  if ("error" in auth) return auth;
  const { supabase, user } = auth;
  if (!isValidationStatus(input.status) || input.status === "pending") {
    return { error: "Choose a validation result" };
  }
  const next = input.status as ValidationStatus;

  const { data: risk } = await supabase
    .from("risks")
    .select("id, certainty, status, validation_status")
    .eq("id", input.riskId)
    .eq("organization_id", input.organizationId)
    .maybeSingle();
  if (!risk) return { error: "Finding not found" };

  const fromStatus = (risk.validation_status ?? "pending") as ValidationStatus;
  const certainty = (risk.certainty ?? "potential") as Certainty;
  const stage = stageFor(certainty, next);
  const nextRiskStatus =
    next === "disproved"
      ? "accepted"
      : next === "confirmed" || next === "partially_confirmed"
        ? "acknowledged"
        : risk.status;

  const { error } = await supabase
    .from("risks")
    .update({
      validation_status: next,
      intelligence_stage: stage,
      validation_method: "human",
      validated_at: new Date().toISOString(),
      validated_by: user.id,
      status: nextRiskStatus,
    })
    .eq("id", input.riskId);
  if (error) return { error: error.message };

  await supabase.from("validation_events").insert({
    organization_id: input.organizationId,
    risk_id: input.riskId,
    from_status: fromStatus,
    to_status: next,
    note: input.note.trim().slice(0, 2000) || null,
    actor: user.id,
  });

  return { ok: true };
}
