-- Distinguish confirmed vs potential vs informational findings.
-- Confirmed = observed evidence. Potential = inferred. Informational = notice.

alter table public.risks
  add column if not exists certainty text not null default 'potential';

alter table public.risks
  drop constraint if exists risks_certainty_check;

alter table public.risks
  add constraint risks_certainty_check
  check (certainty in ('confirmed', 'potential', 'informational'));

comment on column public.risks.certainty is
  'confirmed = observed evidence; potential = inferred; informational = notice only';

create index if not exists evidence_risk_id_idx on public.evidence (risk_id);
create index if not exists risks_org_status_idx on public.risks (organization_id, status);
create index if not exists actions_org_status_idx on public.actions (organization_id, status);
create index if not exists scans_org_status_idx on public.scans (organization_id, status, created_at desc);
