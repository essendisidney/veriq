"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { publicCompanySnapshot, type PublicSnapshot } from "@/lib/actions/public-snapshot";
import { CompanySearch } from "@/components/company-search";
import { Badge } from "@/components/ui/badge";
import { TRUST_CALL_LABELS } from "@/lib/truth/call";

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
    <div className="min-h-screen bg-[var(--bg)] px-6 py-10 md:px-10">
      <header className="mx-auto flex max-w-3xl items-center justify-between">
        <Link href="/" className="font-display text-2xl text-[var(--ink)]">
          VERIQ
        </Link>
        <Link href="/signup" className="text-sm text-[var(--accent)] hover:underline">
          Unlock full analysis
        </Link>
      </header>

      <main className="mx-auto mt-16 max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--accent)]">
          Before you trust a company, VERIQ it.
        </p>
        <h1 className="mt-4 font-display text-4xl italic text-[var(--ink)] md:text-5xl">
          Should I trust this company?
        </h1>
        <p className="mt-4 text-sm leading-6 text-[var(--muted)]">
          Seconds, not a setup wizard. Public website only. Company name, phone and registration
          number stay UNKNOWN without an authorised extract you provide after signup.
        </p>
        <div className="mt-8">
          <CompanySearch initial={q} />
        </div>
        {busy && (
          <p className="mt-8 text-sm text-[var(--muted)]">VERIQ is building the company profile…</p>
        )}
        {error && <p className="mt-6 text-sm text-[var(--critical)]">{error}</p>}

        {snapshot && style && (
          <section className="mt-10 space-y-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <div>
              <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
                Should I trust {snapshot.hostname}?
              </p>
              <p className="mt-2 font-display text-5xl" style={{ color: style.color }}>
                {style.label}
              </p>
              <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{snapshot.callWhy}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant={snapshot.https ? "accent" : "danger"}>
                {snapshot.https ? "HTTPS" : "No HTTPS"}
              </Badge>
              <Badge variant="muted">
                Privacy notice {snapshot.privacyNotice ? "observed" : "not observed"}
              </Badge>
              <Badge variant="muted">{snapshot.trackerCount} tracker(s)</Badge>
            </div>
            <div>
              <h2 className="font-display text-xl">What we can show for free</h2>
              <ul className="mt-3 space-y-3">
                {snapshot.findings.map((item) => (
                  <li key={item.title} className="rounded-xl border border-[var(--border)] bg-[var(--elevated)] p-4">
                    <p className="text-sm font-medium text-[var(--ink)]">{item.title}</p>
                    <p className="mt-1 text-sm text-[var(--muted)]">{item.why}</p>
                  </li>
                ))}
              </ul>
            </div>
            <p className="text-sm text-[var(--ink)]">
              VERIQ found {snapshot.additionalSignals} additional signal
              {snapshot.additionalSignals === 1 ? "" : "s"} that stay locked.
            </p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--muted)]">
              {snapshot.locked.slice(0, 7).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <Link
              href="/signup"
              className="inline-flex h-10 items-center rounded-xl bg-[var(--accent)] px-4 text-sm font-medium text-[var(--bg)]"
            >
              Unlock full analysis
            </Link>
          </section>
        )}
      </main>
    </div>
  );
}
