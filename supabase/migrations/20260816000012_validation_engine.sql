-- Evidence-first validation: a scan observation is a finding, not a conclusion.
-- Human or document validation is required before VERIQ treats it as confirmed.
-- Disproved findings stay in the audit trail and do not invent a fact in the other direction.

create type public.validation_status as enum (
  'pending',
  'confirmed',
  'disproved',
  'partially_confirmed',
  'unresolved',
  'insufficient_evidence'
);

create type public.intelligence_stage as enum (
  'signal',
  'finding',
  'validated'
);

alter table public.risks
  add column if not exists validation_status public.validation_status not null default 'pending',
  add column if not exists intelligence_stage public.intelligence_stage not null default 'finding',
  add column if not exists validation_method text,
  add column if not exists required_document text,
  add column if not exists validated_at timestamptz,
  add column if not exists validated_by uuid;

update public.risks
set intelligence_stage = 'signal'
where certainty = 'informational';

create table public.evidence_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  risk_id uuid references public.risks (id) on delete set null,
  kind text not null default 'other',
  filename text not null,
  mime text,
  byte_size integer not null default 0,
  sha256 text not null,
  storage_path text not null,
  uploaded_by uuid,
  created_at timestamptz not null default now()
);

create table public.validation_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  risk_id uuid not null references public.risks (id) on delete cascade,
  document_id uuid references public.evidence_documents (id) on delete set null,
  from_status public.validation_status,
  to_status public.validation_status not null,
  note text,
  actor uuid,
  created_at timestamptz not null default now()
);

create index evidence_documents_org_idx on public.evidence_documents (organization_id, created_at desc);
create index evidence_documents_risk_idx on public.evidence_documents (risk_id);
create index validation_events_risk_idx on public.validation_events (risk_id, created_at desc);

alter table public.evidence_documents enable row level security;
alter table public.validation_events enable row level security;

create policy "evidence_documents_member_all"
  on public.evidence_documents
  for all
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy "validation_events_member_all"
  on public.validation_events
  for all
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

grant select, insert, update, delete on public.evidence_documents to authenticated;
grant select, insert, update, delete on public.validation_events to authenticated;

insert into storage.buckets (id, name, public, file_size_limit)
values ('evidence', 'evidence', false, 10485760)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit;

create policy "evidence_objects_select"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'evidence'
    and public.is_org_member(split_part(name, '/', 1)::uuid)
  );

create policy "evidence_objects_insert"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'evidence'
    and public.is_org_member(split_part(name, '/', 1)::uuid)
  );

create policy "evidence_objects_update"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'evidence'
    and public.is_org_member(split_part(name, '/', 1)::uuid)
  )
  with check (
    bucket_id = 'evidence'
    and public.is_org_member(split_part(name, '/', 1)::uuid)
  );
