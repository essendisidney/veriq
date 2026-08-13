import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Shared VERIQ pack",
  robots: { index: false, follow: false },
};

export default function PublicPackLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <header className="print:hidden border-b border-[var(--border)]">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--accent)]">
              VERIQ
            </p>
            <p className="mt-1 text-xs text-[var(--muted)]">Shared intelligence pack</p>
          </div>
          <Link href="/" className="text-xs text-[var(--muted)] hover:text-[var(--accent)]">
            What is VERIQ
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-10">{children}</main>
    </div>
  );
}
