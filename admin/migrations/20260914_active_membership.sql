-- Resolve access from current membership and a non-revoked session, never a default owner role.
create or replace function public.current_admin_role()
returns public.admin_role language sql stable security definer set search_path = '' as $$
  select m.role from public.admin_members m
  where m.user_id = auth.uid() and m.active
    and exists (select 1 from auth.sessions s where s.user_id = auth.uid()
      and s.id::text = auth.jwt()->>'session_id')
  limit 1;
$$;
create or replace function public.is_active_admin()
returns boolean language sql stable set search_path = '' as $$
  select public.current_admin_role() is not null;
$$;
revoke all on function public.current_admin_role() from public;
revoke all on function public.is_active_admin() from public;
grant execute on function public.current_admin_role(), public.is_active_admin() to anon, authenticated, service_role;
