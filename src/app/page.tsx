import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CompanySearch } from "@/components/company-search";

const LADDER = [
  { name: "VERIQ Free", detail: "Quick public-site scan. Should I trust this company?" },
  { name: "VERIQ Pro", detail: "Claim ledger, evidence score, Challenge, Passport." },
  { name: "VERIQ DD", detail: "Deep due diligence packs for investors, lenders and counsel." },
  { name: "VERIQ Monitor", detail: "Tell me when something material changes — in this session, not a silent worker." },
  { name: "VERIQ Enterprise", detail: "Portfolio brief, decision rooms, API." },
  { name: "VERIQ Passport", detail: "A living evidence picture companies can share. Not a safety certificate." },
  { name: "VERIQ API", detail: "Banks, fintechs, insurers and procurement systems call VERIQ inside their workflow." },
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
            "radial-gradient(1200px 500px at 80% -10%, rgba(62,224,197,0.16), transparent 55%), radial-gradient(800px 400px at 0% 100%, rgba(125,211,252,0.08), transparent 50%)",
        }}
        aria-hidden
      />
      <header className="relative z-10 flex items-center justify-between px-6 py-5 md:px-10">
        <span className="font-display text-2xl tracking-tight text-[var(--ink)]">VERIQ</span>
        <div className="flex items-center gap-3">
          <Link href="/login" className="text-sm font-medium text-[var(--muted)] hover:text-[var(--ink)]">
            Sign in
          </Link>
          <Link
            href="/signup"
            className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--bg)] hover:opacity-90"
          >
            Unlock full analysis
          </Link>
        </div>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-6 pb-20 md:px-10">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--accent)]">
          Before you trust a company, VERIQ it.
        </p>
        <h1 className="mt-5 max-w-3xl font-display text-5xl font-medium italic leading-[1.08] text-[var(--ink)] md:text-7xl">
          Should I trust this company?
        </h1>
        <p className="mt-6 max-w-xl text-base text-[var(--muted)] md:text-lg">
          Paste a website. In seconds VERIQ shows Proceed, Investigate or Stop — from evidence,
          not a KYB list. We do not scrape BRS, LinkedIn or a registry by name.
        </p>
        <div className="mt-10">
          <CompanySearch size="hero" />
        </div>
        <p className="mt-4 text-sm text-[var(--muted)]">
          Challenge the story. Share a Passport. Watch what changes. Sign up to unlock the rest.
        </p>

        <section className="mt-20 grid gap-4 sm:grid-cols-3">
          <Feature title="VERIQ Challenge" body="Try to disprove the company's claims. Inferences stay inferences." />
          <Feature title="VERIQ Passport" body="A living evidence picture you can share. Not a certificate of safety." />
          <Feature title="VERIQ Monitor" body="What changed since the last review — when you open the brief." />
        </section>

        <section className="mt-16">
          <h2 className="font-display text-2xl">The ladder</h2>
          <ul className="mt-4 space-y-3">
            {LADDER.map((item) => (
              <li key={item.name} className="text-sm leading-6 text-[var(--muted)]">
                <span className="font-medium text-[var(--ink)]">{item.name}.</span> {item.detail}
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <p className="font-display text-xl text-[var(--ink)]">{title}</p>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{body}</p>
    </div>
  );
}
