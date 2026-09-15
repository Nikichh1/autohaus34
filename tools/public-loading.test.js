"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const loader = fs.readFileSync(path.join(__dirname, "../data/vehicles.js"), "utf8");
const apiSource = fs.readFileSync(path.join(__dirname, "../api/public/vehicles.js"), "utf8");
const realLib = require("../server/admin-lib");
const vehicle = (id = "test-car") => ({ id, make: "BMW", model: "Test", shots: [], tags: [] });
const response = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body, text: async () => JSON.stringify(body) });
function storage() {
  const values = new Map();
  return { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, String(value)) };
}
function browser(options = {}) {
  const time = options.time || { now: 1789450000000 };
  const window = { AH_VEHICLES: [], sessionStorage: options.session || storage(), localStorage: options.local || storage() };
  if (options.earlyConsumer) {
    window.AH_INVENTORY_READY = new Promise(resolve => { window.AH_INVENTORY_RESOLVE = resolve; });
    window.AH_INVENTORY_READY.then(() => options.earlyConsumer(window));
  }
  const context = { window, location: { pathname: options.path || "/legal.html", search: options.search || "" },
    fetch: options.fetch || (async () => response(null)), Date: { now: () => time.now },
    URLSearchParams, AbortController, setTimeout, clearTimeout, Promise };
  vm.runInNewContext(loader, context);
  return window;
}

test("intent prefetch is deduplicated and consumed by the next document without another request", async () => {
  const session = storage(), time = { now: 1789450000000 };
  let calls = 0, release;
  const first = browser({ session, time, fetch: async (_, options) => {
    calls++;
    assert.equal(options.credentials, "omit");
    await new Promise(resolve => { release = resolve; });
    return response({ authoritative: true, vehicle: vehicle(), fresh_until: time.now + 30000 });
  } });
  const a = first.AH_PREFETCH_VEHICLE("test-car"), b = first.AH_PREFETCH_VEHICLE("test-car");
  assert.equal(calls, 1);
  release();
  await Promise.all([a, b]);
  const next = browser({ session, time, path: "/vehicle.html", search: "?id=test-car", fetch: async () => { throw Error("Cache should avoid request"); } });
  await next.AH_INVENTORY_READY;
  assert.equal(next.AH_VEHICLES[0].id, "test-car");
  assert.equal(next.AH_INVENTORY_SOURCE, "managed");
});

test("async loader settles pre-subscribed renderers only after inventory and variants are indexed", async () => {
  let release, observed = false;
  const original = 'https://autohaus.bg/wp-content/uploads/2020/01/car.jpg';
  const variants = { jpg1280: '/img/v/car-1280.jpg', webp400: '/img/v/car-400.webp' };
  const page = browser({ path: '/', earlyConsumer: window => {
    observed = true;
    assert.equal(window.AH_VEHICLES[0].id, 'test-car');
    assert.equal(window.AH_IMAGE_VARIANTS[original].webp400, variants.webp400);
  }, fetch: async () => {
    await new Promise(resolve => { release = resolve; });
    return response({ authoritative: true, vehicles: [{ ...vehicle(), shots: [variants.jpg1280], managed_images: [{ original, variants }] }] });
  } });
  assert.equal(observed, false);
  release();
  await page.AH_INVENTORY_READY;
  assert.equal(observed, true);
});

test("early subscribers are also released after a network failure", async () => {
  let observed = false;
  const page = browser({ path: '/', earlyConsumer: () => { observed = true; }, fetch: async () => { throw Error('offline'); } });
  await page.AH_INVENTORY_READY;
  assert.equal(observed, true);
  assert.equal(page.AH_INVENTORY_SOURCE, 'static');
});

test("a response near its server deadline does not get a fresh client TTL or survive an outage", async () => {
  const session = storage(), time = { now: 1789450000000 };
  const first = browser({ session, time, fetch: async () => response({ authoritative: true, vehicle: vehicle(), fresh_until: time.now + 1000 }) });
  await first.AH_PREFETCH_VEHICLE("test-car");
  time.now += 1001;
  let calls = 0;
  const next = browser({ session, time, path: "/vehicle.html", search: "?id=test-car", fetch: async () => { calls++; throw Error("offline"); } });
  await next.AH_INVENTORY_READY;
  assert.equal(calls, 1);
  assert.equal(next.AH_VEHICLES.length, 0);
  assert.equal(next.AH_INVENTORY_SOURCE, "static");
});

test("admin mutation invalidates prefetched details and bypasses server caches", async () => {
  const session = storage(), local = storage(), time = { now: 1789450000000 };
  const first = browser({ session, local, time, fetch: async () => response({ authoritative: true, vehicle: vehicle(), fresh_until: time.now + 30000 }) });
  await first.AH_PREFETCH_VEHICLE("test-car");
  local.setItem("autohaus-inventory-changed", String(time.now));
  let requested;
  const next = browser({ session, local, time, path: "/vehicle.html", search: "?id=test-car", fetch: async (url, options) => {
    requested = url;
    assert.equal(options.cache, "no-cache");
    return response({ authoritative: true, vehicle: null, vehicles: [] }, 404);
  } });
  await next.AH_INVENTORY_READY;
  assert.match(requested, /fresh=1789450000000/);
  assert.equal(next.AH_VEHICLES.length, 0);
  assert.equal(next.AH_INVENTORY_SOURCE, "managed");
});

test("a mutation during a prefetch prevents caching the older response", async () => {
  const session = storage(), local = storage(), time = { now: 1789450000000 };
  let release;
  const first = browser({ session, local, time, fetch: async () => {
    await new Promise(resolve => { release = resolve; });
    return response({ authoritative: true, vehicle: vehicle(), fresh_until: time.now + 30000 });
  } });
  const pending = first.AH_PREFETCH_VEHICLE("test-car");
  local.setItem("autohaus-inventory-changed", String(time.now));
  release();
  assert.equal(await pending, null);
  assert.equal(session.getItem("autohaus-public-inventory-v1"), null);
});

test("authoritative empty catalog remains empty, including a cached repeat visit", async () => {
  const session = storage(), time = { now: 1789450000000 };
  const first = browser({ session, time, path: "/", fetch: async () => response({ authoritative: true, vehicles: [], fresh_until: time.now + 30000 }) });
  await first.AH_INVENTORY_READY;
  const next = browser({ session, time, path: "/", fetch: async () => { throw Error("Should be cached"); } });
  await next.AH_INVENTORY_READY;
  assert.equal(next.AH_INVENTORY_SOURCE, "managed");
  assert.equal(next.AH_VEHICLES.length, 0);
});

test("supplied variants are indexed even for a bundled original and its local 1280px shot", async () => {
  const original = "https://autohaus.bg/wp-content/uploads/2020/01/car.jpg";
  const variants = { jpg400: "/img/v/car-400.jpg", jpg800: "/img/v/car-800.jpg", jpg1280: "/img/v/car-1280.jpg", webp400: "/img/v/car-400.webp" };
  const car = { ...vehicle(), shots: [variants.jpg1280], local_shots: [original], managed_images: [{ original, variants }] };
  const page = browser({ path: "/", fetch: async () => response({ authoritative: true, vehicles: [car] }) });
  await page.AH_INVENTORY_READY;
  assert.equal(page.AH_IMAGE_VARIANTS[variants.jpg1280].webp400, variants.webp400);
  assert.equal(page.AH_IMAGE_VARIANTS[original].jpg800, variants.jpg800);
});

function api(db, time) {
  const context = { module: { exports: {} }, __dirname: path.join(__dirname, "../api/public"),
    console: { error() {} }, Date: { now: () => time.now },
    require: name => name === "../../server/admin-lib" ? { ...realLib, configured: () => true, db } : require(name) };
  vm.runInNewContext(apiSource, context);
  return async (query = {}, headers = {}) => {
    const result = { headers: {}, setHeader(k, v) { this.headers[k.toLowerCase()] = v; }, end(text) { if (text) this.body = JSON.parse(text); } };
    await context.module.exports({ method: "GET", query, headers }, result);
    return result;
  };
}

test("public API deduplicates concurrent database reads and keeps cover variants, not full descriptions", async () => {
  const time = { now: 1789450000000 };
  let calls = 0, release;
  const handler = api(async url => {
    calls++;
    assert.match(url, /published=eq.true/);
    assert.match(url, /cover:images->0/);
    await new Promise(resolve => { release = resolve; });
    return response([{ slug: "test-car", description_bg: "Long content", description_source: "PRIVATE", cover: { original: "https://autohaus.bg/car.jpg", variants: { jpg400: "/img/v/small.jpg", jpg1280: "/img/v/large.jpg" } } }]);
  }, time);
  const a = handler(), b = handler();
  assert.equal(calls, 1);
  release();
  const [first, second] = await Promise.all([a, b]);
  assert.equal(first.body.vehicles[0].managed_images[0].variants.jpg400, "/img/v/small.jpg");
  assert.equal(first.body.vehicles[0].description_bg, undefined);
  assert.equal(first.body.vehicles[0].description_source, undefined);
  assert.equal(second.body.fresh_until, time.now + 30000);
  time.now += 25000;
  const warm = await handler();
  assert.equal(calls, 1);
  assert.match(warm.headers["cache-control"], /max-age=5, s-maxage=5, must-revalidate/);
  assert.equal(warm.body.fresh_until, first.body.fresh_until);
});

test("expired API data is never returned after failure; fresh requests bypass valid cached data", async () => {
  const time = { now: 1789450000000 };
  let current = [{ slug: "test-car", images: [] }], calls = 0;
  const handler = api(async () => { calls++; if (current === null) throw Error("offline"); return response(current); }, time);
  await handler({ id: "test-car" });
  current = [];
  const removed = await handler({ id: "test-car", fresh: String(time.now) });
  assert.equal(calls, 2);
  assert.equal(removed.statusCode, 404);
  assert.equal(removed.body.authoritative, true);
  current = [{ slug: "test-car", images: [] }];
  await handler({ id: "test-car", fresh: String(time.now) });
  time.now += 30001;
  current = null;
  const failed = await handler({ id: "test-car" });
  assert.equal(failed.body.authoritative, false);
  assert.equal(failed.headers["cache-control"], "no-store");
});

test("a slow pre-edit API result cannot replace a newer authoritative removal", async () => {
  const time = { now: 1789450000000 };
  let calls = 0, release;
  const handler = api(async () => {
    calls++;
    if (calls === 1) {
      await new Promise(resolve => { release = resolve; });
      return response([{ slug: "test-car", images: [] }]);
    }
    return response([]);
  }, time);
  const older = handler({ id: "test-car" });
  const removed = await handler({ id: "test-car", fresh: String(time.now) });
  assert.equal(removed.statusCode, 404);
  release();
  await older;
  const current = await handler({ id: "test-car" });
  assert.equal(current.statusCode, 404);
  assert.equal(calls, 2);
});
