import { cn } from "@/lib/utils";
import type { Severity } from "@/lib/database.types";
import { SEVERITY_LABELS } from "@/lib/utils";

type BadgeVariant =
  | "default"
  | "accent"
  | "warning"
  | "danger"
  | "muted"
  | "critical"
  | "high"
  | "medium"
  | "low"
  | "info";

const variantClasses: Record<BadgeVariant, string> = {
  default:
    "bg-[var(--elevated)] text-[var(--ink)] border-[var(--border)]",
  accent: "bg-[var(--accent-dim)] text-[var(--accent)] border-transparent",
  warning: "bg-[rgba(245,197,66,0.12)] text-[var(--medium)] border-transparent",
  danger: "bg-[rgba(255,77,109,0.12)] text-[var(--critical)] border-transparent",
  muted: "bg-[var(--elevated)] text-[var(--muted)] border-[var(--border)]",
  critical: "bg-[rgba(255,77,109,0.12)] text-[var(--critical)] border-transparent",
  high: "bg-[rgba(255,138,76,0.12)] text-[var(--high)] border-transparent",
  medium: "bg-[rgba(245,197,66,0.12)] text-[var(--medium)] border-transparent",
  low: "bg-[rgba(125,211,252,0.12)] text-[var(--low)] border-transparent",
  info: "bg-[var(--elevated)] text-[var(--muted)] border-[var(--border)]",
};

export function Badge({
  className,
  variant = "default",
  children,
}: {
  className?: string;
  variant?: BadgeVariant;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide",
        variantClasses[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}

const severityVariant: Record<Severity, BadgeVariant> = {
  critical: "critical",
  high: "high",
  medium: "medium",
  low: "low",
  informational: "info",
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <Badge variant={severityVariant[severity]}>
      {SEVERITY_LABELS[severity]}
    </Badge>
  );
}

export function CertaintyBadge({
  certainty,
}: {
  certainty: "confirmed" | "potential" | "informational";
}) {
  const variant =
    certainty === "confirmed"
      ? "accent"
      : certainty === "informational"
        ? "muted"
        : "warning";
  const label =
    certainty === "confirmed"
      ? "Confirmed"
      : certainty === "informational"
        ? "Informational"
        : "Potential";
  return <Badge variant={variant}>{label}</Badge>;
}
