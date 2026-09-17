-- Global image-processing settings shared by every vehicle editor.
begin;

create table if not exists public.admin_settings (
  singleton boolean primary key default true check (singleton),
  watermark_enabled boolean not null default false,
  watermark_transparency smallint not null default 75 check (watermark_transparency between 0 and 100),
  updated_at timestamptz not null default now()
);

insert into public.admin_settings (singleton, watermark_enabled, watermark_transparency)
values (true, false, 75)
on conflict (singleton) do nothing;

alter table public.admin_settings enable row level security;
revoke all on public.admin_settings from public, anon;
grant select, update on public.admin_settings to authenticated, service_role;

drop policy if exists admin_settings_read on public.admin_settings;
create policy admin_settings_read on public.admin_settings
for select to authenticated
using (public.is_active_admin());

drop policy if exists admin_settings_update on public.admin_settings;
create policy admin_settings_update on public.admin_settings
for update to authenticated
using (public.current_admin_role()::text in ('owner','admin','editor'))
with check (public.current_admin_role()::text in ('owner','admin','editor'));

notify pgrst, 'reload schema';
commit;
