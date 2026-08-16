import type { Metadata } from "next";
import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";

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
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
          <div>
            <BrandMark className="text-[1.45rem]" />
            <p className="mt-1 text-xs text-[var(--muted)]">Shared intelligence pack</p>
          </div>
          <Link
            href="/"
            className="text-[13px] text-[var(--muted)] transition-colors hover:text-[var(--accent)]"
          >
            What is VERIQ
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-12">{children}</main>
    </div>
  );
}
