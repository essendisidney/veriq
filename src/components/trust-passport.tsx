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
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8">
      <p className="eyebrow">VERIQ Trust Profile</p>
      <h2 className="mt-3 font-display text-4xl italic">{company}</h2>
      <p className="mt-2 text-sm text-[var(--muted)]">Assessment {assessedAt}</p>
      <div className="mt-8 grid gap-6 sm:grid-cols-3">
        <Stamp label="Risk" value={profile.risk} suffix="/100" />
        <Stamp label="Evidence quality" value={profile.evidence} suffix="/100" />
        <Stamp label="Decision confidence" value={profile.confidence} suffix="%" />
      </div>
      <p className="mt-6 text-sm font-medium text-[var(--ink)]">
        {DECISION_POSTURE_LABELS[profile.posture]}
      </p>
      <p className="mt-2 text-sm leading-7 text-[var(--muted)]">{profile.disclaimer}</p>
      <p className="mt-5 text-xs leading-5 text-[var(--muted)]">
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
      <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">{label}</p>
      <p className="mt-1 font-display text-5xl italic leading-none" style={{ color: toneColor(value) }}>
        {value}
        <span className="ml-1 text-base not-italic text-[var(--muted)]">{suffix}</span>
      </p>
    </div>
  );
}
