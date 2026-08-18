-- Privacy-by-design fields on the organisation (2.0 schema).

alter table public.organizations
  add column if not exists consent_scopes text[] not null default '{}',
  add column if not exists retention_class text not null default 'standard';
