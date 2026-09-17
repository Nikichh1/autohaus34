begin;

alter table public.vehicles
  add column if not exists notes_en jsonb not null default '[]'::jsonb;

notify pgrst, 'reload schema';
commit;
