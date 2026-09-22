"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const read = file => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

// Extract a nested HTML element without assuming that its first closing div
// closes the wrapper. These static templates contain no scripts in the menu.
function region(html, opening) {
  const at = html.indexOf(opening);
  assert.notEqual(at, -1, opening);
  const tag = opening.match(/^<(\w+)/)[1];
  const tokens = new RegExp("<(/?)" + tag + "\\b[^>]*>", "g");
  tokens.lastIndex = at;
  let depth = 0, match;
  while ((match = tokens.exec(html))) {
    depth += match[1] ? -1 : 1;
    if (!depth) return html.slice(at, tokens.lastIndex);
  }
  assert.fail("Unclosed " + opening);
}

for (const page of ["index.html", "vehicle.html", "concierge.html", "legal.html"]) {
  test(page + " keeps every menu destination in the shared accessible layout", () => {
    const html = read(page);
    const menu = region(html, '<div class="mob"');
    const nav = region(menu, '<nav aria-label="Меню">');
    const prefix = page === "index.html" ? "" : "index.html";
    assert.deepEqual([...nav.matchAll(/href="([^"]+)"/g)].map(m => m[1]), [
      prefix + "#avtomobili", prefix + "#zastrahovki", prefix + "#lizing",
      prefix + "#servis", prefix + "#care", prefix + "#cafe",
      "concierge.html", "legal.html", "legal.html#imprint"
    ]);
    assert.match(menu, /role="dialog" aria-modal="true" aria-label="Меню" aria-hidden="true"/);
    assert.match(region(menu, '<div class="mob-head">'), /id="mob-close"/);
    assert.match(nav, /class="mob-primary"/);
    assert.equal([...region(nav, '<div class="mob-services">').matchAll(/<a\b/g)].length, 5);
    assert.match(nav, /class="mob-inquiry" href="concierge.html"/);
    assert.match(region(nav, '<div class="mob-utility">'), /data-contact/);
    const bottom = region(menu, '<div class="mob-bottom">');
    assert.match(region(bottom, '<div class="mob-meta">'), /social--menu/);
    assert.match(region(bottom, '<div class="mob-foot">'), /href="tel:\+359884777147"/);
    assert.match(bottom, /href="mailto:autohausbg@gmail.com"/);
    assert.equal([...html.matchAll(/id="mob"/g)].length, 1);
  });
}

const languageSetup = read("main.js").match(/\(function ensureMenuLanguage\(\) \{[\s\S]*?\}\)\(\);/)[0];
for (const lang of ["bg", "en"]) {
  test("menu language control joins the footer once and retains " + lang + " state", () => {
    let inserted;
    const social = {};
    const meta = { firstChild: social, insertBefore(group, before) {
      assert.equal(before, social);
      assert.equal(inserted, undefined);
      inserted = group;
    } };
    const sheet = {};
    const mob = { querySelector(selector) {
      return { ".mob-lang": inserted, ".mob__sheet": sheet, ".mob-meta": meta }[selector];
    } };
    const context = { $: id => id === "mob" ? mob : null, document: {
      documentElement: { lang },
      createElement: () => ({ setAttribute(name, value) { this[name] = value; } })
    } };
    vm.runInNewContext(languageSetup, context);
    vm.runInNewContext(languageSetup, context);
    assert.equal(inserted.className, "lang mob-lang");
    assert.equal(inserted.role, "group");
    assert.match(inserted.innerHTML, new RegExp('data-lang="' + lang + '" lang="' + lang + '" aria-pressed="true"'));
    assert.equal([...inserted.innerHTML.matchAll(/<button/g)].length, 2);
  });
}

test("menu language setup supports a cached older template without the metadata row", () => {
  const foot = {};
  let inserted;
  const sheet = { insertBefore(group, before) { assert.equal(before, foot); inserted = group; } };
  const mob = { querySelector: selector => ({ ".mob__sheet": sheet, ".mob-foot": foot }[selector]) };
  vm.runInNewContext(languageSetup, { $: () => mob, document: {
    documentElement: { lang: "bg" }, createElement: () => ({ setAttribute() {} })
  } });
  assert.equal(inserted.className, "lang mob-lang");
});

test("hidden Original plate cannot expose its logo over the real menu trigger", () => {
  const css = read("style.css");
  const original = css.match(/html\[data-ah-scroll-header="autohaus_original"\] \.plate\.is-on \.plate__in\{([^}]+)\}/);
  assert.ok(original);
  assert.match(original[1], /visibility:inherit!important/);
  assert.doesNotMatch(original[1], /visibility:visible/);
  // The catalogue explicitly displays the same header, even at scroll top.
  assert.match(css, /html\.shw-open #plate \.plate__in\{\s*visibility:visible!important/);
});
