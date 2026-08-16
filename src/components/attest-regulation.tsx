"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ScanButton } from "@/components/scan-button";
import { attestRegulation } from "@/lib/actions/regulations";
import type { ArtefactBand } from "@/lib/regulations/attest";
import type { RegulationAssessment } from "@/lib/regulations/assess";

const OPTIONS: { value: ArtefactBand; label: string }[] = [
  { value: "unknown", label: "Unknown" },
  { value: "yes", label: "We have this" },
  { value: "no", label: "We do not" },
];

export function AttestRegulation({
  organizationId,
  code,
  items,
  saved,
}: {
  organizationId: string;
  code: string;
  items: RegulationAssessment["evidence"];
  saved: Record<string, ArtefactBand>;
}) {
  const attested = items.filter((item) => item.kind === "attested");
  const [values, setValues] = useState<Record<string, ArtefactBand>>(() => {
    const next: Record<string, ArtefactBand> = {};
    for (const item of attested) {
      next[item.key] = saved[item.key] ?? "unknown";
    }
    return next;
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!attested.length) return null;

  async function onSave() {
    setSaving(true);
    setError(null);
    setMessage(null);
    const result = await attestRegulation({
      organizationId,
      code,
      values,
    });
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setMessage("Saved. Rescan to fold this into findings and the VERIQ Score.");
  }

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 print:hidden">
      <h2 className="font-display text-xl">Attest artefacts</h2>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
        Say whether the company holds each artefact. This is not compliance, not a legal opinion,
        and not a cash figure. Observable items still come from the scan.
      </p>
      <div className="mt-4 space-y-3">
        {attested.map((item) => (
          <div key={item.key}>
            <Label htmlFor={`artefact-${item.key}`}>{item.label}</Label>
            <select
              id={`artefact-${item.key}`}
              value={values[item.key] ?? "unknown"}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  [item.key]: event.target.value as ArtefactBand,
                }))
              }
              className="h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--elevated)] px-3 text-sm text-[var(--ink)]"
            >
              {OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button type="button" onClick={() => void onSave()} disabled={saving}>
          {saving ? "Saving…" : "Save attestations"}
        </Button>
        <ScanButton organizationId={organizationId} label="Rescan" />
      </div>
      {error && <p className="mt-3 text-sm text-[var(--critical)]">{error}</p>}
      {message && <p className="mt-3 text-sm text-[var(--accent)]">{message}</p>}
    </div>
  );
}
