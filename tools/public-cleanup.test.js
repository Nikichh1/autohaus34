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
  for (const [width, height, margin] of [[400, 245, 4], [800, 490, 8], [1280, 784, 13]])
    for (const format of ['jpg', 'webp']) for (const scale of [.22, .5, 1, 1.5]) {
      const src = photo.replace('1280.jpg', width + '.' + format);
      const clip = insets.clip(src, width, height, width * scale, height * scale, origin);
      assert.ok(Math.abs(Number(clip.match(/inset\(0 ([\d.]+)%\)/)[1]) - margin / width * 100) < 1e-10);
    }
  assert.equal(insets.clip(photo, 1280, 784, 1400, 784, origin), "inset(0 " + (73 / 1400 * 100) + "%)");
});

test("unknown photos, remote replacements and changed dimensions are never clipped", () => {
  for (const src of ["/img/v/unknown-1280.jpg", "https://other.test" + photo, "https://autohaus.bg/wp-content/uploads/2024/01/5-27.jpg", photo.replace(".jpg", ".avif"), photo.replace('1280', '800')]) {
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

test("all responsive variants preserve the audited matte at their exact scaled boundary", async () => {
  const sharp = require('sharp');
  for (const key of insets.keys) for (const format of ['jpg', 'webp']) {
    for (const [width, height, margin] of [[400, 245, 4], [800, 490, 8], [1280, 784, 13]]) {
      const file = key + '-' + width + '.' + format;
      const { data, info } = await sharp(path.join(__dirname, '../img/v', file)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      assert.equal(info.width, width, file);
      assert.equal(info.height, height, file);
      for (const right of [false, true]) {
        let nearWhite = 0, innerWhite = 0, total = 0;
        for (let y = 0; y < height; y++) for (let x = 0; x < margin; x++) {
          const at = (y * width + (right ? width - 1 - x : x)) * 3;
          const lo = Math.min(data[at], data[at + 1], data[at + 2]);
          const hi = Math.max(data[at], data[at + 1], data[at + 2]);
          if (lo >= 210 && hi - lo <= 40) { nearWhite++; if (x < margin - 1) innerWhite++; }
          total += (data[at] + data[at + 1] + data[at + 2]) / 3;
        }
        // Compression can blend the last matte column with the photograph;
        // every earlier column must remain uniformly near-white.
        assert.equal(innerWhite, height * (margin - 1), file + ' inner matte color');
        assert.ok(nearWhite / (height * margin) > .95, file + ' boundary matte color');
        assert.ok(total / (height * margin) > 239, file + ' matte luminance');
      }
    }
  }
});

test("lightbox preview and decoded image share a stable, unstretched contain box", () => {
  const css = fs.readFileSync(path.join(__dirname, '../style.css'), 'utf8');
  const rule = css.match(/\.lb img\{([^}]+)\}/);
  assert.ok(rule);
  assert.match(rule[1], /(?:^|;)\s*width:100%/);
  assert.match(rule[1], /(?:^|;)\s*height:100%/);
  assert.match(rule[1], /object-fit:contain/);
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

test("view-all control has no detached decorative arrow", () => {
  const html = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
  const match = html.match(/<a class="cpag__more"[^>]*>([\s\S]*?)<\/a>/);
  assert.ok(match);
  assert.doesNotMatch(match[1], /<svg|cpag__arr/);
  assert.match(fs.readFileSync(path.join(__dirname, "../catalog.css"), "utf8"), /\.cpag__more\{[\s\S]*?gap:0;/);
});
