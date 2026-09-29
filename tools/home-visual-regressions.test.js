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

test("hero keeps every photograph contained in one clean 16:9 window", () => {
  const html = read("index.html");
  const css = read("style.css");
  assert.equal((html.match(/class="stage-media-fill"/g) || []).length, 0);
  assert.match(css, /\.stage-media img\{width:100%;height:100%;object-fit:contain\}/);
  assert.match(css, /\.stage-media\{[^}]*aspect-ratio:16 \/ 9/);
  assert.match(css, /\.stage-media\{[^}]*background:var\(--stage-bg\)/);
  assert.doesNotMatch(css, /\.stage-media \.stage-media-fill/);
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
