import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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
        <span className="font-display text-2xl tracking-tight text-[var(--ink)]">
          VERIQ
        </span>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm font-medium text-[var(--muted)] hover:text-[var(--ink)]"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--bg)] hover:opacity-90"
          >
            Get started
          </Link>
        </div>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-6 pb-20 md:px-10">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--accent)]">
          Continuous corporate risk intelligence
        </p>
        <h1 className="mt-5 max-w-3xl font-display text-5xl font-medium italic leading-[1.08] text-[var(--ink)] md:text-7xl">
          See the risk before it becomes reality.
        </h1>
        <p className="mt-6 max-w-xl text-base text-[var(--muted)] md:text-lg">
          VERIQ builds a living model of your company from evidence — code,
          infrastructure, regulations — then tells management what can hurt the
          business, why, and what to do next. Banks and investors can query the
          same intelligence through the VERIQ API.
        </p>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/signup"
            className="inline-flex items-center justify-center rounded-xl bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-[var(--bg)] hover:opacity-90"
          >
            Create account
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--elevated)] px-6 py-3 text-sm font-semibold text-[var(--ink)] hover:border-[var(--accent)]"
          >
            Sign in
          </Link>
        </div>
        <p className="mt-16 text-sm tracking-wide text-[var(--muted)]">
          Verify. Understand. Predict.
        </p>
      </main>
    </div>
  );
}
