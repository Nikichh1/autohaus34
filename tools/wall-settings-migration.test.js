"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { PGlite } = require("@electric-sql/pglite");

test("wall-card setting migration defaults on and preserves an admin choice on rerun", async () => {
  const db = new PGlite();
  try {
    await db.exec("create table public.admin_settings (singleton boolean primary key default true); insert into public.admin_settings values (true);");
    const migration = fs.readFileSync(path.join(__dirname, "../admin/migrations/20260928_wall_cards_interactive.sql"), "utf8");
    await db.exec(migration);
    assert.equal((await db.query("select wall_cards_interactive from public.admin_settings")).rows[0].wall_cards_interactive, true);
    await db.exec("update public.admin_settings set wall_cards_interactive = false;");
    await db.exec(migration);
    assert.equal((await db.query("select wall_cards_interactive from public.admin_settings")).rows[0].wall_cards_interactive, false);
  } finally {
    await db.close();
  }
});
