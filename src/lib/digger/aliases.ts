import { normalizeName } from "@/lib/acquire/entity";

export function companyAliases(name: string) {
  const base = normalizeName(name);
  if (!base) return [];
  const words = base.split(" ").filter(Boolean);
  const compact = words.join("");
  return [...new Set([name.trim(), `${base} limited`, `${base} ltd`, `${base} group`, compact])].filter(
    (item) => item.length >= 3,
  );
}

export function namesLikelySame(left: string, right: string) {
  const a = normalizeName(left);
  const b = normalizeName(right);
  if (!a || !b) return false;
  if (a === b) return true;
  return a.includes(b) || b.includes(a);
}
