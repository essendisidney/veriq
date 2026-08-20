export type JsonLdPerson = {
  name: string;
  role: string;
};

function asArray<T>(value: T | T[] | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function nodesFrom(value: unknown): Record<string, unknown>[] {
  if (!value || typeof value !== "object") return [];
  const row = value as Record<string, unknown>;
  if (Array.isArray(row["@graph"])) {
    return row["@graph"].filter((item) => item && typeof item === "object") as Record<
      string,
      unknown
    >[];
  }
  return [row];
}

export function peopleFromJsonLd(html: string): JsonLdPerson[] {
  const people: JsonLdPerson[] = [];
  const seen = new Set<string>();
  for (const match of html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      const parsed = JSON.parse(match[1] ?? "") as unknown;
      for (const node of asArray(parsed).flatMap(nodesFrom)) {
        const type = String(node["@type"] ?? "");
        if (!/person/i.test(type)) continue;
        const name = String(node.name ?? "").trim();
        const role = String(node.jobTitle ?? node.role ?? "Named person").trim();
        if (name.split(" ").length < 2) continue;
        const key = name.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        people.push({ name, role: role.slice(0, 80) });
      }
    } catch {
      // Company JSON-LD is often messy. Skip the block.
    }
  }
  return people.slice(0, 12);
}
