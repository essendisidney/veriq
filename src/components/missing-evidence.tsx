import Link from "next/link";
import type { MissingEvidence } from "@/lib/truth/profile";

export function MissingEvidencePanel({
  items,
  href = "/truth",
}: {
  items: MissingEvidence[];
  href?: string;
}) {
  if (!items.length) return null;

  return (
    <section className="rounded-2xl border border-[var(--medium)] bg-[rgba(232,168,73,0.08)] p-6">
      <p className="eyebrow">Missing evidence</p>
      <h2 className="mt-3 font-display text-3xl italic text-[var(--ink)]">
        {items.length} fact{items.length === 1 ? "" : "s"} still UNKNOWN
      </h2>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
        A public website is not a company extract. VERIQ will not scrape BRS, invent directors, or
        fill cash. Upload or attest the artefacts — until then the decision file stays open.
      </p>
      <ul className="mt-5 space-y-3">
        {items.slice(0, 6).map((item) => (
          <li key={item.title} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
            <p className="text-sm font-medium text-[var(--ink)]">{item.title}</p>
            <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{item.need}</p>
          </li>
        ))}
      </ul>
      <Link href={href} className="mt-5 inline-block text-sm text-[var(--accent)] hover:underline">
        Open the claim ledger
      </Link>
    </section>
  );
}
