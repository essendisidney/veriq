import type { DiggerPerson } from "./types";

const ROLE =
  /(chief executive|ceo|managing director|director|founder|co-founder|chair|chairman|chairperson|cfo|cto|coo)/i;

export function extractPeople(url: string, html: string): DiggerPerson[] {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " | ")
    .replace(/\s+/g, " ");
  const people: DiggerPerson[] = [];
  const seen = new Set<string>();
  const re =
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\s*[|,–-]\s*([^|]{0,60}?(?:Chief Executive|CEO|Managing Director|Director|Founder|Chair(?:man|person)?|CFO|CTO|COO)[^|]{0,40})/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    const name = match[1]!.trim();
    const role = match[2]!.trim();
    if (!ROLE.test(role) || name.length < 5) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    people.push({
      name,
      role: role.slice(0, 80),
      url,
      verdict: "unverified",
      why: "Named on the company's own page. Not a CR12 director. LinkedIn is not scraped.",
    });
  }
  return people.slice(0, 12);
}
