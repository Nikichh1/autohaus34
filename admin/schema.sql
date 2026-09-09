-- Auto House admin schema for Supabase/Postgres.
-- Run once in Supabase SQL Editor.

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

-- Safe when this file is re-run against an earlier version of the table.
alter table public.vehicles add column if not exists sort_order integer not null default 0;

create index if not exists vehicles_published_idx on public.vehicles (published, sort_order asc, updated_at desc);
create index if not exists vehicles_make_model_idx on public.vehicles (make, model);

alter table public.vehicles enable row level security;
-- Intentionally no anon/authenticated policies. The browser never talks to
-- this table directly; only server routes holding SUPABASE_SERVICE_ROLE_KEY do.

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists vehicles_touch_updated_at on public.vehicles;
create trigger vehicles_touch_updated_at
before update on public.vehicles
for each row execute function public.touch_updated_at();
