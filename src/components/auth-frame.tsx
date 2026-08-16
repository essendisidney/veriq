import { BrandMark } from "@/components/brand-mark";

export function AuthFrame({
  kicker,
  title,
  children,
}: {
  kicker: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen bg-[var(--bg)] lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden border-r border-[var(--border)] bg-[var(--surface)] px-12 py-10 lg:flex lg:flex-col lg:justify-between">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(720px 380px at 100% 0%, rgba(110,231,208,0.12), transparent 55%)",
          }}
          aria-hidden
        />
        <BrandMark className="relative" />
        <div className="relative max-w-lg">
          <p className="eyebrow">Before you trust a company</p>
          <blockquote className="mt-6 font-display text-[3.4rem] italic leading-[1.08] text-[var(--ink)]">
            Don’t just verify the company. Verify the story.
          </blockquote>
        </div>
        <p className="relative text-sm text-[var(--muted)]">
          Kenya-first. Africa-bound. Evidence is the product.
        </p>
      </aside>
      <div className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-md">
          <div className="mb-10 lg:hidden">
            <BrandMark />
          </div>
          <p className="eyebrow">{kicker}</p>
          <h1 className="mt-3 font-display text-4xl italic text-[var(--ink)]">{title}</h1>
          <div className="mt-8">{children}</div>
        </div>
      </div>
    </div>
  );
}
