-- The public storefront needs read-only access to the two non-sensitive
-- watermark display settings. Writes remain restricted to authenticated
-- admins by the existing update policy.
begin;

grant select on public.admin_settings to anon;

drop policy if exists admin_settings_public_read on public.admin_settings;
create policy admin_settings_public_read on public.admin_settings
for select to anon
using (singleton = true);

notify pgrst, 'reload schema';
commit;
