"use client";

import { useEffect, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { updateConflictValidation } from "@/lib/actions/validate-evidence";
import { Badge } from "@/components/ui/badge";
import type { VeriqFactConflict } from "@/lib/database.types";

export function ConflictValidationList({ organizationId }: { organizationId: string }) {
  const [rows, setRows] = useState<VeriqFactConflict[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const supabase = createClient();
    const { data } = await supabase
      .from("veriq_fact_conflicts")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false });
    setRows((data as VeriqFactConflict[]) ?? []);
    setLoaded(true);
  }

  useEffect(() => {
    void load();
  }, [organizationId]);

  if (!loaded) {
    return <p className="text-sm text-[var(--muted)]">Loading contradictions…</p>;
  }
  if (rows.length === 0) return null;

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
      <h2 className="font-display text-2xl italic">Contradictions to validate</h2>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
        Same claim, two sources. Validate or dismiss — this is not a fraud finding.
      </p>
      {error && <p className="mt-3 text-sm text-[var(--critical)]">{error}</p>}
      <ul className="mt-5 space-y-3">
        {rows.map((row) => (
          <li
            key={row.id}
            className="rounded-xl border border-[var(--border)] bg-[var(--elevated)] px-4 py-3"
          >
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium text-[var(--ink)]">{row.claim.replace("money:", "")}</p>
              <Badge
                variant={
                  row.validation_status === "validated"
                    ? "accent"
                    : row.validation_status === "dismissed"
                      ? "muted"
                      : "warning"
                }
              >
                {row.validation_status.replace(/_/g, " ")}
              </Badge>
            </div>
            <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{row.why}</p>
            {(row.left_value || row.right_value) && (
              <p className="mt-2 text-xs text-[var(--muted)]">
                {row.left_value ?? "—"} vs {row.right_value ?? "—"}
                {row.variance_pct != null ? ` · ${row.variance_pct}% variance` : ""}
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={pending || row.validation_status === "validated"}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs disabled:opacity-50"
                onClick={() => {
                  setError(null);
                  startTransition(async () => {
                    const result = await updateConflictValidation({
                      organizationId,
                      conflictId: row.id,
                      status: "validated",
                    });
                    if (result.error) {
                      setError(result.error);
                      return;
                    }
                    await load();
                  });
                }}
              >
                Validate
              </button>
              <button
                type="button"
                disabled={pending || row.validation_status === "dismissed"}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs disabled:opacity-50"
                onClick={() => {
                  setError(null);
                  startTransition(async () => {
                    const result = await updateConflictValidation({
                      organizationId,
                      conflictId: row.id,
                      status: "dismissed",
                    });
                    if (result.error) {
                      setError(result.error);
                      return;
                    }
                    await load();
                  });
                }}
              >
                Dismiss
              </button>
              {row.validation_status !== "requires_validation" && (
                <button
                  type="button"
                  disabled={pending}
                  className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs disabled:opacity-50"
                  onClick={() => {
                    setError(null);
                    startTransition(async () => {
                      const result = await updateConflictValidation({
                        organizationId,
                        conflictId: row.id,
                        status: "requires_validation",
                      });
                      if (result.error) {
                        setError(result.error);
                        return;
                      }
                      await load();
                    });
                  }}
                >
                  Reopen
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs text-[var(--muted)]">
        After validating money conflicts, open{" "}
        <a href="/finance" className="text-[var(--accent)] hover:underline">
          Finance
        </a>{" "}
        and rescan if figures still look stale.
      </p>
    </section>
  );
}
