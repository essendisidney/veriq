"use server";

import { createHash, randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { extractDocumentText } from "@/lib/acquire/extract";
import { DOCUMENT_KINDS, isDocumentKind, type DocumentKind } from "@/lib/risk/validate";

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "text/plain",
  "text/csv",
]);

export { DOCUMENT_KINDS };

export async function ingestVaultDocument(formData: FormData) {
  const organizationId = String(formData.get("organizationId") ?? "");
  const kindRaw = String(formData.get("kind") ?? "other");
  const file = formData.get("file");
  if (!organizationId) return { error: "Choose a company" };
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a file" };
  if (file.size > MAX_BYTES) return { error: "File is larger than 10 MB" };
  const mime = file.type || "application/octet-stream";
  if (!ALLOWED_MIME.has(mime)) {
    return { error: "Upload a PDF, image, CSV or text artefact" };
  }
  const kind: DocumentKind = isDocumentKind(kindRaw) ? kindRaw : "other";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  const { data: membership } = await supabase
    .from("memberships")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) return { error: "Not a member of this company" };

  const bytes = Buffer.from(await file.arrayBuffer());
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const extracted = extractDocumentText(bytes, mime);
  const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(0, 80) || "artefact";
  const path = `${organizationId}/vault/${randomUUID()}-${safeName}`;

  const uploaded = await supabase.storage.from("evidence").upload(path, bytes, {
    contentType: mime,
    upsert: false,
  });
  if (uploaded.error) return { error: uploaded.error.message };

  const { error } = await supabase.from("evidence_documents").insert({
    organization_id: organizationId,
    risk_id: null,
    kind,
    filename: file.name.slice(0, 200),
    mime,
    byte_size: file.size,
    sha256,
    storage_path: path,
    extracted_text: extracted.text || null,
    extraction_status: extracted.status,
    uploaded_by: user.id,
  });
  if (error) return { error: error.message };

  return {
    ok: true as const,
    kind,
    extraction: extracted.status,
    note:
      extracted.status === "extracted"
        ? "Text layer stored as evidence. Rescan to graph it. VERIQ did not invent directors from the file."
        : extracted.status === "no_text_layer"
          ? "No searchable text layer. A scanned CR12 stays an artefact until OCR is connected or you attest the facts."
          : "Image stored. Optical character recognition is not connected yet.",
  };
}
