-- AutoHaus admin schema. Run this complete file in the Supabase SQL Editor.
-- Idempotent: re-running upgrades the earlier schema without replacing vehicles.
begin;

create extension if not exists pgcrypto;

create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  ref text not null default '',
  make text not null,
  model text not null,
  full_name text not null,
  body_type text not null default '',
  colour text not null default '',
  transmission text not null default '',
  fuel text not null default '',
  mileage bigint,
  first_registration_year integer,
  first_registration_month integer,
  unregistered boolean not null default false,
  horsepower integer,
  price numeric(14,2),
  chapter text not null default 'saloon',
  tags jsonb not null default '[]'::jsonb,
  notes jsonb not null default '[]'::jsonb,
  description_bg text not null default '',
  description_en text not null default '',
  description_source text not null default '',
  description_review_notes jsonb not null default '[]'::jsonb,
  equipment_bg jsonb not null default '[]'::jsonb,
  equipment_en jsonb not null default '[]'::jsonb,
  images jsonb not null default '[]'::jsonb,
  source_url text not null default '',
  published boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vehicles_month_check check (first_registration_month is null or first_registration_month between 1 and 12),
  constraint vehicles_year_check check (first_registration_year is null or first_registration_year between 1900 and 2100),
  constraint vehicles_mileage_check check (mileage is null or mileage >= 0),
  constraint vehicles_hp_check check (horsepower is null or horsepower >= 0),
  constraint vehicles_price_check check (price is null or price >= 0)
);

alter table public.vehicles add column if not exists sort_order integer not null default 0;
alter table public.vehicles add column if not exists description_source text not null default '';
alter table public.vehicles add column if not exists description_review_notes jsonb not null default '[]'::jsonb;

create index if not exists vehicles_published_idx on public.vehicles (published, sort_order asc, updated_at desc);
create index if not exists vehicles_make_model_idx on public.vehicles (make, model);

-- This flag deliberately survives deleting or unpublishing the final car.
-- A managed empty catalogue must never resurrect the 87 static listings.
create table if not exists public.inventory_state (
  singleton boolean primary key default true check (singleton),
  initialized boolean not null default false,
  initialized_at timestamptz
);
insert into public.inventory_state (singleton, initialized, initialized_at)
select true, exists(select 1 from public.vehicles),
  case when exists(select 1 from public.vehicles) then now() else null end
on conflict (singleton) do nothing;
update public.inventory_state set initialized = true, initialized_at = coalesce(initialized_at, now())
where not initialized and exists(select 1 from public.vehicles);

alter table public.vehicles enable row level security;
alter table public.inventory_state enable row level security;
-- No browser database access, even if an older project had permissive policies.
revoke all on public.vehicles, public.inventory_state from public, anon, authenticated;
grant select, insert, update, delete on public.vehicles to service_role;
grant select on public.inventory_state to service_role;

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = clock_timestamp();
  return new;
end;
$$;
revoke all on function public.touch_updated_at() from public, anon, authenticated;

drop trigger if exists vehicles_touch_updated_at on public.vehicles;
create trigger vehicles_touch_updated_at before update on public.vehicles
for each row execute function public.touch_updated_at();

create or replace function public.activate_managed_inventory()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.inventory_state set initialized = true, initialized_at = coalesce(initialized_at, now())
  where singleton and not initialized;
  return null;
end;
$$;
revoke all on function public.activate_managed_inventory() from public, anon, authenticated;
drop trigger if exists vehicles_activate_inventory on public.vehicles;
create trigger vehicles_activate_inventory after insert or update or delete on public.vehicles
for each row execute function public.activate_managed_inventory();

-- Only the server can check verified JWT session IDs. Logging out removes the
-- auth.sessions row, so an otherwise unexpired access token is rejected too.
create or replace function public.admin_session_active(session_uuid uuid, user_uuid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from auth.sessions where id = session_uuid and user_id = user_uuid);
$$;
revoke all on function public.admin_session_active(uuid, uuid) from public, anon, authenticated;
grant execute on function public.admin_session_active(uuid, uuid) to service_role;

-- The server reads the canonical files; request bodies cannot replace the import.
-- All 87 rows and activation commit together. A replay never changes live edits.
create or replace function public.import_initial_inventory(initial_vehicles jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  already_initialized boolean;
  imported_count integer;
begin
  -- Take locks in the same order as normal vehicle writes to avoid deadlocks.
  lock table public.vehicles in share row exclusive mode;
  select initialized into already_initialized from public.inventory_state where singleton for update;
  if already_initialized or exists(select 1 from public.vehicles) then
    return 0;
  end if;
  if jsonb_typeof(initial_vehicles) is distinct from 'array' then
    raise exception 'Initial inventory must be an array' using errcode = '22023';
  end if;
  if jsonb_array_length(initial_vehicles) <> 87
     or (select count(distinct item->>'slug') from jsonb_array_elements(initial_vehicles) item) <> 87 then
    raise exception 'Initial inventory must contain 87 distinct vehicles' using errcode = '22023';
  end if;

  insert into public.vehicles (
    slug, ref, make, model, full_name, body_type, colour, transmission, fuel,
    mileage, first_registration_year, first_registration_month, unregistered,
    horsepower, price, chapter, tags, notes, description_bg, description_en,
    description_source, description_review_notes, equipment_bg, equipment_en,
    images, source_url, published, sort_order
  ) select
    slug, ref, make, model, full_name, body_type, colour, transmission, fuel,
    mileage, first_registration_year, first_registration_month, unregistered,
    horsepower, price, chapter, tags, notes, description_bg, description_en,
    description_source, description_review_notes, equipment_bg, equipment_en,
    images, source_url, published, sort_order
  from jsonb_populate_recordset(null::public.vehicles, initial_vehicles);
  get diagnostics imported_count = row_count;
  update public.inventory_state set initialized = true, initialized_at = coalesce(initialized_at, now()) where singleton;
  return imported_count;
end;
$$;
revoke all on function public.import_initial_inventory(jsonb) from public, anon, authenticated;
grant execute on function public.import_initial_inventory(jsonb) to service_role;

-- Refresh PostgREST's RPC/column cache after upgrading an existing project.
notify pgrst, 'reload schema';
commit;
