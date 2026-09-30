"use strict";
const { test }=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const { PGlite }=require("@electric-sql/pglite");
test("real SQL isolates archives and safely activates/restores/deletes with concurrency checks",async()=>{
 const db=new PGlite();
 const user="00000000-0000-4000-8000-000000000001",one="12345678-1234-4123-8123-123456789012",two="12345678-1234-4123-8123-123456789013";
 try{
  await db.exec(`create role anon;create role authenticated;create schema auth;
    create function auth.uid() returns uuid language sql stable as $$select '${user}'::uuid$$;
    create function public.current_admin_role() returns text language sql stable as $$select current_setting('app.role',true)$$;
    create function public.is_active_admin() returns boolean language sql stable as $$select public.current_admin_role() in ('owner','admin','editor','viewer')$$;
    grant usage on schema auth to authenticated;grant execute on function auth.uid(),public.current_admin_role(),public.is_active_admin() to authenticated;
    create table public.admin_settings(singleton boolean primary key);insert into public.admin_settings values(true);grant select on public.admin_settings to anon,authenticated;`);
  await db.exec(fs.readFileSync(path.join(__dirname,"../admin/migrations/20260930_homepage_images.sql"),"utf8"));
  await db.exec("select set_config('app.role','owner',false);set role authenticated;");
  for(const id of [one,two])await db.query("insert into public.homepage_images(id,slot,width,height,file_name,created_by) values($1,'hero-0',1920,1080,'test.jpg',$2)",[id,user]);
  const swap=(id,expected,bytes=7000)=>db.query("select public.activate_homepage_image('hero-0',$1,$2,$3)",[id,expected,bytes]);
  await swap(one,null);await assert.rejects(swap(two,null),/STALE_IMAGE/);await swap(two,one);
  assert.equal((await db.query("select count(*)::int as n from public.homepage_images where is_active")).rows[0].n,1);
  await assert.rejects(db.query("select public.delete_homepage_image($1,false)",[two]),/IMAGE_ACTIVE/);
  await db.exec("reset role;set role anon;");
  assert.equal((await db.query("select id from public.homepage_images")).rows[0].id,two);
  assert.equal((await db.query("select homepage_media from public.public_admin_settings")).rows[0].homepage_media.length,1);
  await assert.rejects(db.query("select public.activate_homepage_image('hero-0',null,$1,0)",[two]),/permission denied/);
  await db.exec("reset role;select set_config('app.role','viewer',false);set role authenticated;");
  await assert.rejects(swap(one,two),/MEDIA_FORBIDDEN/);
  await db.exec("reset role;select set_config('app.role','editor',false);set role authenticated;");
  await swap(one,two,0);await assert.rejects(db.query("select public.delete_homepage_image($1,false)",[two]),/MEDIA_FORBIDDEN/);
  await db.exec("reset role;select set_config('app.role','owner',false);set role authenticated;");
  await assert.rejects(db.query("select public.delete_homepage_image($1,false)",[two]),/IMAGE_BUSY/);
  await db.exec("reset role;update public.homepage_images set created_at=now()-interval '126 minutes';set role authenticated;");
  await db.query("select public.delete_homepage_image($1,false)",[two]);await assert.rejects(swap(two,one),/IMAGE_BUSY/);
  await db.query("select public.delete_homepage_image($1,true)",[two]);
  assert.equal((await db.query("select count(*)::int as n from public.homepage_images")).rows[0].n,1);
  await db.query("select public.activate_homepage_image('hero-0',null,$1,0)",[one]);
  assert.equal((await db.query("select count(*)::int as n from public.homepage_images where is_active")).rows[0].n,0);
 }finally{await db.close();}
});
