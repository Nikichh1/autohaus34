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

function harness({ hash = "#dashboard", fetch: fetchImpl, language = "en" } = {}) {
  const nodes = new Map(), calls = [], edits = [], screens = [], storage = new Map();
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
  const document = { body, documentElement: {}, visibilityState: "visible", getElementById: node, querySelectorAll: () => [], addEventListener() {} };
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
      renderRoute: renderRoute, selectReviewLanguage: selectReviewLanguage,
      validateCar: validateCar, processDescription: processDescription, saveCar: saveCar,
      bindEditor: bindEditor, collectForm: collectForm, rememberDetail: rememberDetail, invalidateDetail: invalidateDetail,
      hooks: function (hooks) {
        if (hooks.editor) editor = hooks.editor;
        if (hooks.dashboard) dashboard = hooks.dashboard;
        if (hooks.cars) cars = hooks.cars;
      }
    };`);
  vm.runInNewContext(testSource, {
    document, window, location, history, console, Intl, Map, Promise,
    Date: { now: () => now },
    confirm: () => true,
    setTimeout: () => 1, clearTimeout() {}, requestAnimationFrame: callback => callback(),
    fetch: async (url, options) => {
      calls.push({ url, options });
      return fetchImpl ? fetchImpl(url, options) : response({});
    }
  }, { filename: "admin/admin.js" });
  const admin = window.__test;
  admin.hooks({
    editor(vehicle, isNew) { edits.push({ vehicle, isNew }); admin.state.current = vehicle; },
    dashboard() { screens.push("dashboard"); },
    cars() { screens.push("cars"); }
  });
  return { admin, node, tabs, form, calls, edits, screens, view, heading, storage, location, advance: milliseconds => { now += milliseconds; } };
}

function car(id = "car-1", overrides = {}) {
  return { id, make: "Mercedes-Benz", model: "S 500 L", full_name: "Mercedes-Benz S 500 L", published: false,
    images: [{ original: "/photo.jpg" }], equipment_bg: [], equipment_en: [],
    updated_at: "2026-09-15T10:00:00Z", ...overrides };
}

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

test("AI processing sends only vehicle facts and retains independent source and reviewed outputs", async () => {
  const result = { description_bg: "Сервизна история.", description_en: "Service history.", equipment_bg: ["Камера", "Пакет"], equipment_en: ["Camera", "Package"], review_notes: ["Check history"] };
  const h = harness({ fetch: () => response({ result }) });
  h.admin.state.current = car("car-1", { images: Array.from({ length: 80 }, () => ({ original: "/large-original.jpg", variants: { webp1280: "/large.webp" } })) });
  h.node("source-text").value = "  Original listing. Camera and package.  ";
  h.node("desc-bg").value = "Old private output";
  h.node("desc-en").value = "Old English output";
  await h.admin.processDescription();
  assert.equal(h.calls.length, 1, "Processing must not save or publish");
  assert.equal(h.calls[0].url, "/api/admin/description");
  const payload = JSON.parse(h.calls[0].options.body);
  assert.equal(payload.source, "Original listing. Camera and package.");
  assert.deepEqual(Object.keys(payload.vehicle).sort(), ["body_type", "colour", "first_registration_month", "first_registration_year", "fuel", "horsepower", "make", "mileage", "model", "price", "ref", "transmission", "unregistered"].sort());
  assert.ok(h.calls[0].options.body.length < 1000, "Photo metadata and previous output should not inflate the AI request");
  assert.equal(h.node("source-text").value, "  Original listing. Camera and package.  ");
  assert.equal(h.node("desc-bg").value, result.description_bg);
  assert.equal(h.node("equipment-en").value, "Camera\nPackage");
  assert.equal(h.admin.state.aiNeedsReview, true);
  assert.equal(h.admin.state.dirty, true);
  for (const id of ["source-text", "desc-bg", "desc-en", "equipment-bg", "equipment-en"]) assert.equal(h.node(id).readOnly, false);
  assert.equal(h.node("review-en").hidden, false);
  assert.equal(h.node("review-bg").hidden, true);
});

test("failed AI processing preserves source/output and unlocks manual editing", async () => {
  const h = harness({ fetch: () => response({ error: "Quota", code: "AI_FREE_QUOTA" }, 429) });
  h.admin.state.current = car();
  h.node("source-text").value = "A complete original listing";
  h.node("desc-bg").value = "Запазено описание";
  h.node("desc-en").value = "Saved description";
  await h.admin.processDescription();
  assert.equal(h.node("source-text").value, "A complete original listing");
  assert.equal(h.node("desc-bg").value, "Запазено описание");
  assert.equal(h.node("desc-en").value, "Saved description");
  assert.equal(h.admin.state.aiBusy, false);
  assert.equal(h.admin.state.aiNeedsReview, false);
  assert.equal(h.node("desc-en").readOnly, false);
  assert.match(h.node("processor-note").textContent, /quota/i);
});

test("review tabs support keyboard navigation without altering either language", () => {
  const h = harness();
  h.node("desc-bg").value = "Български";
  h.node("desc-en").value = "English";
  h.admin.bindEditor();
  let prevented = false;
  h.node("review-tab-bg").onkeydown({ key: "ArrowRight", preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(h.node("review-en").hidden, false);
  assert.equal(h.node("review-bg").hidden, true);
  assert.equal(h.node("review-tab-en").getAttribute("aria-selected"), "true");
  assert.equal(h.node("review-tab-en").tabIndex, 0);
  assert.equal(h.node("review-tab-bg").tabIndex, -1);
  assert.equal(h.node("review-tab-en").focused, true);
  h.node("review-tab-en").onkeydown({ key: "Home", preventDefault() {} });
  assert.equal(h.node("review-bg").hidden, false);
  assert.equal(h.node("desc-bg").value, "Български");
  assert.equal(h.node("desc-en").value, "English");
});

test("validation exposes a hidden language before focusing an invalid field", () => {
  const h = harness();
  h.admin.state.current = car();
  h.admin.selectReviewLanguage("bg");
  h.node("desc-en").validity.valid = false;
  assert.equal(h.admin.validateCar(h.admin.collectForm()), false);
  assert.equal(h.node("review-en").hidden, false);
  assert.equal(h.node("desc-en").focused, true);
  assert.equal(h.node("desc-en").getAttribute("aria-invalid"), "true");
  h.node("desc-en").validity.valid = true;
  h.node("equipment-bg").value = "One\nTwo";
  h.node("equipment-en").value = "One";
  h.admin.selectReviewLanguage("bg");
  assert.equal(h.admin.validateCar(h.admin.collectForm()), false);
  assert.equal(h.node("review-en").hidden, false);
  assert.equal(h.node("equipment-en").focused, true);
});

test("ordinary save preserves the editor DOM, source, and optimistic concurrency version", async () => {
  const saved = car("car-1", { full_name: "Updated display name", updated_at: "2026-09-15T10:01:00Z" });
  const h = harness({ fetch: () => response({ vehicle: saved }) });
  h.admin.state.current = car();
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
