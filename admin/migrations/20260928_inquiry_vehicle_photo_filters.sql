-- Additive, reversible controls. Keep the retired global filter columns for
-- compatibility, but copy their current appearance to each existing vehicle.
begin;

alter table public.admin_settings
  add column if not exists inquiry_enabled boolean not null default true;

-- Run the one-time copy only while introducing the columns. Re-running this
-- migration must never erase per-vehicle choices made after the first run.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'vehicles' and column_name = 'photo_filter'
  ) then
    alter table public.vehicles add column photo_filter text not null default 'none';
    alter table public.vehicles add column photo_filter_strength smallint not null default 35;
    update public.vehicles as v
    set photo_filter = case when s.photo_filter in ('none','balanced','showroom') then s.photo_filter else 'none' end,
        photo_filter_strength = greatest(0, least(100, coalesce(s.photo_filter_strength, 35)))
    from public.admin_settings as s
    where s.singleton = true;
  end if;
end $$;

alter table public.vehicles drop constraint if exists vehicles_photo_filter_check;
alter table public.vehicles add constraint vehicles_photo_filter_check
  check (photo_filter in ('none','balanced','showroom'));
alter table public.vehicles drop constraint if exists vehicles_photo_filter_strength_check;
alter table public.vehicles add constraint vehicles_photo_filter_strength_check
  check (photo_filter_strength between 0 and 100);

notify pgrst, 'reload schema';
commit;
