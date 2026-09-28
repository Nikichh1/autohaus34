-- Preserve the current interactive card wall unless an admin explicitly turns it off.
begin;

alter table public.admin_settings
  add column if not exists wall_cards_interactive boolean not null default true;

notify pgrst, 'reload schema';
commit;
