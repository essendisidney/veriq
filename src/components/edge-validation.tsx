"use client";

import { useEffect, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { updateEdgeValidation } from "@/lib/actions/validate-evidence";
import { Badge } from "@/components/ui/badge";
import type { VeriqEdge } from "@/lib/database.types";

export function EdgeValidationList({ organizationId }: { organizationId: string }) {
  const [rows, setRows] = useState<VeriqEdge[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const supabase = createClient();
    const { data } = await supabase
      .from("veriq_edges")
      .select("*")
      .eq("organization_id", organizationId)
      .in("kind", ["related_party", "mentioned_in", "director_of", "shareholder_of"])
      .order("created_at", { ascending: false })
      .limit(40);
    setRows((data as VeriqEdge[]) ?? []);
    setLoaded(true);
  }

  useEffect(() => {
    void load();
  }, [organizationId]);

  if (!loaded) return null;
  if (rows.length === 0) return null;

  return (
    <section className="mt-8 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
      <h2 className="font-display text-2xl italic">Relationship validation</h2>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
        Related-party and ownership edges stay pending until a human confirms. Website names are not
        CR12 directors.
      </p>
      {error && <p className="mt-3 text-sm text-[var(--critical)]">{error}</p>}
      <ul className="mt-5 space-y-3">
        {rows.map((row) => (
          <li
            key={row.id}
            className="rounded-xl border border-[var(--border)] bg-[var(--elevated)] px-4 py-3"
          >
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium text-[var(--ink)]">
                {row.kind.replace(/_/g, " ")}
              </p>
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
              <span className="text-xs text-[var(--muted)]">{row.confidence}% confidence</span>
            </div>
            <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{row.why}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={pending || row.validation_status === "validated"}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs disabled:opacity-50"
                onClick={() => {
                  setError(null);
                  startTransition(async () => {
                    const result = await updateEdgeValidation({
                      organizationId,
                      edgeId: row.id,
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
                    const result = await updateEdgeValidation({
                      organizationId,
                      edgeId: row.id,
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
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
