export type ExtractedOfficer = {
  name: string;
  role: "director" | "shareholder";
  excerpt: string;
};

const SECTION =
  /(?:^|\n)\s*(?:list of\s+)?(directors?|shareholders?|members? of the board|board of directors)\b[^\n]*\n([\s\S]{20,4000}?)(?=\n\s*(?:shareholders?|directors?|registered office|particulars|capital|secretar|beneficial|persons with significant|psc\b|end of|page \d)|$)/gi;

const NAME_LINE =
  /^(?:\d+[\).\]]\s*|[•\-–]\s*)?([A-Z][A-Za-z'’.\-]+(?:\s+[A-Z][A-Za-z'’.\-]+){1,5})(?:\s*[,–\-]\s*(?:director|shareholder|chairman|chairperson|secretary|ceo|managing director))?\.?\s*$/i;

const NOISE =
  /^(name|full name|nationality|id|pin|id\/passport|shares|class|address|occupation|date|appointed|ceased|particulars|company|limited|ltd|plc|page|of|and|the)$/i;

function cleanName(raw: string) {
  return raw
    .replace(/\s+/g, " ")
    .replace(/[,;:]+$/g, "")
    .trim();
}

function looksLikePerson(name: string) {
  const parts = name.split(" ").filter(Boolean);
  if (parts.length < 2 || parts.length > 6) return false;
  if (parts.some((part) => NOISE.test(part))) return false;
  if (/\d/.test(name)) return false;
  if (/limited|ltd|plc|llc|company|holdings|kenya/i.test(name)) return false;
  return parts.every((part) => /^[A-Za-z'’.\-]{2,}$/.test(part));
}

/** Parse searchable CR12 / company-extract text only. Never invents officers from filenames or OCR. */
export function extractOfficersFromText(text: string | null | undefined): ExtractedOfficer[] {
  if (!text || text.trim().length < 40) return [];
  const found: ExtractedOfficer[] = [];
  const seen = new Set<string>();

  for (const match of text.matchAll(SECTION)) {
    const heading = (match[1] ?? "").toLowerCase();
    const role: ExtractedOfficer["role"] = heading.includes("shareholder")
      ? "shareholder"
      : "director";
    const body = match[2] ?? "";
    for (const line of body.split(/\n+/)) {
      const trimmed = line.replace(/\s+/g, " ").trim();
      if (trimmed.length < 5 || trimmed.length > 90) continue;
      const hit = trimmed.match(NAME_LINE);
      if (!hit) continue;
      const name = cleanName(hit[1]);
      if (!looksLikePerson(name)) continue;
      const key = `${role}:${name.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      found.push({
        name,
        role,
        excerpt: trimmed.slice(0, 160),
      });
      if (found.length >= 24) return found;
    }
  }

  // Fallback: labelled rows like "Director: Jane Wanjiku"
  for (const match of text.matchAll(
    /\b(director|shareholder)\s*[:\-–]\s*([A-Z][A-Za-z'’.\-]+(?:\s+[A-Z][A-Za-z'’.\-]+){1,4})/gi,
  )) {
    const role = match[1].toLowerCase().startsWith("share")
      ? ("shareholder" as const)
      : ("director" as const);
    const name = cleanName(match[2]);
    if (!looksLikePerson(name)) continue;
    const key = `${role}:${name.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    found.push({ name, role, excerpt: match[0].slice(0, 160) });
    if (found.length >= 24) break;
  }

  return found;
}
