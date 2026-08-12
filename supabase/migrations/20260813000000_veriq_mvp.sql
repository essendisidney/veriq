-- VERIQ MVP schema
-- Company → GitHub → Scan → Evidence → Risk Engine → Score → Recommendations

create extension if not exists pgcrypto;

create type public.membership_role as enum (
  'org_admin',
  'risk_manager',
  'executive',
  'viewer'
);

create type public.severity as enum (
  'critical',
  'high',
  'medium',
  'low',
  'informational'
);

create type public.risk_status as enum (
  'open',
  'acknowledged',
  'in_progress',
  'resolved',
  'accepted'
);

create type public.scan_type as enum (
  'initial',
  'daily',
  'weekly',
  'event',
  'on_demand'
);

create type public.scan_status as enum (
  'queued',
  'running',
  'completed',
  'failed'
);

create type public.trust_status as enum (
  'observed',
  'inferred',
  'predicted',
  'unknown'
);

create type public.action_status as enum (
  'open',
  'in_progress',
  'done',
  'cancelled'
);

create type public.action_priority as enum (
  'critical',
  'high',
  'medium',
  'low'
);

create type public.asset_criticality as enum (
  'critical',
  'high',
  'medium',
  'low'
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  website text,
  country text not null default 'KE',
  industry text not null default 'technology',
  github_login text,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.membership_role not null default 'org_admin',
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  type text not null,
  criticality public.asset_criticality not null default 'medium',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.domains (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  hostname text not null,
  url text,
  https boolean,
  status_code integer,
  security_headers jsonb not null default '{}'::jsonb,
  technologies text[] not null default '{}',
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, hostname)
);

create table public.repositories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  provider text not null default 'github',
  external_id text,
  name text not null,
  full_name text not null,
  url text not null,
  visibility text not null default 'public',
  default_branch text,
  language text,
  description text,
  stars integer not null default 0,
  has_license boolean,
  last_scanned_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (organization_id, provider, full_name)
);

create table public.scans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  type public.scan_type not null default 'on_demand',
  status public.scan_status not null default 'queued',
  started_at timestamptz,
  completed_at timestamptz,
  summary jsonb not null default '{}'::jsonb,
  error text,
  created_at timestamptz not null default now()
);

create table public.risks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  scan_id uuid references public.scans (id) on delete set null,
  title text not null,
  description text not null default '',
  category text not null,
  severity public.severity not null,
  likelihood integer not null default 50 check (likelihood between 0 and 100),
  impact integer not null default 50 check (impact between 0 and 100),
  confidence integer not null default 70 check (confidence between 0 and 100),
  status public.risk_status not null default 'open',
  why_it_matters text,
  recommendation text,
  owner_role text,
  fingerprint text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, fingerprint)
);

create table public.evidence (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  risk_id uuid not null references public.risks (id) on delete cascade,
  source_type text not null,
  source_reference text,
  content text not null,
  confidence integer not null default 70 check (confidence between 0 and 100),
  trust_status public.trust_status not null default 'observed',
  observed_at timestamptz not null default now()
);

create table public.actions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  risk_id uuid references public.risks (id) on delete set null,
  title text not null,
  owner_role text,
  priority public.action_priority not null default 'medium',
  deadline timestamptz,
  status public.action_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.scores (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  scan_id uuid references public.scans (id) on delete set null,
  overall integer not null check (overall between 0 and 100),
  cybersecurity integer not null check (cybersecurity between 0 and 100),
  regulatory integer not null check (regulatory between 0 and 100),
  technology integer not null check (technology between 0 and 100),
  operational integer not null check (operational between 0 and 100),
  vendor integer not null check (vendor between 0 and 100),
  financial integer not null check (financial between 0 and 100),
  data integer not null check (data between 0 and 100),
  ai integer not null check (ai between 0 and 100),
  reputation integer not null check (reputation between 0 and 100),
  created_at timestamptz not null default now()
);

create table public.regulations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  jurisdiction text not null,
  category text not null,
  summary text not null,
  industries text[] not null default '{}'
);

create table public.organization_regulations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  regulation_id uuid not null references public.regulations (id) on delete cascade,
  applicability text not null default 'applicable',
  notes text,
  unique (organization_id, regulation_id)
);

create index memberships_user_id_idx on public.memberships (user_id);
create index memberships_org_id_idx on public.memberships (organization_id);
create index assets_org_id_idx on public.assets (organization_id);
create index domains_org_id_idx on public.domains (organization_id);
create index repositories_org_id_idx on public.repositories (organization_id);
create index scans_org_id_idx on public.scans (organization_id, created_at desc);
create index risks_org_id_idx on public.risks (organization_id, status, severity);
create index evidence_risk_id_idx on public.evidence (risk_id);
create index evidence_org_id_idx on public.evidence (organization_id);
create index actions_org_id_idx on public.actions (organization_id, status);
create index scores_org_id_idx on public.scores (organization_id, created_at desc);
create index org_regs_org_id_idx on public.organization_regulations (organization_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger organizations_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();

create trigger risks_updated_at
  before update on public.risks
  for each row execute function public.set_updated_at();

create trigger actions_updated_at
  before update on public.actions
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_org_member(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memberships
    where organization_id = org_id
      and user_id = auth.uid()
  );
$$;

create or replace function public.create_organization(
  p_name text,
  p_slug text,
  p_website text default null,
  p_country text default 'KE',
  p_industry text default 'technology',
  p_github_login text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.organizations (
    name, slug, website, country, industry, github_login, created_by
  )
  values (
    p_name, p_slug, p_website, p_country, p_industry, p_github_login, auth.uid()
  )
  returning id into v_org_id;

  insert into public.memberships (organization_id, user_id, role)
  values (v_org_id, auth.uid(), 'org_admin');

  return v_org_id;
end;
$$;

grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.create_organization(text, text, text, text, text, text) to authenticated;

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.assets enable row level security;
alter table public.domains enable row level security;
alter table public.repositories enable row level security;
alter table public.scans enable row level security;
alter table public.risks enable row level security;
alter table public.evidence enable row level security;
alter table public.actions enable row level security;
alter table public.scores enable row level security;
alter table public.regulations enable row level security;
alter table public.organization_regulations enable row level security;

create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "organizations_select_member"
  on public.organizations for select
  to authenticated
  using (public.is_org_member(id));

create policy "organizations_update_member"
  on public.organizations for update
  to authenticated
  using (public.is_org_member(id))
  with check (public.is_org_member(id));

create policy "memberships_select_member"
  on public.memberships for select
  to authenticated
  using (public.is_org_member(organization_id) or user_id = auth.uid());

create policy "assets_member_all"
  on public.assets for all
  to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy "domains_member_all"
  on public.domains for all
  to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy "repositories_member_all"
  on public.repositories for all
  to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy "scans_member_all"
  on public.scans for all
  to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy "risks_member_all"
  on public.risks for all
  to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy "evidence_member_all"
  on public.evidence for all
  to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy "actions_member_all"
  on public.actions for all
  to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy "scores_member_all"
  on public.scores for all
  to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy "regulations_read_authenticated"
  on public.regulations for select
  to authenticated
  using (true);

create policy "org_regs_member_all"
  on public.organization_regulations for all
  to authenticated
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

insert into public.regulations (code, name, jurisdiction, category, summary, industries)
values
  (
    'KE-DPA',
    'Kenya Data Protection Act, 2019',
    'KE',
    'privacy',
    'Governs collection, processing, storage and transfer of personal data in Kenya, including data subject rights and security safeguards.',
    array['financial_services','fintech','insurance','technology','saas','healthcare','telecommunications','retail','logistics','public_sector','professional_services']
  ),
  (
    'KE-AML',
    'Proceeds of Crime and Anti-Money Laundering Act',
    'KE',
    'aml',
    'Requires financial institutions and designated businesses to implement AML/CFT controls, customer due diligence and suspicious activity reporting.',
    array['financial_services','fintech','insurance']
  ),
  (
    'KE-CBK-CYBER',
    'CBK Guidance on Cybersecurity',
    'KE',
    'cybersecurity',
    'Central Bank of Kenya guidance on cybersecurity governance, incident response and third-party risk for supervised institutions.',
    array['financial_services','fintech']
  ),
  (
    'KE-NPS',
    'National Payment System Act',
    'KE',
    'financial',
    'Regulates payment service providers, electronic money and payment system operators in Kenya.',
    array['financial_services','fintech']
  ),
  (
    'KE-CA',
    'Companies Act, 2015',
    'KE',
    'governance',
    'Corporate governance, director duties, reporting and company administration requirements in Kenya.',
    array['financial_services','fintech','insurance','technology','saas','manufacturing','retail','logistics','healthcare','telecommunications','energy','agriculture','professional_services']
  ),
  (
    'KE-CONSUMER',
    'Consumer Protection Act',
    'KE',
    'consumer',
    'Protects consumers against unfair practices, including in digital and financial products.',
    array['financial_services','fintech','insurance','retail','saas']
  ),
  (
    'KE-EMPLOYMENT',
    'Employment Act',
    'KE',
    'employment',
    'Employment rights, contracts, termination and workplace obligations in Kenya.',
    array['financial_services','fintech','insurance','technology','saas','manufacturing','retail','logistics','healthcare','telecommunications','energy','agriculture','public_sector','professional_services']
  ),
  (
    'KE-TAX',
    'Tax Procedures Act / Income Tax Act',
    'KE',
    'tax',
    'Corporate tax, VAT and digital service tax obligations administered by the Kenya Revenue Authority.',
    array['financial_services','fintech','insurance','technology','saas','manufacturing','retail','logistics','healthcare','telecommunications','energy','agriculture','professional_services']
  );
