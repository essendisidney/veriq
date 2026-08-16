"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { publicCompanySnapshot, type PublicSnapshot } from "@/lib/actions/public-snapshot";
import { CompanySearch } from "@/components/company-search";
import { Badge } from "@/components/ui/badge";
import { TRUST_CALL_LABELS } from "@/lib/truth/call";
import { MarketingHeader } from "@/components/brand-mark";

const CALL_STYLE: Record<string, { color: string; label: string }> = {
  proceed: { color: "var(--good)", label: TRUST_CALL_LABELS.proceed },
  investigate: { color: "var(--medium)", label: TRUST_CALL_LABELS.investigate },
  stop: { color: "var(--critical)", label: TRUST_CALL_LABELS.stop },
};

export default function CheckClient() {
  const params = useSearchParams();
  const q = params.get("q") ?? "";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<PublicSnapshot | null>(null);

  useEffect(() => {
    if (!q) return;
    let cancelled = false;
    setBusy(true);
    setError(null);
    setSnapshot(null);
    void publicCompanySnapshot(q).then((result) => {
      if (cancelled) return;
      setBusy(false);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setSnapshot(result.snapshot);
    });
    return () => {
      cancelled = true;
    };
  }, [q]);

  const style = snapshot ? CALL_STYLE[snapshot.call] : null;

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <MarketingHeader />

      <main className="mx-auto w-full max-w-3xl px-6 pb-24 pt-10 md:px-10">
        <p className="eyebrow">Before you trust a company, VERIQ it.</p>
        <h1 className="mt-5 font-display text-4xl italic leading-[1.08] text-[var(--ink)] md:text-[3.4rem]">
          Should I trust this company?
        </h1>
        <p className="mt-5 max-w-xl text-[15px] leading-7 text-[var(--muted)]">
          Name the company. VERIQ finds the public website and reads the story. Phone and
          registration number stay UNKNOWN without an authorised extract you provide after signup.
        </p>
        <div className="mt-10">
          <CompanySearch initial={q} size="hero" />
        </div>
        {busy && (
          <p className="mt-10 font-display text-xl italic text-[var(--muted)]">
            VERIQ is finding the public company, then reading the story…
          </p>
        )}
        {error && <p className="mt-8 text-sm text-[var(--critical)]">{error}</p>}

        {snapshot && style && (
          <section className="mt-14">
            <p className="eyebrow">
              Should I trust {snapshot.identity?.name ?? snapshot.hostname}?
            </p>
            <p
              className="mt-4 font-display text-6xl italic leading-none md:text-7xl"
              style={{ color: style.color }}
            >
              {style.label}
            </p>
            <p className="mt-6 max-w-xl text-[15px] leading-7 text-[var(--muted)]">
              {snapshot.callWhy}
            </p>
            {snapshot.identity && (
              <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--muted)]">
                Named “{snapshot.identity.name}” → {snapshot.hostname}. {snapshot.identity.note}
                {snapshot.pagesRead > 1 ? ` VERIQ read ${snapshot.pagesRead} public pages.` : ""}
              </p>
            )}
            <div className="mt-8 flex flex-wrap gap-2">
              <Badge variant={snapshot.https ? "accent" : "danger"}>
                {snapshot.https ? "HTTPS" : "No HTTPS"}
              </Badge>
              <Badge variant="muted">
                Privacy notice {snapshot.privacyNotice ? "observed" : "not observed"}
              </Badge>
              <Badge variant="muted">{snapshot.trackerCount} tracker(s)</Badge>
            </div>
            <div className="mt-12">
              <h2 className="font-display text-2xl italic">What we can show for free</h2>
              <ul className="mt-5 space-y-3">
                {snapshot.findings.map((item) => (
                  <li
                    key={item.title}
                    className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"
                  >
                    <p className="text-sm font-medium text-[var(--ink)]">{item.title}</p>
                    <p className="mt-1.5 text-sm leading-6 text-[var(--muted)]">{item.why}</p>
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-10 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
              <p className="text-sm text-[var(--ink)]">
                VERIQ found {snapshot.additionalSignals} additional signal
                {snapshot.additionalSignals === 1 ? "" : "s"} that stay locked.
              </p>
              <ul className="mt-4 space-y-2 text-sm leading-6 text-[var(--muted)]">
                {snapshot.locked.slice(0, 7).map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-[var(--accent)]" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                href="/signup"
                className="mt-6 inline-flex h-11 items-center rounded-full bg-[var(--accent)] px-5 text-sm font-medium text-[var(--bg)] transition-opacity hover:opacity-90"
              >
                Unlock full analysis
              </Link>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
