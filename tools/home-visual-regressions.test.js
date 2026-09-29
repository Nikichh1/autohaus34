"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

test("the pale catalogue CTA has readable text over its dark hover fill", () => {
  const css = read("catalog.css");
  assert.match(css, /\.pale \.cpag__more:hover,\.pale \.cpag__more:focus-visible\s*\{[^}]*color:#fff/s);
  assert.match(css, /\.cpag__more::after\s*\{[^}]*background:var\(--primary\)/s);
});

test("mobile hero fills the frame with every slide, without an extra edge-fill image", () => {
  const html = read("index.html");
  const css = read("style.css");
  assert.equal((html.match(/class="stage-media-fill"/g) || []).length, 0);
  assert.equal((html.match(/<picture><source type="image\/webp" data-srcset="img\/(?:indoor_cars|autospa_night|outside-flags|coffee_bar-new)/g) || []).length, 4);
  assert.match(css, /\.stage-media picture img\{display:block;object-fit:cover\}/);
  assert.match(css, /\.stage-media\{aspect-ratio:4 \/ 3\}/);
  assert.doesNotMatch(css, /\.stage-media picture img\{object-fit:contain\}/);
});

test("inventory preview is never a blank reserved region and paints at readiness", () => {
  const html = read("index.html");
  const js = read("showroom.js");
  const css = read("catalog.css");
  assert.match(html, /id="pv-grid" aria-busy="true"><p class="catalog-status" role="status"/);
  assert.match(css, /#pv-grid\[aria-busy="true"\]\{min-height:120vh\}/);
  assert.match(js, /window\.AH_INVENTORY_SOURCE !== "managed"/);
  assert.match(js, /data-inventory-retry/);
  assert.match(js, /inventoryReady = true;\s*if \(isOpen\) apply\(true\);\s*paintPreview\(\);/);
  assert.doesNotMatch(js, /requestIdleCallback\(paintPreview/);
});

test("service, leasing and insurance cards use optimized local photographs", () => {
  const html = read("index.html");
  for (const name of ["service", "leasing", "insurance"]) {
    for (const width of [400, 800]) for (const ext of ["jpg", "webp"]) {
      const file = `img/wall-${name}-${width}.${ext}`;
      assert.ok(fs.existsSync(path.join(root, file)), `Missing ${file}`);
      assert.ok(html.includes(file), `Unreferenced ${file}`);
    }
  }
});
