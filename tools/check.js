"use strict";
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { spawnSync } = require("node:child_process");
const assert = require("node:assert/strict");
const root = path.resolve(__dirname, "..");
const files = [];
function walk(dir) {
  for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(rel);
    else if (/\.(?:js|cjs|mjs)$/.test(entry.name)) files.push(rel);
  }
}
for (const name of fs.readdirSync(root)) if (/\.js$/.test(name)) files.push(name);
for (const dir of ["admin", "api", "server", "data", "tools"]) walk(dir);
for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", path.join(root, file)], { encoding: "utf8" });
  assert.equal(result.status, 0, file + "\n" + result.stderr);
}
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, "data/vehicles.base.js"), "utf8"), context);
const cars = context.window.AH_VEHICLES;
assert.equal(cars.length, 87, "Canonical inventory must preserve all 87 imported cars");
assert.equal(new Set(cars.map(v => v.id)).size, cars.length, "Vehicle slugs must be unique");
let photos = new Set();
let equipment = 0;
for (const car of cars) {
  assert.ok(car.make && car.model && car.shots.length, car.id + " lacks core data");
  for (const url of car.shots) {
    const m = url.match(/\/(\d{4})\/(\d{2})\/([^/]+?)(?:-\d+x\d+)?\.(?:jpe?g|png)$/i);
    assert.ok(m, "Unexpected static photo URL: " + url);
    const key = m[1] + "-" + m[2] + "_" + m[3];
    photos.add(key);
    for (const width of [400, 800, 1280]) for (const ext of ["jpg", "webp"]) {
      assert.ok(fs.existsSync(path.join(root, "img/v", key + "-" + width + "." + ext)), "Missing photo: " + key);
    }
  }
  const file = path.join(root, "data/eq", car.id + ".js");
  if (fs.existsSync(file)) {
    const ctx = {window:{}};
    vm.runInNewContext(fs.readFileSync(file,"utf8"),ctx);
    assert.equal(ctx.window.AH_EQ.id, car.id);
    assert.equal(ctx.window.AH_EQ.en.length, ctx.window.AH_EQ.e.length, "BG/EN equipment mismatch: " + car.id);
    equipment++;
  }
}
for (const file of ["index.html", "vehicle.html", "concierge.html", "legal.html"]) {
  const html = fs.readFileSync(path.join(root, file), "utf8");
  assert.ok(!/Auto House|Auto Hause/i.test(html), file + " has incorrect brand");
  for (const match of html.matchAll(/(?:src|href)="([^"?#]+)(?:\?[^"#]*)?(?:#[^"]*)?"/g)) {
    const target = match[1];
    if (/^(?:https?:|mailto:|tel:|data:|#)/.test(target)) continue;
    assert.ok(fs.existsSync(path.resolve(root, target.replace(/^\//, ""))), file + " missing local asset " + target);
  }
}
const inventoryLoader = fs.readFileSync(path.join(root, "data/vehicles.js"), "utf8");
assert.ok(!/XMLHttpRequest|\beval\s*\(/.test(inventoryLoader), "Inventory must not block or evaluate remote code");
JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8"));
console.log("PASS: " + files.length + " JavaScript syntax checks; 87 unique cars; " + photos.size + " photos × 6 variants; " + equipment + " paired BG/EN equipment files; HTML assets and configuration.");
