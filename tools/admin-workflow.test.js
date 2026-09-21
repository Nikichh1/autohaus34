"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "../admin/admin.js"), "utf8");
const startup = "translateShell(); loadVehicles(true);";
assert.ok(source.includes(startup), "Update the harness if the admin startup changes");

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function response(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

function element(id = "") {
  const attributes = new Map(), classes = new Set();
  return {
    id, value: "", dataset: {}, hidden: false, disabled: false, checked: false,
    readOnly: false, validity: { valid: true }, textContent: "", innerHTML: "",
    tagName: "INPUT", type: "text", lang: "", tabIndex: 0,
    classList: {
      add(...names) { names.forEach(name => classes.add(name)); },
      remove(...names) { names.forEach(name => classes.delete(name)); },
      contains(name) { return classes.has(name); },
      toggle(name, force) {
        const on = force === undefined ? !classes.has(name) : force;
        if (on) classes.add(name); else classes.delete(name);
        return on;
      }
    },
    setAttribute(name, value) { attributes.set(name, String(value)); },
    getAttribute(name) { return attributes.get(name) || null; },
    removeAttribute(name) { attributes.delete(name); },
    addEventListener() {}, click() {}, scrollIntoView() {},
    focus() { this.focused = true; },
    closest(selector) { return selector === ".review-output" ? this.reviewPanel || null : null; },
    querySelectorAll() { return []; },
    querySelector() { return null; },
    insertAdjacentHTML(_position, html) { this.innerHTML += html; }
  };
}

function harness({ hash = "#dashboard", fetch: fetchImpl, language = "en", Image: ImageImpl, readyState = "complete" } = {}) {
  const documentEvents = {};
  const nodes = new Map(), calls = [], edits = [], screens = [], storage = new Map(), encodes = [];
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, element(id));
    return nodes.get(id);
  };
  const tabs = ["bg", "en"].map(language => {
    const tab = node("review-tab-" + language);
    tab.dataset.reviewLanguage = language;
    tab.setAttribute("aria-controls", "review-" + language);
    return tab;
  });
  const form = node("car-form");
  form.elements = {};
  const fields = ["make", "model", "full_name", "slug", "ref", "body_type", "colour", "transmission", "fuel", "mileage", "horsepower", "price", "first_registration_year", "first_registration_month", "unregistered", "chapter", "tags", "notes", "source_url"];
  fields.forEach(name => { form.elements[name] = element(name); });
  Object.assign(form.elements.make, { value: "Mercedes-Benz" });
  Object.assign(form.elements.model, { value: "S 500 L" });
  Object.assign(form.elements.fuel, { value: "petrol" });
  Object.assign(form.elements.transmission, { value: "automatic" });
  Object.assign(form.elements.chapter, { value: "saloon" });
  const reviewFields = ["desc-bg", "desc-en", "equipment-bg", "equipment-en"].map(id => {
    const field = node(id);
    field.lang = id.endsWith("bg") ? "bg" : "en";
    field.reviewPanel = node("review-" + field.lang);
    return field;
  });
  const allFields = [...Object.values(form.elements), node("source-text"), ...reviewFields];
  form.querySelectorAll = selector => selector === "[aria-invalid]" ? allFields.filter(field => field.getAttribute("aria-invalid")) : allFields;
  const view = node("admin-view"), heading = element("heading");
  view.querySelector = selector => selector === ".editor-heading h1" ? heading : null;
  view.querySelectorAll = selector => selector === "[data-review-language]" ? tabs : [];
  const body = element("body");
  body.dataset = { adminUser: "test-user", adminRole: "owner" };
  const document = { readyState, body, documentElement: {}, visibilityState: "visible", getElementById: node, querySelectorAll: () => [], querySelector: () => null,
    addEventListener(name, fn) { documentEvents[name] = fn; },
    createElement(tag) {
      if (tag !== "canvas") return element(tag);
      return { width: 0, height: 0, getContext() { return { imageSmoothingEnabled: false, imageSmoothingQuality: "", fillStyle: "", fillRect() {}, drawImage() {}, save() {}, restore() {} }; },
        toBlob(callback, type, quality) { encodes.push({ width: this.width, height: this.height, type, quality }); callback(new Blob([type], { type })); } };
    } };
  const location = { hash, replace() {} };
  const history = {
    replaceState(_state, _title, url) { location.hash = url; },
    pushState(_state, _title, url) { location.hash = url; }
  };
  storage.set("ah-admin-language", language);
  const store = { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) };
  const window = { localStorage: store, sessionStorage: store, addEventListener() {}, scrollTo() {} };
  let now = 100000;
  const testSource = source.replace(startup, `
    translateShell();
    window.__test = { state: state, loadDetail: loadDetail, loadVehicles: loadVehicles,
      renderRoute: renderRoute,
      validateCar: validateCar, saveCar: saveCar,
      bindEditor: bindEditor, collectForm: collectForm, rememberDetail: rememberDetail, invalidateDetail: invalidateDetail,
      preparePhoto: preparePhoto, watermarkAsset: watermarkAsset, uploadPreparedPhoto: uploadPreparedPhoto, isResponsiveImage: isResponsiveImage,
      hooks: function (hooks) {
        if (hooks.editor) editor = hooks.editor;
        if (hooks.dashboard) dashboard = hooks.dashboard;
        if (hooks.cars) cars = hooks.cars;
      }
    };`);
  vm.runInNewContext(testSource, {
    document, window, location, history, console, Intl, Map, Promise,
    Date: { now: () => now }, Blob, AbortController,
    URL: { createObjectURL: () => "blob:test", revokeObjectURL() {} },
    Image: ImageImpl || class { constructor() { this.naturalWidth = 2400; this.naturalHeight = 1600; } set src(value) { if(this.onload) this.onload(); } decode() { return Promise.resolve(); } },
    FormData: class { constructor() { this.entries = []; } append(...values) { this.entries.push(values); } },
    navigator: { hardwareConcurrency: 8, deviceMemory: 8 },
    confirm: () => true,
    setTimeout: () => 1, clearTimeout() {}, requestAnimationFrame: callback => callback(),
    fetch: async (url, options) => {
      calls.push({ url, options });
      return fetchImpl ? fetchImpl(url, options) : response({});
    }
  }, { filename: "admin/admin.js" });
  const deferredStartup = !window.__test;
  if (deferredStartup) documentEvents.DOMContentLoaded();
  const admin = window.__test;
  admin.hooks({
    editor(vehicle, isNew) { edits.push({ vehicle, isNew }); admin.state.current = vehicle; },
    dashboard() { screens.push("dashboard"); },
    cars() { screens.push("cars"); }
  });
  return { admin, node, tabs, form, calls, edits, screens, view, heading, storage, location, encodes, deferredStartup, advance: milliseconds => { now += milliseconds; } };
}

function car(id = "car-1", overrides = {}) {
  return { id, make: "Mercedes-Benz", model: "S 500 L", full_name: "Mercedes-Benz S 500 L", published: false,
    images: [{ original: "/photo.jpg" }], equipment_bg: [], equipment_en: [],
    updated_at: "2026-09-15T10:00:00Z", ...overrides };
}

test("deferred scripts wait for route registration before initial navigation", () => {
  assert.equal(harness({ readyState: 'interactive', hash: '#settings' }).deferredStartup, true);
  assert.equal(harness({ readyState: 'loading', hash: '#team' }).deferredStartup, true);
  assert.equal(harness({ readyState: 'complete' }).deferredStartup, false);
});

test("photo preparation creates a bounded original and distinct JPEG/WebP widths", async () => {
  const h = harness();
  const prepared = await h.admin.preparePhoto({ name: "car.jpg", type: "image/jpeg", size: 1000 });
  assert.equal(prepared.width, 1600);
  assert.equal(prepared.height, 900);
  assert.deepEqual(Object.keys(prepared.files), ["original", "jpg400", "webp400", "jpg800", "webp800", "jpg1280", "webp1280"]);
  assert.equal(prepared.files.jpg400.type, "image/jpeg");
  assert.equal(prepared.files.webp400.type, "image/webp");
  assert.deepEqual(h.encodes.map(item => [item.width, item.height, item.type]), [
    [1600, 900, "image/jpeg"], [400, 225, "image/jpeg"], [400, 225, "image/webp"],
    [800, 450, "image/jpeg"], [800, 450, "image/webp"], [1280, 720, "image/jpeg"], [1280, 720, "image/webp"]
  ]);
});

test("responsive upload sends every prepared asset and retains legacy fallback", async () => {
  const h = harness({ fetch: () => response({}) });
  const files = Object.fromEntries(["original", "jpg400", "jpg800", "jpg1280", "webp400", "webp800", "webp1280"].map(key => [key, new Blob([key], { type: key.startsWith("webp") ? "image/webp" : "image/jpeg" })]));
  const uploads = Object.fromEntries(Object.keys(files).map(key => [key, { upload_url: "https://upload.example/" + key }]));
  assert.equal(await h.admin.uploadPreparedPhoto({ responsive: true, uploads, headers: { apikey: "test" } }, { files }), true);
  assert.equal(h.calls.length, 7);
  assert.deepEqual(new Set(h.calls.map(call => call.url)), new Set(Object.values(uploads).map(item => item.upload_url)));
  assert.ok(h.calls.every(call => call.options.method === "PUT"));

  h.calls.length = 0;
  assert.equal(await h.admin.uploadPreparedPhoto({ upload_url: "https://upload.example/legacy", headers: {} }, { files }), false);
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].url, "https://upload.example/legacy");
});

test("watermark failure can be retried without reloading the editor", async () => {
  let attempts = 0;
  const h = harness({ Image: class {
    set src(value) { if (++attempts === 1) this.onerror(); else this.onload(); }
    decode() { return Promise.resolve(); }
  } });
  await assert.rejects(h.admin.watermarkAsset(), /unavailable/);
  assert.ok(await h.admin.watermarkAsset());
  assert.equal(attempts, 2);
});

test("failed responsive upload waits for its other worker before allowing cleanup", async () => {
  const pending = deferred();
  const h = harness({ fetch: url => url.endsWith('/original') ? Promise.reject(new Error('failed')) :
    url.endsWith('/jpg400') ? pending.promise : response({}) });
  const keys = ["original", "jpg400", "jpg800", "jpg1280", "webp400", "webp800", "webp1280"];
  const files = Object.fromEntries(keys.map(key => [key, new Blob([key])]));
  const uploads = Object.fromEntries(keys.map(key => [key, { upload_url: 'https://upload.example/' + key }]));
  let settled = false;
  const outcome = h.admin.uploadPreparedPhoto({ responsive: true, uploads }, { files }).catch(error => { settled = true; return error; });
  await new Promise(setImmediate);
  assert.equal(settled, false);
  pending.resolve(response({}));
  assert.match((await outcome).message, /failed/);
  assert.equal(h.calls.length, 7);
});

test("only a complete six-URL Supabase derivative set is marked responsive", () => {
  const h = harness();
  const variants = Object.fromEntries(["jpg400", "jpg800", "jpg1280", "webp400", "webp800", "webp1280"].map(key => [key, "https://storage.example/" + key]));
  assert.equal(h.admin.isResponsiveImage({ public_id: "vehicles/00000000-0000-4000-8000-000000000001", variants }), true);
  variants.webp1280 = variants.jpg1280;
  assert.equal(h.admin.isResponsiveImage({ public_id: "vehicles/00000000-0000-4000-8000-000000000001", variants }), false);
});

test("detail requests deduplicate in flight, reuse fresh results, and expire", async () => {
  const pending = deferred();
  const h = harness({ fetch: () => pending.promise });
  const first = h.admin.loadDetail("car 1"), second = h.admin.loadDetail("car 1");
  assert.equal(first, second);
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].url, "/api/admin/vehicles?id=car%201");
  const vehicle = car("car 1");
  pending.resolve(response({ vehicle }));
  assert.equal(await first, vehicle);
  assert.equal(await h.admin.loadDetail("car 1"), vehicle);
  assert.equal(h.calls.length, 1);
  h.advance(30001);
  await h.admin.loadDetail("car 1");
  assert.equal(h.calls.length, 2);
});

test("failed detail fetches are evicted so the next attempt can succeed", async () => {
  let fail = true;
  const h = harness({ fetch: () => fail ? response({ error: "Temporary failure" }, 503) : response({ vehicle: car() }) });
  await assert.rejects(h.admin.loadDetail("car-1"), /Temporary failure/);
  fail = false;
  assert.equal((await h.admin.loadDetail("car-1")).id, "car-1");
  assert.equal(h.calls.length, 2);
});

test("a late prefetched detail cannot overwrite a successfully saved or unpublished vehicle", async () => {
  const pending = deferred();
  const h = harness({ fetch: () => pending.promise });
  const loading = h.admin.loadDetail("car-1");
  const saved = car("car-1", { published: false, updated_at: "2026-09-15T11:00:00Z" });
  h.admin.rememberDetail(saved);
  pending.resolve(response({ vehicle: car("car-1", { published: true }) }));
  assert.equal(await loading, saved);
  assert.equal(await h.admin.loadDetail("car-1"), saved);
  assert.equal(h.calls.length, 1);
});

test("explicit invalidation starts a new detail request even when an older one is pending", async () => {
  const old = deferred(), fresh = deferred();
  let requests = 0;
  const h = harness({ fetch: () => ++requests === 1 ? old.promise : fresh.promise });
  const first = h.admin.loadDetail("car-1");
  h.admin.invalidateDetail("car-1");
  const second = h.admin.loadDetail("car-1");
  const updated = car("car-1", { model: "Imported" });
  fresh.resolve(response({ vehicle: updated }));
  assert.equal(await second, updated);
  old.resolve(response({ vehicle: car() }));
  assert.equal(await first, updated);
  assert.equal(h.calls.length, 2);
});

test("direct edit starts detail and compact list together; late list cannot replace editor", async () => {
  const list = deferred(), detail = deferred();
  const h = harness({ hash: "#edit=car-1", fetch: url => url.includes("?id=") ? detail.promise : list.promise });
  const loading = h.admin.loadVehicles(true);
  assert.deepEqual(h.calls.map(call => call.url), ["/api/admin/vehicles", "/api/admin/vehicles?id=car-1"]);
  detail.resolve(response({ vehicle: car() }));
  await h.admin.loadDetail("car-1");
  await Promise.resolve();
  assert.equal(h.edits.length, 1);
  list.resolve(response({ vehicles: [{ id: "car-1", make: "Mercedes-Benz" }] }));
  await loading;
  assert.equal(h.edits.length, 1);
  assert.equal(h.admin.state.current.id, "car-1");
  assert.deepEqual(h.screens, []);
});

test("a failed list request does not hide an independently loaded editor", async () => {
  const list = deferred();
  const h = harness({ hash: "#edit=car-1", fetch: url => url.includes("?id=") ? response({ vehicle: car() }) : list.promise });
  const loading = h.admin.loadVehicles(true);
  await h.admin.loadDetail("car-1");
  await Promise.resolve();
  h.view.innerHTML = "editor remains mounted";
  list.resolve(response({ error: "List temporarily unavailable" }, 503));
  await loading;
  assert.equal(h.view.innerHTML, "editor remains mounted");
  assert.equal(h.admin.state.current.id, "car-1");
});

test("late detail responses and errors cannot overwrite a newer route", async () => {
  for (const failure of [false, true]) {
    const detail = deferred();
    const h = harness({ fetch: () => detail.promise });
    const editing = h.admin.renderRoute("edit=car-1");
    await h.admin.renderRoute("cars");
    h.view.innerHTML = "newer inventory screen";
    detail.resolve(response(failure ? { error: "Missing" } : { vehicle: car() }, failure ? 404 : 200));
    await editing;
    assert.equal(h.view.innerHTML, "newer inventory screen");
    assert.equal(h.admin.state.route, "cars");
    assert.equal(h.edits.length, 0);
  }
});

test("hidden legacy descriptions and review notes survive ordinary edits", () => {
  const h = harness();
  h.admin.state.current = car("car-1", {description_bg:"Запазено", description_en:"Preserved", description_source:"Source", description_review_notes:["Review note"]});
  const data = h.admin.collectForm();
  assert.equal(data.description_bg,"Запазено");
  assert.equal(data.description_en,"Preserved");
  assert.equal(data.description_source,"Source");
  assert.deepEqual(Array.from(data.description_review_notes),["Review note"]);
});

test("VAT selection survives form collection for draft recovery without removing other VAT notes", () => {
  const h = harness();
  h.admin.state.current = car();
  h.form.elements.notes.value = "ДДС включен в други услуги";
  h.form.elements.show_price_without_vat = {checked:true};
  const data = h.admin.collectForm();
  assert.deepEqual(Array.from(data.notes),["ДДС включен в други услуги","Цена без начислен 20% ДДС"]);
  h.form.elements.show_price_without_vat.checked=false;
  assert.deepEqual(Array.from(h.admin.collectForm().notes),["ДДС включен в други услуги"]);
});

test("ordinary save preserves the editor DOM, source, and optimistic concurrency version", async () => {
  const saved = car("car-1", { full_name: "Updated display name", updated_at: "2026-09-15T10:01:00Z" });
  const h = harness({ fetch: () => response({ vehicle: saved }) });
  h.admin.state.current = car("car-1", {description_source:"Original private source"});
  h.admin.state.dirty = true;
  h.node("source-text").value = "Original private source";
  const form = h.form;
  await h.admin.saveCar();
  const payload = JSON.parse(h.calls[0].options.body);
  assert.equal(h.calls[0].options.method, "PATCH");
  assert.equal(payload.if_unmodified_since, "2026-09-15T10:00:00Z");
  assert.equal(payload.description_source, "Original private source");
  assert.equal(h.edits.length, 0, "An unchanged publication state must not rebuild the editor/photos");
  assert.equal(h.form, form);
  assert.equal(h.heading.textContent, "Updated display name");
  assert.equal(h.node("source-text").value, "Original private source");
  assert.equal(h.admin.state.current.updated_at, saved.updated_at);
  assert.equal(h.admin.state.dirty, false);
  assert.equal(h.admin.state.saved, true);
  assert.ok(h.storage.has("autohaus-inventory-changed"));
});

test("new vehicles and publication transitions refresh the editor controls", async () => {
  for (const creating of [true, false]) {
    const saved = car("saved-car", { published: !creating });
    const h = harness({ fetch: () => response({ vehicle: saved }) });
    h.admin.state.current = car(creating ? "" : "saved-car");
    await h.admin.saveCar(creating ? undefined : true);
    assert.equal(h.calls[0].options.method, creating ? "POST" : "PATCH");
    assert.equal(h.edits.length, 1);
    assert.equal(h.edits[0].isNew, false);
    assert.equal(h.location.hash, "#edit=saved-car");
  }
});

test("unreviewed AI output and stale-save conflicts never silently overwrite saved data", async () => {
  const h = harness({ fetch: () => response({ error: "A newer edit exists", code: "EDIT_CONFLICT" }, 409) });
  h.admin.state.current = car();
  h.admin.state.dirty = true;
  h.admin.state.aiNeedsReview = true;
  await h.admin.saveCar();
  assert.equal(h.calls.length, 0);
  assert.equal(h.node("ai-reviewed").focused, true);
  h.admin.state.aiNeedsReview = false;
  await h.admin.saveCar();
  assert.equal(h.admin.state.dirty, true);
  assert.equal(h.admin.state.saved, false);
  assert.equal(h.admin.state.saveBusy, false);
  assert.equal(h.admin.state.current.updated_at, "2026-09-15T10:00:00Z");
  assert.equal(h.edits.length, 0);
  assert.match(h.node("toast").textContent, /newer edit/);
});
