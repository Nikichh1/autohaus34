-- Additive migration: does not alter vehicles, existing settings, or existing files.
begin;
create table if not exists public.homepage_images (
  id uuid primary key default gen_random_uuid(),
  slot text not null check (slot in ('hero-0','hero-1','hero-2','hero-3','hero-4','wall-care','wall-servis','wall-lizing','wall-zastrahovki','wall-cafe')),
  width integer not null check (width between 64 and 1920),
  height integer not null check (height between 64 and 1920),
  file_name text not null default '' check (length(file_name) <= 180),
  byte_count bigint not null default 0 check (byte_count between 0 and 29360128),
  state text not null default 'pending' check (state in ('pending','ready','deleting')),
  is_active boolean not null default false,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  check (not is_active or state = 'ready')
);
create unique index if not exists homepage_images_active_slot on public.homepage_images(slot) where is_active;
alter table public.homepage_images enable row level security;
revoke all on public.homepage_images from anon, authenticated;
grant select (id,slot,width,height,state,is_active) on public.homepage_images to anon;
grant select on public.homepage_images to authenticated;
grant insert (id,slot,width,height,file_name,created_by) on public.homepage_images to authenticated;
create policy homepage_images_public_read on public.homepage_images for select to anon using (is_active and state = 'ready');
create policy homepage_images_admin_read on public.homepage_images for select to authenticated using (public.is_active_admin());
create policy homepage_images_upload on public.homepage_images for insert to authenticated with check (
  public.current_admin_role()::text in ('owner','admin','editor') and created_by = auth.uid() and not is_active and state = 'pending'
);

create or replace function public.activate_homepage_image(p_slot text, p_id uuid, p_expected uuid, p_bytes bigint default 0)
returns void language plpgsql security definer set search_path = '' as $$
declare current_id uuid; target public.homepage_images;
begin
  if coalesce(public.current_admin_role()::text,'') not in ('owner','admin','editor') then raise exception 'MEDIA_FORBIDDEN' using errcode = '42501'; end if;
  if p_slot not in ('hero-0','hero-1','hero-2','hero-3','hero-4','wall-care','wall-servis','wall-lizing','wall-zastrahovki','wall-cafe') then raise exception 'INVALID_SLOT'; end if;
  perform pg_advisory_xact_lock(hashtextextended('homepage-media:' || p_slot,0));
  select id into current_id from public.homepage_images where slot=p_slot and is_active for update;
  if current_id is distinct from p_expected then raise exception 'STALE_IMAGE'; end if;
  if p_id is not null then
    select * into target from public.homepage_images where id=p_id and slot=p_slot for update;
    if not found or target.state = 'deleting' then raise exception 'IMAGE_BUSY'; end if;
    if target.state = 'pending' and (target.created_by <> auth.uid() or p_bytes <= 0) then raise exception 'IMAGE_BUSY'; end if;
  end if;
  update public.homepage_images set is_active=false where slot=p_slot and is_active;
  if p_id is not null then
    update public.homepage_images set is_active=true,state='ready',byte_count=case when p_bytes>0 then p_bytes else byte_count end where id=p_id;
  end if;
end;
$$;
create or replace function public.delete_homepage_image(p_id uuid, p_finish boolean default false)
returns void language plpgsql security definer set search_path = '' as $$
declare target public.homepage_images;
begin
  if coalesce(public.current_admin_role()::text,'') not in ('owner','admin') then raise exception 'MEDIA_FORBIDDEN' using errcode = '42501'; end if;
  select * into target from public.homepage_images where id=p_id;
  if not found then return; end if;
  perform pg_advisory_xact_lock(hashtextextended('homepage-media:' || target.slot,0));
  select * into target from public.homepage_images where id=p_id for update;
  if not found then return; end if;
  if target.is_active then raise exception 'IMAGE_ACTIVE'; end if;
  -- Signed URLs expire after two hours. Do not let an interrupted upload recreate
  -- deleted files after the metadata has been removed.
  if target.created_at > now()-interval '125 minutes' then raise exception 'IMAGE_BUSY'; end if;
  if p_finish then
    if target.state <> 'deleting' then raise exception 'IMAGE_BUSY'; end if;
    delete from public.homepage_images where id=p_id;
  else
    update public.homepage_images set state='deleting' where id=p_id;
  end if;
end;
$$;
revoke all on function public.activate_homepage_image(text,uuid,uuid,bigint), public.delete_homepage_image(uuid,boolean) from public, anon, authenticated;
grant execute on function public.activate_homepage_image(text,uuid,uuid,bigint), public.delete_homepage_image(uuid,boolean) to authenticated;

-- One public request reads only active photos, never filenames/uploaders/archive.
create view public.public_admin_settings with (security_invoker=true) as
select s.*, coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'slot',m.slot,'width',m.width,'height',m.height))
  from public.homepage_images m where m.is_active and m.state='ready'),'[]'::jsonb) as homepage_media
from public.admin_settings s;
grant select on public.public_admin_settings to anon, authenticated;
notify pgrst, 'reload schema';
commit;
