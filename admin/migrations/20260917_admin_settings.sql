-- Global image-processing settings shared by every vehicle editor.
begin;

create table if not exists public.admin_settings (
  singleton boolean primary key default true check (singleton),
  updated_at timestamptz not null default now()
);

alter table public.admin_settings add column if not exists watermark_enabled boolean not null default false;
alter table public.admin_settings add column if not exists watermark_transparency smallint not null default 75;
alter table public.admin_settings drop constraint if exists admin_settings_watermark_transparency_check;
alter table public.admin_settings add constraint admin_settings_watermark_transparency_check
  check (watermark_transparency between 0 and 100);

insert into public.admin_settings (singleton)
values (true)
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
