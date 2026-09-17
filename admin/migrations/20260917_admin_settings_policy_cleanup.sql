-- Consolidate the existing admin_settings policies after adding watermark controls.
begin;

drop policy if exists "settings visible to authorized admins" on public.admin_settings;
drop policy if exists admin_settings_read on public.admin_settings;
create policy admin_settings_read on public.admin_settings
for select to authenticated
using (public.current_admin_role()::text in ('owner','admin','editor'));

drop policy if exists admin_settings_update on public.admin_settings;
create policy admin_settings_update on public.admin_settings
for update to authenticated
using (public.current_admin_role()::text in ('owner','admin','editor'))
with check (public.current_admin_role()::text in ('owner','admin','editor'));

notify pgrst, 'reload schema';
commit;
