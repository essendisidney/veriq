create or replace function public.delete_organization(p_org_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1
    from public.memberships
    where organization_id = p_org_id
      and user_id = auth.uid()
      and role = 'org_admin'
  ) then
    raise exception 'Not allowed';
  end if;

  delete from public.organizations where id = p_org_id;
end;
$$;

revoke execute on function public.delete_organization(uuid) from public, anon;
grant execute on function public.delete_organization(uuid) to authenticated;
