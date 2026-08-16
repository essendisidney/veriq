"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";
import {
  uploadEvidenceDocument,
  validateFinding,
} from "@/lib/actions/validate";
import {
  DOCUMENT_KIND_LABELS,
  DOCUMENT_KINDS,
  VALIDATION_LABELS,
  VALIDATION_STATUSES,
  type DocumentKind,
  type ValidationStatus,
} from "@/lib/risk/validate";
import type { EvidenceDocument, ValidationEvent } from "@/lib/database.types";

const RESULTS = VALIDATION_STATUSES.filter((item) => item !== "pending");

export function ValidateFinding({
  organizationId,
  riskId,
  requiredDocument,
  validationStatus,
  documents,
  events,
  onDone,
}: {
  organizationId: string;
  riskId: string;
  requiredDocument: string | null;
  validationStatus: ValidationStatus;
  documents: EvidenceDocument[];
  events: ValidationEvent[];
  onDone: () => void;
}) {
  const [kind, setKind] = useState<DocumentKind>("cr12");
  const [status, setStatus] = useState<ValidationStatus>(
    validationStatus === "pending" ? "confirmed" : validationStatus,
  );
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onUpload(formData: FormData) {
    setBusy(true);
    setError(null);
    setMessage(null);
    formData.set("organizationId", organizationId);
    formData.set("riskId", riskId);
    formData.set("kind", kind);
    const result = await uploadEvidenceDocument(formData);
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setMessage("Artefact stored and hashed. VERIQ did not extract cash, directors or a legal opinion from the file.");
    onDone();
  }

  async function onValidate() {
    setBusy(true);
    setError(null);
    setMessage(null);
    const result = await validateFinding({
      organizationId,
      riskId,
      status,
      note,
    });
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setMessage("Validation recorded. This is now a validated finding, not a scan guess.");
    onDone();
  }

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 print:hidden">
      <h2 className="font-display text-xl">Validate</h2>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
        A scan observation is a finding, not a conclusion. Upload an authorised artefact,
        then classify the result. VERIQ will not invent confirmation from the file contents.
      </p>
      {requiredDocument && (
        <p className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--elevated)] px-4 py-3 text-sm text-[var(--ink)]">
          {requiredDocument}
        </p>
      )}
      <p className="mt-3 text-xs uppercase tracking-wide text-[var(--muted)]">
        Current status · {VALIDATION_LABELS[validationStatus]}
      </p>

      <form action={onUpload} className="mt-4 space-y-3">
        <div>
          <Label htmlFor="kind">Artefact kind</Label>
          <select
            id="kind"
            value={kind}
            onChange={(event) => setKind(event.target.value as DocumentKind)}
            className="h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--elevated)] px-3 text-sm"
          >
            {DOCUMENT_KINDS.map((item) => (
              <option key={item} value={item}>
                {DOCUMENT_KIND_LABELS[item]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="file">File (PDF, image, CSV or text · 10 MB)</Label>
          <input
            id="file"
            name="file"
            type="file"
            accept=".pdf,image/png,image/jpeg,image/webp,.csv,.txt"
            className="mt-1 block w-full text-sm text-[var(--ink)]"
          />
        </div>
        <Button type="submit" variant="secondary" disabled={busy}>
          {busy ? "Storing…" : "Store in evidence vault"}
        </Button>
      </form>

      {documents.length > 0 && (
        <ul className="mt-4 space-y-2">
          {documents.map((item) => (
            <li
              key={item.id}
              className="rounded-xl border border-[var(--border)] bg-[var(--elevated)] px-4 py-3 text-sm"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="muted">{item.kind}</Badge>
                <span className="text-[var(--ink)]">{item.filename}</span>
              </div>
              <p className="mt-1 text-xs text-[var(--muted)]">
                sha256 {item.sha256.slice(0, 16)}… · {formatDateTime(item.created_at)}
              </p>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-5 space-y-3">
        <div>
          <Label htmlFor="result">Validation result</Label>
          <select
            id="result"
            value={status}
            onChange={(event) => setStatus(event.target.value as ValidationStatus)}
            className="h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--elevated)] px-3 text-sm"
          >
            {RESULTS.map((item) => (
              <option key={item} value={item}>
                {VALIDATION_LABELS[item]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="note">Note (optional)</Label>
          <textarea
            id="note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={3}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--elevated)] px-3 py-2 text-sm"
            placeholder="What did the artefact show? Do not paste account numbers or full statements."
          />
        </div>
        <Button type="button" onClick={() => void onValidate()} disabled={busy}>
          Record validation
        </Button>
      </div>

      {events.length > 0 && (
        <div className="mt-5">
          <h3 className="text-sm font-medium text-[var(--ink)]">Audit trail</h3>
          <ul className="mt-2 space-y-2">
            {events.map((item) => (
              <li key={item.id} className="text-xs leading-5 text-[var(--muted)]">
                {formatDateTime(item.created_at)} · {VALIDATION_LABELS[item.to_status]}
                {item.note ? ` — ${item.note}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-[var(--critical)]">{error}</p>}
      {message && <p className="mt-3 text-sm text-[var(--muted)]">{message}</p>}
    </div>
  );
}
