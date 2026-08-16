import { DECISION_POSTURE_LABELS, type TrustProfile } from "@/lib/truth/profile";
import { scoreTone } from "@/lib/utils";

function toneColor(score: number) {
  const tone = scoreTone(score);
  if (tone === "good") return "var(--good)";
  if (tone === "ok") return "var(--low)";
  if (tone === "warn") return "var(--medium)";
  return "var(--critical)";
}

export function TrustPassport({
  company,
  assessedAt,
  profile,
}: {
  company: string;
  assessedAt: string;
  profile: TrustProfile;
}) {
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--accent)]">
        VERIQ Trust Profile
      </p>
      <h2 className="mt-2 font-display text-3xl">{company}</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">Assessment {assessedAt}</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Stamp label="Risk" value={profile.risk} suffix="/100" />
        <Stamp label="Evidence quality" value={profile.evidence} suffix="/100" />
        <Stamp label="Decision confidence" value={profile.confidence} suffix="%" />
      </div>
      <p className="mt-4 text-sm font-medium text-[var(--ink)]">
        {DECISION_POSTURE_LABELS[profile.posture]}
      </p>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{profile.disclaimer}</p>
      <p className="mt-4 text-xs text-[var(--muted)]">
        This is a shareable picture of what can be proven today — not a “VERIQ Verified”
        certificate that the company is safe.
      </p>
    </section>
  );
}

function Stamp({
  label,
  value,
  suffix,
}: {
  label: string;
  value: number;
  suffix: string;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-[var(--muted)]">{label}</p>
      <p className="mt-1 font-display text-4xl" style={{ color: toneColor(value) }}>
        {value}
        <span className="ml-1 text-base text-[var(--muted)]">{suffix}</span>
      </p>
    </div>
  );
}
