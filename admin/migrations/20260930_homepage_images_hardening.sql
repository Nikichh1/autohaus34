-- Supabase's schema default privileges also grant anon EXECUTE explicitly.
-- Revoke that grant, not just the PostgreSQL PUBLIC default.
begin;
revoke all on function public.activate_homepage_image(text,uuid,uuid,bigint), public.delete_homepage_image(uuid,boolean) from public, anon, authenticated;
grant execute on function public.activate_homepage_image(text,uuid,uuid,bigint), public.delete_homepage_image(uuid,boolean) to authenticated;
revoke select on public.homepage_images from anon;
grant select (id,slot,width,height,state,is_active) on public.homepage_images to anon;
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
  -- Even completed uploads can retain signed URLs for two hours. Avoid
  -- deleting a family while any issued upload URL can still recreate it.
  if target.created_at > now()-interval '125 minutes' then raise exception 'IMAGE_BUSY'; end if;
  if p_finish then
    if target.state <> 'deleting' then raise exception 'IMAGE_BUSY'; end if;
    delete from public.homepage_images where id=p_id;
  else
    update public.homepage_images set state='deleting' where id=p_id;
  end if;
end;
$$;
notify pgrst, 'reload schema';
commit;
