"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateActionStatus, updateRiskStatus } from "@/lib/actions/triage";
import type { ActionStatus, RiskStatus } from "@/lib/database.types";

const RISK_OPTIONS: { value: RiskStatus; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "acknowledged", label: "Acknowledged" },
  { value: "in_progress", label: "In progress" },
  { value: "resolved", label: "Resolved" },
  { value: "accepted", label: "Accepted" },
];

const ACTION_OPTIONS: { value: ActionStatus; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "done", label: "Done" },
  { value: "cancelled", label: "Cancelled" },
];

function SelectControl({
  value,
  options,
  disabled,
  onChange,
}: {
  value: string;
  options: { value: string; label: string }[];
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 rounded-lg border border-[var(--border)] bg-[var(--elevated)] px-2 text-xs text-[var(--ink)] focus:border-[var(--accent)] focus:outline-none disabled:opacity-50"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export function RiskStatusSelect({
  organizationId,
  riskId,
  status,
}: {
  organizationId: string;
  riskId: string;
  status: RiskStatus;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [current, setCurrent] = useState(status);
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <SelectControl
        value={current}
        options={RISK_OPTIONS}
        disabled={pending}
        onChange={(value) => {
          const next = value as RiskStatus;
          setCurrent(next);
          setError(null);
          startTransition(async () => {
            const result = await updateRiskStatus({
              organizationId,
              riskId,
              status: next,
            });
            if (result.error) {
              setCurrent(status);
              setError(result.error);
              return;
            }
            router.refresh();
          });
        }}
      />
      {error && <p className="mt-1 text-xs text-[var(--critical)]">{error}</p>}
    </div>
  );
}

export function ActionStatusSelect({
  organizationId,
  actionId,
  status,
}: {
  organizationId: string;
  actionId: string;
  status: ActionStatus;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [current, setCurrent] = useState(status);
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <SelectControl
        value={current}
        options={ACTION_OPTIONS}
        disabled={pending}
        onChange={(value) => {
          const next = value as ActionStatus;
          setCurrent(next);
          setError(null);
          startTransition(async () => {
            const result = await updateActionStatus({
              organizationId,
              actionId,
              status: next,
            });
            if (result.error) {
              setCurrent(status);
              setError(result.error);
              return;
            }
            router.refresh();
          });
        }}
      />
      {error && <p className="mt-1 text-xs text-[var(--critical)]">{error}</p>}
    </div>
  );
}
