import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CompanySearch } from "@/components/company-search";
import { MarketingHeader } from "@/components/brand-mark";

const FEATURES = [
  {
    n: "01",
    title: "Challenge",
    body: "Try to disprove the company’s claims. Inferences stay inferences. Unknown stays unknown.",
  },
  {
    n: "02",
    title: "Passport",
    body: "A living evidence picture you can share. Not a certificate that the company is safe.",
  },
  {
    n: "03",
    title: "Monitor",
    body: "What changed since the last review — when you open the brief. Nothing scans in silence.",
  },
];

const LADDER = [
  { name: "Free", detail: "Public-site scan. Proceed, Investigate or Stop." },
  { name: "Pro", detail: "Claim ledger, evidence score, Challenge, Passport." },
  { name: "DD", detail: "Due diligence packs for investors, lenders and counsel." },
  { name: "Monitor", detail: "Material change, in this session — not a silent worker." },
  { name: "Enterprise", detail: "Portfolio brief, decision rooms, API." },
  { name: "Passport", detail: "A living picture companies can share. Not a safety stamp." },
  { name: "API", detail: "Banks, insurers and procurement call VERIQ inside their workflow." },
];

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/dashboard");

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-[var(--bg)]">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(900px 420px at 82% -12%, rgba(110,231,208,0.14), transparent 55%), radial-gradient(640px 360px at 8% 108%, rgba(232,197,107,0.06), transparent 50%)",
        }}
        aria-hidden
      />
      <MarketingHeader />

      <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 pb-24 pt-10 md:px-10 md:pt-16">
        <p className="eyebrow">Before you trust a company, VERIQ it.</p>
        <h1 className="mt-6 max-w-[14ch] font-display text-[3.15rem] font-medium italic leading-[1.04] text-[var(--ink)] md:text-[5.25rem]">
          Should I trust this company?
        </h1>
        <p className="mt-7 max-w-xl text-[17px] leading-8 text-[var(--muted)]">
          Name the company. In seconds VERIQ finds the public site, reads the story, and shows
          Proceed, Investigate or Stop — from evidence, not a KYB list. We do not scrape BRS,
          LinkedIn or a registry by registration number.
        </p>
        <div className="mt-12">
          <CompanySearch size="hero" />
        </div>
        <p className="mt-5 max-w-xl text-sm leading-6 text-[var(--muted)]">
          Challenge the story. Share a Passport. Watch what changes.{" "}
          <Link href="/signup" className="text-[var(--ink)] underline decoration-[var(--border)] underline-offset-4 hover:decoration-[var(--accent)]">
            Sign up to unlock the rest
          </Link>
          .
        </p>

        <section className="mt-24 grid gap-px overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--border)] sm:grid-cols-3">
          {FEATURES.map((item) => (
            <article key={item.n} className="bg-[var(--surface)] p-7">
              <p className="font-display text-sm italic text-[var(--accent)]">{item.n}</p>
              <h2 className="mt-3 font-display text-2xl italic text-[var(--ink)]">{item.title}</h2>
              <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{item.body}</p>
            </article>
          ))}
        </section>

        <section className="mt-20">
          <p className="eyebrow">The ladder</p>
          <h2 className="mt-3 font-display text-3xl italic">Start with one company.</h2>
          <ul className="mt-8 grid gap-x-10 gap-y-5 sm:grid-cols-2">
            {LADDER.map((item) => (
              <li key={item.name} className="border-t border-[var(--border)] pt-4">
                <p className="text-[13px] font-medium text-[var(--ink)]">VERIQ {item.name}</p>
                <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{item.detail}</p>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
