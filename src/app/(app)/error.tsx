"use client";

import { useEffect } from "react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
        VERIQ
      </p>
      <h1 className="mt-2 font-display text-3xl text-[var(--ink)]">
        This view failed to load
      </h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        The workspace is intact. Retry this page — scans and evidence are not
        affected.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--bg)]"
      >
        Try again
      </button>
    </div>
  );
}
