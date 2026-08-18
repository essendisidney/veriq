-- VERIQ 2.0 truth graph: typed edges, money/period on facts, sector pack, conflict metadata.
-- Facts remain append-only. Competing amounts become conflicts, never overwrites.

alter table public.organizations
  add column if not exists sector_pack text not null default 'sme';

alter table public.veriq_facts
  add column if not exists amount_minor bigint,
  add column if not exists currency text,
  add column if not exists period_start date,
  add column if not exists period_end date,
  add column if not exists unit text,
  add column if not exists validation_status text not null default 'pending';

alter table public.veriq_fact_conflicts
  add column if not exists variance_pct numeric,
  add column if not exists left_value text,
  add column if not exists right_value text,
  add column if not exists validation_status text not null default 'requires_validation';

create table if not exists public.veriq_edges (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  from_key text not null,
  to_key text not null,
  kind text not null,
  confidence integer not null default 40,
  validation_status text not null default 'requires_validation',
  why text not null default '',
  source_fact_hashes text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (organization_id, from_key, to_key, kind)
);

create index if not exists veriq_edges_org_idx on public.veriq_edges (organization_id);
create index if not exists veriq_facts_amount_idx on public.veriq_facts (organization_id, claim)
  where amount_minor is not null;

alter table public.veriq_edges enable row level security;

drop policy if exists "veriq_edges_member_all" on public.veriq_edges;
create policy "veriq_edges_member_all"
  on public.veriq_edges for all
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

grant select, insert, update, delete on public.veriq_edges to authenticated;
