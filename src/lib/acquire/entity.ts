import type { EntityKind, ResolvedEntity } from "./types";

const LEGAL_NOISE =
  /\b(limited|ltd|plc|llc|inc|incorporated|company|co|group|holdings|kenya|the|public)\b/gi;

export function normalizeName(value: string) {
  return value
    .toLowerCase()
    .replace(LEGAL_NOISE, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function entityId(kind: EntityKind, country: string, key: string) {
  const slug = normalizeName(key).replace(/\s+/g, "-").slice(0, 80) || "unknown";
  return `vq:${country.toLowerCase()}:${kind}:${slug}`;
}

export function mergeEntities(rows: ResolvedEntity[]) {
  const byId = new Map<string, ResolvedEntity>();
  for (const row of rows) {
    const existing = byId.get(row.id);
    if (!existing) {
      byId.set(row.id, { ...row, keys: [...row.keys], related: [...row.related] });
      continue;
    }
    existing.keys = [...new Set([...existing.keys, ...row.keys])];
    existing.related = [...new Set([...existing.related, ...row.related])];
    if (row.label.length > existing.label.length) existing.label = row.label;
  }
  return [...byId.values()];
}

export function linkIfShared(a: ResolvedEntity, b: ResolvedEntity) {
  if (a.id === b.id) return;
  const shared = a.keys.some((key) => b.keys.includes(key) && key.length >= 5);
  if (!shared) return;
  if (!a.related.includes(b.id)) a.related.push(b.id);
  if (!b.related.includes(a.id)) b.related.push(a.id);
}

export function relatedCompanyHint(leftName: string, rightName: string) {
  const a = normalizeName(leftName);
  const b = normalizeName(rightName);
  if (!a || !b || a === b) return false;
  const aParts = new Set(a.split(" ").filter((part) => part.length >= 3));
  const hits = b.split(" ").filter((part) => aParts.has(part)).length;
  return hits >= 2;
}
