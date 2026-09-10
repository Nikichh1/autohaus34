/* Optional PostgreSQL check: npm install --no-save --no-package-lock @electric-sql/pglite */
"use strict";
const {PGlite}=require("@electric-sql/pglite");
const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict");
(async()=>{
 const db=new PGlite();
 try {
  await db.exec("create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.sessions(id uuid primary key,user_id uuid);");
  // PGlite omits pgcrypto; gen_random_uuid is built into this PostgreSQL version.
  const sql=fs.readFileSync(path.join(__dirname,"../admin/schema.sql"),"utf8").replace("create extension if not exists pgcrypto;","");
  await db.exec(sql); await db.exec(sql);
  assert.equal((await db.query("select initialized from public.inventory_state")).rows[0].initialized,false);
  const rows=require("../api/admin/vehicles").initialInventory();
  assert.equal((await db.query("select public.import_initial_inventory($1::jsonb) as count",[JSON.stringify(rows)])).rows[0].count,87);
  assert.equal((await db.query("select count(*)::int as count from public.vehicles")).rows[0].count,87);
  assert.equal((await db.query("select public.import_initial_inventory($1::jsonb) as count",[JSON.stringify(rows)])).rows[0].count,0);
  await db.exec("delete from public.vehicles;");
  assert.equal((await db.query("select initialized from public.inventory_state")).rows[0].initialized,true);
  assert.equal((await db.query("select public.import_initial_inventory($1::jsonb) as count",[JSON.stringify(rows)])).rows[0].count,0);
  for(const role of ["anon","authenticated"]){
   assert.equal((await db.query("select has_table_privilege($1, 'public.vehicles', 'SELECT') as allowed",[role])).rows[0].allowed,false);
   assert.equal((await db.query("select has_function_privilege($1, 'public.import_initial_inventory(jsonb)', 'EXECUTE') as allowed",[role])).rows[0].allowed,false);
  }
  const ids=["00000000-0000-4000-8000-000000000001","00000000-0000-4000-8000-000000000002"];
  await db.query("insert into auth.sessions values ($1,$2)",ids);
  assert.equal((await db.query("select public.admin_session_active($1,$2) as active",ids)).rows[0].active,true);
  await db.exec("delete from auth.sessions;");
  assert.equal((await db.query("select public.admin_session_active($1,$2) as active",ids)).rows[0].active,false);
  console.log("PASS: PostgreSQL schema rerun, atomic 87-car import, replay protection, persistent empty state, browser-role denial and session revocation.");
 } finally {await db.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
