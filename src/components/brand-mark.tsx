import Link from "next/link";
import { cn } from "@/lib/utils";

export function BrandMark({
  href = "/",
  className,
  onClick,
}: {
  href?: string;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "font-display text-[1.75rem] italic tracking-tight text-[var(--ink)]",
        className,
      )}
    >
      VERIQ
    </Link>
  );
}

export function MarketingHeader({
  action = "unlock",
}: {
  action?: "unlock" | "signin";
}) {
  return (
    <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6 md:px-10">
      <BrandMark />
      <nav className="flex items-center gap-5">
        <Link
          href="/login"
          className="text-[13px] font-medium text-[var(--muted)] transition-colors hover:text-[var(--ink)]"
        >
          Sign in
        </Link>
        {action === "unlock" ? (
          <Link
            href="/signup"
            className="rounded-full bg-[var(--accent)] px-4 py-2 text-[13px] font-medium text-[var(--bg)] transition-opacity hover:opacity-90"
          >
            Unlock full analysis
          </Link>
        ) : (
          <Link
            href="/signup"
            className="text-[13px] font-medium text-[var(--accent)]"
          >
            Create account
          </Link>
        )}
      </nav>
    </header>
  );
}
