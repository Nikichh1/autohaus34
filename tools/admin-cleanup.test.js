"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { normalizeVehicle } = require("../server/admin-lib");

const root = path.join(__dirname, "..");
const source = fs.readFileSync(path.join(root, "admin/admin.js"), "utf8");
const startup = "translateShell(); loadVehicles(true);";

function harness() {
  const nodes = new Map(), requests = [], storage = new Map(), renders = [];
  function node(id) {
    if (!nodes.has(id)) nodes.set(id, {
      value: "", checked: false, dataset: {}, textContent: "", innerHTML: "",
      classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
      setAttribute() {}, removeAttribute() {}, addEventListener() {}, focus() {},
      querySelectorAll() { return []; }, querySelector() { return node("heading"); }
    });
    return nodes.get(id);
  }
  const form = node("car-form");
  form.elements = Object.fromEntries([
    "make", "model", "full_name", "slug", "ref", "body_type", "colour", "transmission", "fuel",
    "mileage", "horsepower", "price", "first_registration_year", "first_registration_month", "unregistered", "notes"
  ].map(name => [name, node(name)]));
  form.elements.make.value = "Mercedes-Benz";
  form.elements.model.value = "S 500 L";
  form.elements.fuel.value = "petrol";
  form.elements.transmission.value = "auto";
  const body = node("body");
  body.dataset = { adminUser: "cleanup-test", adminRole: "owner" };
  const document = { readyState: "complete", body, documentElement: {}, getElementById: node, querySelectorAll: () => [], querySelector: () => null, addEventListener() {} };
  const store = { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) };
  const window = { localStorage: store, sessionStorage: store, addEventListener() {}, scrollTo() {} };
  assert.ok(source.includes(startup), "Update the cleanup harness if admin startup changes");
  vm.runInNewContext(source.replace(startup, `
    updateSaveState = function () {};
    bindEditor = function () {};
    renderImages = function (index) { recordRender(index); };
    window.__cleanup = { state: state, editor: editor, collectForm: collectForm,
      saveCar: saveCar, moveImage: moveImage, blankVehicle: blankVehicle };
  `), {
    document, window, location: { hash: "#dashboard" }, history: { replaceState() {}, pushState() {} },
    console, Intl, Map, Promise, Date, confirm: () => true,
    setTimeout: () => 1, clearTimeout() {}, requestAnimationFrame: callback => callback(),
    recordRender: index => renders.push(index),
    fetch: async (url, options) => {
      const body = JSON.parse(options.body);
      requests.push({ url, options, body });
      return { ok: true, status: 200, json: async () => ({ vehicle: {
        ...window.__cleanup.state.current, ...body,
        id: "saved-vehicle", updated_at: "2026-09-15T12:00:00Z"
      } }) };
    }
  }, { filename: "admin/admin.js" });
  return { admin: window.__cleanup, node, form, requests, renders };
}

function savedVehicle() {
  return {
    id: "saved-vehicle", slug: "mercedes-benz-s-500-l", make: "Mercedes-Benz", model: "S 500 L",
    chapter: "performance", tags: ["performance", "delivery"], source_url: "https://autohaus.bg/car/mercedes-benz-s-500-l/",
    published: false, updated_at: "2026-09-15T11:00:00Z", equipment_bg: [], equipment_en: [],
    images: ["front", "cabin", "rear"].map((name, position) => ({
      original: "/img/v/" + name + ".jpg", variants: { jpg1280: "/img/v/" + name + "_1280.jpg" },
      legacy: true, width: 1280, height: 800, position
    }))
  };
}

test("removed editor fields do not erase saved category, tags or provenance", async () => {
  const h = harness(), existing = savedVehicle();
  h.admin.state.current = existing;
  h.admin.state.dirty = true;
  assert.equal(h.form.elements.chapter, undefined);
  assert.equal(h.form.elements.tags, undefined);
  assert.equal(h.form.elements.source_url, undefined);
  await h.admin.saveCar();
  assert.equal(h.requests.length, 1);
  const { body, options } = h.requests[0];
  assert.equal(options.method, "PATCH");
  assert.equal(body.chapter, existing.chapter);
  assert.deepEqual(body.tags, existing.tags);
  assert.equal(body.source_url, existing.source_url);
  assert.equal(body.if_unmodified_since, existing.updated_at);
  const normalized = normalizeVehicle({ ...existing, ...body });
  assert.equal(normalized.error, undefined);
  assert.equal(normalized.row.chapter, existing.chapter);
  assert.deepEqual(normalized.row.tags, existing.tags);
  assert.equal(normalized.row.source_url, "", "Self-owned inventory clears retired provenance without blocking save");
});

test("new vehicles retain valid metadata defaults without retired form inputs", () => {
  const h = harness();
  h.admin.state.current = h.admin.blankVehicle();
  const body = h.admin.collectForm();
  assert.equal(body.chapter, "saloon");
  assert.equal(body.tags.length, 0);
  assert.equal(body.source_url, "");
  assert.equal(normalizeVehicle(body).error, undefined);
});

test("editing exposes Bulgarian equipment and read-only English previews", () => {
  const h = harness();
  h.admin.editor(savedVehicle(), false);
  const html = h.node("admin-view").innerHTML;
  assert.doesNotMatch(html, /name="(?:chapter|tags|source_url)"/);
  assert.doesNotMatch(html, /ah-quick|AutoHaus URL|Original text · team only/);
  for (const id of ["equipment-bg", "equipment-en", "notes-en-preview"]) {
    assert.equal((html.match(new RegExp('id="' + id + '"', "g")) || []).length, 1);
  }
  assert.match(html, /id="equipment-en"[^>]*readonly/);
  assert.doesNotMatch(html, /id="source-text"/);
});

test("photo reordering retains every asset and saves dense positions in visual order", async () => {
  const h = harness(), existing = savedVehicle();
  h.admin.state.current = existing;
  const originalAssets = new Map(existing.images.map(image => [image.original, JSON.stringify(image.variants)]));
  h.admin.moveImage(2, 0);
  assert.deepEqual(Array.from(existing.images, image => image.original), ["/img/v/rear.jpg", "/img/v/front.jpg", "/img/v/cabin.jpg"]);
  assert.deepEqual(Array.from(existing.images, image => image.position), [0, 1, 2]);
  assert.equal(h.admin.state.dirty, true);
  assert.equal(h.admin.state.removed.length, 0);
  for (const image of existing.images) assert.equal(JSON.stringify(image.variants), originalAssets.get(image.original));
  const collected = h.admin.collectForm();
  collected.images[0].variants.jpg1280 = "/not-the-saved-value.jpg";
  assert.equal(existing.images[0].variants.jpg1280, "/img/v/rear_1280.jpg");
  collected.tags.push("not-saved");
  assert.deepEqual(existing.tags, ["performance", "delivery"]);
  await h.admin.saveCar();
  const body = h.requests[0].body;
  assert.deepEqual(body.images.map(image => image.original), ["/img/v/rear.jpg", "/img/v/front.jpg", "/img/v/cabin.jpg"]);
  assert.deepEqual(body.images.map(image => image.position), [0, 1, 2]);
});

test("photo movement rejects invalid destinations without changing assets", () => {
  const h = harness();
  h.admin.state.current = savedVehicle();
  const before = JSON.stringify(h.admin.state.current.images);
  for (const [from, to] of [[0, -1], [0, 3], [-1, 0], [3, 0], [1, 1]]) h.admin.moveImage(from, to);
  assert.equal(JSON.stringify(h.admin.state.current.images), before);
  assert.equal(h.admin.state.dirty, false);
  assert.equal(h.renders.length, 0);
});

test("retired quick import has no frontend file, script include or enhancement hooks", () => {
  assert.equal(fs.existsSync(path.join(root, "admin/editor-enhancements.js")), false);
  for (const file of ["api/admin/page.js", "build.js", "admin/admin.js"]) {
    assert.doesNotMatch(fs.readFileSync(path.join(root, file), "utf8"), /editor-enhancements|enhanceEditor|reloadVehicle|ah-quick-import/);
  }
});
