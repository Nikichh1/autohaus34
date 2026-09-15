"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const insets = require("../data/photo-insets");
const { matteInsets, audit } = require("./photo-insets");
const origin = "https://example.test";
const photo = "/img/v/2024-01_5-27-1280.jpg";

test("lightbox removes exactly the verified photo matte across viewport scales", () => {
  for (const scale of [.22, .5, 1, 1.5]) {
    const clip = insets.clip(photo, 1280, 784, 1280 * scale, 784 * scale, origin);
    assert.ok(Math.abs(Number(clip.match(/inset\(0 ([\d.]+)%\)/)[1]) - 1.015625) < 1e-10);
  }
  assert.equal(insets.clip(photo, 1280, 784, 1400, 784, origin), "inset(0 " + (73 / 1400 * 100) + "%)");
});

test("unknown photos, remote replacements and changed dimensions are never clipped", () => {
  for (const src of ["/img/v/unknown-1280.jpg", "https://other.test" + photo, "https://autohaus.bg/wp-content/uploads/2024/01/5-27.jpg", photo.replace(".jpg", ".webp")]) {
    assert.equal(insets.clip(src, 1280, 784, 640, 392, origin), "");
  }
  assert.equal(insets.clip(photo, 1280, 800, 640, 400, origin), "");
  assert.equal(insets.clip(photo, 1280, 784, 0, 0, origin), "");
  assert.ok(insets.clip(origin + photo + "?v=123", 1280, 784, 640, 392, origin));
});

test("matte detection does not mistake white subject matter for the legacy frame", () => {
  const info = { width: 1280, height: 784, channels: 3 };
  const raw = Buffer.alloc(1280 * 784 * 3, 50);
  for (let y = 0; y < 784; y++) for (let x = 0; x < 13; x++) {
    raw.fill(250, (y * 1280 + x) * 3, (y * 1280 + x + 1) * 3);
    raw.fill(250, (y * 1280 + 1279 - x) * 3, (y * 1280 + 1280 - x) * 3);
  }
  assert.deepEqual(matteInsets(raw, info), [13, 13, 1280, 784]);
  assert.equal(matteInsets(Buffer.alloc(raw.length, 250), info), null);
  assert.equal(matteInsets(Buffer.alloc(raw.length, 50), info), null);
  assert.equal(matteInsets(raw, { ...info, height: 800 }), null);
});

test("every allowlisted margin is verified against the bundled photo pixels", async () => {
  assert.deepEqual(insets.keys, Object.keys(await audit()).sort());
});

test("homepage keeps only the actual menu button on the header left", () => {
  const html = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
  const left = html.match(/<div class="hd-zone hd-zone--start">([\s\S]*?)<\/div>/);
  assert.ok(left);
  assert.match(left[1], /id="hd-menu"/);
  assert.doesNotMatch(left[1], /<a\b|<ul\b/);
  assert.match(html, /id="mob"/);
  assert.match(html, /href="#zastrahovki"/);
  assert.match(html, /href="#lizing"/);
});

test("wide hero CTA is anchored at the right inset, not centred in a spare column", () => {
  const css = fs.readFileSync(path.join(__dirname, "../style.css"), "utf8");
  assert.match(css, /\.btn-group--stage\{flex-direction:row;align-items:flex-end;justify-content:flex-end;flex:0 0 auto\}/);
  assert.doesNotMatch(css, /\.btn-group--stage\{[^}]*flex:1 0 33\.3333%/);
  assert.doesNotMatch(css, /\.btn-group--stage\{flex-direction:row;justify-content:center;padding-inline-start:32px\}/);
});
