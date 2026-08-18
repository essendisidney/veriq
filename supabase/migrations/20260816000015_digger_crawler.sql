-- Permitted crawler records. Hashes enable the change digger without storing full pages.

create table if not exists public.veriq_crawl_pages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  url text not null,
  status text not null,
  content_type text not null default '',
  content_hash text not null default '',
  excerpt text not null default '',
  source_class text not null default 'company_web',
  reason text not null default '',
  observed_at timestamptz not null default now(),
  unique (organization_id, url)
);

create index if not exists veriq_crawl_pages_org_idx on public.veriq_crawl_pages (organization_id, observed_at desc);

alter table public.veriq_crawl_pages enable row level security;

drop policy if exists "veriq_crawl_pages_member_all" on public.veriq_crawl_pages;
create policy "veriq_crawl_pages_member_all"
  on public.veriq_crawl_pages for all
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

grant select, insert, update, delete on public.veriq_crawl_pages to authenticated;
