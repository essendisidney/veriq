create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.is_org_member(uuid) from public, anon;
revoke execute on function public.create_organization(text, text, text, text, text, text) from public, anon;
grant execute on function public.create_organization(text, text, text, text, text, text) to authenticated;
grant execute on function public.is_org_member(uuid) to authenticated;

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "memberships_select_member" on public.memberships;

create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()));

create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "memberships_select_member"
  on public.memberships for select
  to authenticated
  using (public.is_org_member(organization_id) or user_id = (select auth.uid()));

create index if not exists actions_risk_id_idx on public.actions (risk_id);
create index if not exists org_regs_regulation_id_idx on public.organization_regulations (regulation_id);
create index if not exists organizations_created_by_idx on public.organizations (created_by);
create index if not exists risks_scan_id_idx on public.risks (scan_id);
create index if not exists scores_scan_id_idx on public.scores (scan_id);
