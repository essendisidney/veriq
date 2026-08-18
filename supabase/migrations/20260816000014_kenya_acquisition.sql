-- Kenya data acquisition v1: entities, facts, conflicts, source runs.
-- Facts are never overwritten. Competing values become conflicts.
-- Official registries are not scraped. A connector plug-in later fills the same tables.

alter table public.evidence_documents
  add column if not exists extracted_text text,
  add column if not exists extraction_status text not null default 'pending';

create table if not exists public.veriq_entities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  entity_key text not null,
  kind text not null,
  label text not null,
  keys text[] not null default '{}',
  related_keys text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, entity_key)
);

create table if not exists public.veriq_facts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  entity_id uuid not null references public.veriq_entities (id) on delete cascade,
  claim text not null,
  value text not null,
  connector_id text not null,
  source_type text not null,
  source_ref text,
  confidence integer not null default 50,
  access_method text not null,
  excerpt text,
  content_hash text not null,
  document_id uuid references public.evidence_documents (id) on delete set null,
  observed_at timestamptz not null default now(),
  unique (organization_id, entity_id, claim, content_hash)
);

create table if not exists public.veriq_fact_conflicts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  left_fact_id uuid not null references public.veriq_facts (id) on delete cascade,
  right_fact_id uuid not null references public.veriq_facts (id) on delete cascade,
  claim text not null,
  why text not null,
  created_at timestamptz not null default now(),
  unique (left_fact_id, right_fact_id)
);

create table if not exists public.veriq_source_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  source_id text not null,
  registry_status text not null,
  observed boolean not null default false,
  note text not null default '',
  evidence_count integer not null default 0,
  ran_at timestamptz not null default now(),
  unique (organization_id, source_id)
);

create index if not exists veriq_entities_org_idx on public.veriq_entities (organization_id);
create index if not exists veriq_facts_org_idx on public.veriq_facts (organization_id, claim);
create index if not exists veriq_facts_entity_idx on public.veriq_facts (entity_id);
create index if not exists veriq_conflicts_org_idx on public.veriq_fact_conflicts (organization_id);
create index if not exists veriq_source_runs_org_idx on public.veriq_source_runs (organization_id);

alter table public.veriq_entities enable row level security;
alter table public.veriq_facts enable row level security;
alter table public.veriq_fact_conflicts enable row level security;
alter table public.veriq_source_runs enable row level security;

drop policy if exists "veriq_entities_member_all" on public.veriq_entities;
create policy "veriq_entities_member_all"
  on public.veriq_entities for all
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

drop policy if exists "veriq_facts_member_all" on public.veriq_facts;
create policy "veriq_facts_member_all"
  on public.veriq_facts for all
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

drop policy if exists "veriq_conflicts_member_all" on public.veriq_fact_conflicts;
create policy "veriq_conflicts_member_all"
  on public.veriq_fact_conflicts for all
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

drop policy if exists "veriq_source_runs_member_all" on public.veriq_source_runs;
create policy "veriq_source_runs_member_all"
  on public.veriq_source_runs for all
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

grant select, insert, update, delete on public.veriq_entities to authenticated;
grant select, insert, update, delete on public.veriq_facts to authenticated;
grant select, insert, update, delete on public.veriq_fact_conflicts to authenticated;
grant select, insert, update, delete on public.veriq_source_runs to authenticated;
