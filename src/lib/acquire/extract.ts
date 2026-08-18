export type ExtractionStatus = "extracted" | "no_text_layer" | "unsupported" | "pending";

function decodePdfString(raw: string) {
  return raw
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, " ")
    .replace(/\\t/g, " ")
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")")
    .replace(/\\\\/g, "\\")
    .replace(/\\(\d{1,3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)));
}

/** Best-effort text from a searchable PDF. Scanned image PDFs stay no_text_layer — not invented OCR. */
export function extractPdfText(bytes: Uint8Array): string {
  const latin = Buffer.from(bytes).toString("latin1");
  const chunks: string[] = [];
  for (const match of latin.matchAll(/\((?:\\.|[^\\)]){4,}\)/g)) {
    const inner = match[0].slice(1, -1);
    const text = decodePdfString(inner).replace(/[^\x09\x0a\x0d\x20-\x7e\u00a0-\u024f]/g, " ");
    if (/[a-zA-Z]{3,}/.test(text)) chunks.push(text.trim());
  }
  return chunks.join(" ").replace(/\s+/g, " ").trim().slice(0, 20_000);
}

export function extractDocumentText(
  bytes: Uint8Array,
  mime: string,
): { text: string; status: ExtractionStatus } {
  if (mime.startsWith("text/") || mime === "application/csv") {
    const text = Buffer.from(bytes).toString("utf8").replace(/\u0000/g, "").slice(0, 20_000);
    return { text, status: text.trim() ? "extracted" : "no_text_layer" };
  }
  if (mime === "application/pdf") {
    const text = extractPdfText(bytes);
    return { text, status: text.length >= 40 ? "extracted" : "no_text_layer" };
  }
  return {
    text: "",
    status: "unsupported",
  };
}
