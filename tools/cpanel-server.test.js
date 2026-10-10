"use strict";
const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
const http = require("node:http"), zlib = require("node:zlib");
const { createServer, ROUTES, MAX_BODY_BYTES, encodings } = require("../server/cpanel-server");
const originalFetch = global.fetch;
after(() => { global.fetch = originalFetch; });

function request(server, pathname, options = {}) {
  return new Promise((resolve, reject) => {
    const headers = { ...(options.headers || {}) };
    const bytes = options.raw !== undefined ? Buffer.from(options.raw) : options.body !== undefined ? Buffer.from(JSON.stringify(options.body)) : null;
    if (bytes && !headers["Transfer-Encoding"]) headers["Content-Length"] ??= bytes.length;
    const req = http.request({ hostname: "127.0.0.1", port: server.address().port, path: pathname, method: options.method || "GET", headers }, res => {
      const chunks = [];
      res.on("data", chunk => chunks.push(chunk));
      res.on("end", () => {
        const bytes = Buffer.concat(chunks), text = bytes.toString("utf8");
        let body; try { body = JSON.parse(text); } catch (_) {}
        resolve({ status: res.statusCode, headers: res.headers, text, bytes, body });
      });
      res.on("error", reject);
    });
    req.on("error", reject);
    req.end(bytes);
  });
}

async function fixture(t, options = {}) {
  const parent = fs.realpathSync(os.tmpdir());
  const root = fs.mkdtempSync(path.join(parent, "autohaus-cpanel-http-"));
  const write = (file, content) => {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), content);
  };
  write("dist/vehicle.html", "<!doctype html><title>Fixture vehicle</title>");
  write("dist/admin/login.html", "<!doctype html><title>Fixture login</title>");
  write("dist/admin/admin.js", "window.fixtureAdmin = true;");
  const script = "window.fixturePublic = true;".repeat(100);
  write("dist/main.js", script);
  write("dist/main.js.gz", zlib.gzipSync(script));
  write("dist/main.js.br", zlib.brotliCompressSync(script));
  write("dist/img/photo.webp", "fixture image");
  write(".env", "PRIVATE_ENV_SENTINEL");
  write("server/private.js", "PRIVATE_BACKEND_SENTINEL");
  write("data/inventory.snapshot.json", "PRIVATE_INVENTORY_SENTINEL");
  write("dist/.env", "PRIVATE_ENV_SENTINEL");
  let received;
  const server = createServer({ root, production: false, origin: "", verifyBuild: false, handlerFor: name => async (req, res) => {
    received = { name, query: req.query, body: req.body, headers: { ...req.headers } };
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(received));
  }, ...options });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(async () => {
    global.fetch = originalFetch;
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    const target = fs.realpathSync(root);
    if (path.dirname(target) !== parent || !path.basename(target).startsWith("autohaus-cpanel-http-")) throw new Error("Unsafe test cleanup");
    fs.rmSync(target, { recursive: true, force: true });
  });
  return { root, write, server, call: (p, o) => request(server, p, o), received: () => received, script };
}

function realHandlers() {
  delete require.cache[require.resolve("../api/public/vehicles")];
  return name => require("../api/" + name);
}
function provider(fn) {
  global.fetch = async (url, options = {}) => {
    assert.match(String(url), /^https:\/\/ajoiqomflplhadyhxvfe\.supabase\.co\//, "Unexpected external service in isolated test");
    return new Response(JSON.stringify(await fn(String(url), options)), { status: 200, headers: { "Content-Type": "application/json" } });
  };
}
const token = "header." + Buffer.from(JSON.stringify({ sub: "00000000-0000-4000-8000-000000000001", email: "fixture@example.com", session_id: "00000000-0000-4000-8000-000000000002" })).toString("base64url") + ".fixture";

test("explicit route map covers every original API handler", () => {
  const actual = [];
  function walk(dir, prefix = "") {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) walk(path.join(dir, entry.name), prefix + entry.name + "/");
      else if (entry.name.endsWith(".js")) actual.push(prefix + entry.name.slice(0, -3));
    }
  }
  walk(path.join(__dirname, "../api"));
  assert.deepEqual([...new Set(Object.values(ROUTES))].sort(), actual.sort());
});

test("homepage, admin, settings and SEO rewrites retain the Vercel contracts", async t => {
  const f = await fixture(t);
  for (const [url, name, query] of [["/?home=0", "public/vehicles", { home: "1" }], ["/index.html", "public/vehicles", { home: "1" }], ["/admin", "admin/page", {}], ["/admin/", "admin/page", {}], ["/api/admin/settings?action=bootstrap", "admin/vehicles", { action: "settings" }], ["/sitemap.xml", "sitemap", {}], ["/robots.txt", "robots", {}]]) {
    const r = await f.call(url);
    assert.equal(r.status, 200);
    assert.equal(r.body.name, name);
    assert.deepEqual(r.body.query, query);
  }
});

test("JSON body and query strings are adapted without changing handlers", async t => {
  const f = await fixture(t);
  const r = await f.call("/api/admin/vehicles?id=fixture-car", { method: "PATCH", body: { model: "Fixture" }, headers: { "Content-Type": "application/json; charset=utf-8" } });
  assert.deepEqual(r.body.body, { model: "Fixture" });
  assert.equal(r.body.query.id, "fixture-car");
  assert.equal((await f.call("/api/admin/auth", { method: "POST", raw: "{broken", headers: { "Content-Type": "application/json" } })).status, 400);
  assert.equal((await f.call("/api/admin/auth", { method: "POST", raw: "[]", headers: { "Content-Type": "application/json" } })).status, 400);
  assert.equal((await f.call("/api/admin/auth", { method: "POST", raw: "hello", headers: { "Content-Type": "text/plain" } })).status, 415);
});

test("oversized requests are rejected with both Content-Length and chunked transport", async t => {
  const f = await fixture(t);
  const raw = "x".repeat(MAX_BODY_BYTES + 1);
  for (const headers of [{ "Content-Type": "application/json" }, { "Content-Type": "application/json", "Transfer-Encoding": "chunked" }]) {
    assert.equal((await f.call("/api/admin/vehicles", { method: "POST", raw, headers })).status, 413);
  }
});

test("only dist is public, including against encoded traversal and private files", async t => {
  const f = await fixture(t);
  for (const url of ["/.env", "/.git/config", "/server/private.js", "/api/admin/page.js", "/admin/schema.sql", "/data/inventory.snapshot.json", "/package.json", "/tools/dev-server.js", "/CPANEL.md", "/%2e%2e/server/private.js", "/data/%2e%2e/%2e%2e/.env", "/dist/main.js", "/main.js.gz", "/main.js.br"]) {
    const r = await f.call(url);
    assert.equal(r.status, 404, url);
    assert.doesNotMatch(r.text, /PRIVATE_.*SENTINEL/);
  }
  assert.equal((await f.call("/bad%ZZ")).status, 400);
  assert.equal((await f.call("/server%5cprivate.js")).status, 400);
  assert.equal((await f.call("/vehicle.html")).status, 200);
  assert.equal((await f.call("/img/photo.webp")).status, 200);
});

test("static HEAD, ETags, content types and admin cache/security headers", async t => {
  const f = await fixture(t);
  const first = await f.call("/main.js?v=123456abcdef");
  assert.equal(first.headers["content-type"], "application/javascript; charset=utf-8");
  assert.match(first.headers["cache-control"], /immutable/);
  assert.equal((await f.call("/main.js", { headers: { "If-None-Match": first.headers.etag } })).status, 304);
  const head = await f.call("/main.js", { method: "HEAD" });
  assert.equal(head.bytes.length, 0);
  assert.equal(Number(head.headers["content-length"]), Buffer.byteLength(f.script));
  const login = await f.call("/admin/login.html");
  assert.match(login.headers["content-security-policy"], /frame-ancestors 'none'/);
  assert.match(login.headers["cache-control"], /no-cache/);
  assert.equal(login.headers["x-frame-options"], "DENY");
  assert.match(login.headers["x-robots-tag"], /noindex/);
  assert.equal((await f.call("/main.js", { method: "POST" })).status, 405);
});

test("Brotli/gzip variants respect encoding preference and q=0", async t => {
  const f = await fixture(t);
  for (const [header, encoding] of [["gzip, br", "br"], ["gzip;q=1, br;q=0.5", "gzip"], ["gzip;q=0, br;q=0", undefined]]) {
    const r = await f.call("/main.js", { headers: { "Accept-Encoding": header } });
    assert.equal(r.headers["content-encoding"], encoding);
    assert.equal(r.headers.vary, "Accept-Encoding");
    const bytes = encoding === "br" ? zlib.brotliDecompressSync(r.bytes) : encoding === "gzip" ? zlib.gunzipSync(r.bytes) : r.bytes;
    assert.equal(bytes.toString(), f.script);
  }
  assert.deepEqual(encodings("br;q=0, *;q=1").map(v => v.name), ["gzip"]);
});

test("production requires an HTTPS origin and rejects unapproved hosts", async t => {
  const f = await fixture(t, { production: true, origin: "https://test.autohaus.bg", allowedHosts: "www.autohaus.bg" });
  assert.equal((await f.call("/healthz")).status, 400);
  const r = await f.call("/api/robots", { headers: { Host: "test.autohaus.bg", "X-Forwarded-Host": "evil.example", "X-Forwarded-Proto": "http" } });
  assert.equal(r.body.headers["x-forwarded-host"], "test.autohaus.bg");
  assert.equal(r.body.headers["x-forwarded-proto"], "https");
  assert.equal(r.headers["strict-transport-security"], "max-age=31536000");
  assert.equal((await f.call("/healthz", { headers: { Host: "www.autohaus.bg" } })).status, 200);
  assert.throws(() => createServer({ root: f.root, verifyBuild: false, production: true, origin: "" }), /PUBLIC_ORIGIN/);
  assert.throws(() => createServer({ root: f.root, verifyBuild: false, production: true, origin: "http://test.autohaus.bg" }), /HTTPS/);
});

test("proxy IP trust is explicit and does not accept the left-most spoofed value", async t => {
  const f = await fixture(t, { trustProxy: false });
  const r = await f.call("/api/robots", { headers: { "X-Forwarded-For": "1.2.3.4" } });
  assert.equal(r.body.headers["x-forwarded-for"], "127.0.0.1");
  const trusted = await fixture(t, { trustProxy: true });
  const proxy = await trusted.call("/api/robots", { headers: { "X-Forwarded-For": "1.2.3.4, 5.6.7.8" } });
  assert.equal(proxy.body.headers["x-forwarded-for"], "5.6.7.8");
});

test("health check works without contacting external services", async t => {
  global.fetch = () => { throw new Error("External call forbidden"); };
  const f = await fixture(t);
  assert.deepEqual((await f.call("/healthz")).body, { ok: true });
});

test("real handlers deny anonymous admin and cross-origin login through HTTP", async t => {
  provider(() => { throw new Error("No provider call expected"); });
  const f = await fixture(t, { handlerFor: realHandlers() });
  const page = await f.call("/admin");
  assert.equal(page.status, 302);
  assert.equal(page.headers.location, "/admin/login.html");
  for (const route of ["vehicles", "images", "description", "team", "analytics", "site-media"]) assert.equal((await f.call("/api/admin/" + route)).status, 401);
  assert.equal((await f.call("/api/admin/auth?action=login", { method: "POST", body: { email: "fixture@example.com", password: "fixture-only" }, headers: { "Content-Type": "application/json", Origin: "https://evil.example" } })).status, 403);
});

test("real Supabase login preserves two secure cookies behind the production proxy", async t => {
  provider(url => url.includes("token?grant_type=password") ? { access_token: token, refresh_token: "fixture-refresh", expires_in: 3600 } : "owner");
  const f = await fixture(t, { production: true, origin: "https://test.autohaus.bg", handlerFor: realHandlers() });
  const r = await f.call("/api/admin/auth?action=login", { method: "POST", body: { email: "fixture@example.com", password: "fixture-only" }, headers: { Host: "test.autohaus.bg", Origin: "https://test.autohaus.bg", "Content-Type": "application/json", "X-Forwarded-Proto": "http" } });
  assert.equal(r.status, 200);
  assert.equal(r.headers["set-cookie"].length, 2);
  for (const cookie of r.headers["set-cookie"]) {
    assert.match(cookie, /HttpOnly/); assert.match(cookie, /SameSite=Strict/); assert.match(cookie, /; Secure/);
  }
});

test("real settings alias retains active roles and bearer-token RLS", async t => {
  let role = "owner", reads = 0;
  provider((url, options) => {
    if (url.endsWith("/rpc/current_admin_role")) return role;
    assert.match(url, /admin_settings/);
    assert.equal(options.headers.Authorization, "Bearer " + token);
    reads++;
    return [{ inquiry_enabled: true }];
  });
  const f = await fixture(t, { production: true, origin: "https://test.autohaus.bg", handlerFor: realHandlers() });
  const headers = { Host: "test.autohaus.bg", Cookie: "ah_admin_access=" + token, Origin: "https://test.autohaus.bg", "Content-Type": "application/json" };
  const r = await f.call("/api/admin/settings", { headers });
  assert.equal(r.status, 200); assert.equal(r.body.settings.inquiry_enabled, true); assert.equal(reads, 1);
  role = "viewer";
  assert.equal((await f.call("/api/admin/settings", { method: "PATCH", body: { inquiry_enabled: false }, headers })).status, 403);
  assert.equal(reads, 1);
  role = null;
  assert.equal((await f.call("/api/admin/settings", { headers })).status, 401);
});

test("real homepage preserves managed Supabase photos on both home routes", async t => {
  const id = "12345678-1234-4123-8123-123456789012";
  provider(url => {
    assert.match(url, /public_admin_settings/);
    return [{ homepage_media: [{ id, slot: "hero-0", width: 1920, height: 1080 }] }];
  });
  const f = await fixture(t, { handlerFor: realHandlers() });
  for (const route of ["/", "/index.html"]) {
    const r = await f.call(route);
    assert.equal(r.status, 200);
    assert.match(r.headers["content-type"], /text\/html/);
    assert.match(r.text, new RegExp("site-media/" + id));
    assert.match(r.text, /data-home-preload=/);
  }
});

test("real vehicle CRUD travels through cPanel HTTP with RLS tokens and editor/viewer restrictions", async t => {
  const id = "00000000-0000-4000-8000-000000000003";
  let role = "owner", rows = [], writes = 0;
  provider((url, options) => {
    if (url.endsWith("/rpc/current_admin_role")) return role;
    assert.match(url, /\/rest\/v1\/vehicles/);
    assert.equal(options.headers.Authorization, "Bearer " + token);
    const method = options.method || "GET";
    if (method === "GET") return rows;
    writes++;
    if (method === "DELETE") { const before = rows; rows = []; return before; }
    const value = JSON.parse(options.body);
    rows = [{ ...rows[0], ...value, id, updated_at: "2026-10-10T10:00:00Z" }];
    return rows;
  });
  const f = await fixture(t, { production: true, origin: "https://autotest.autohaus.bg", handlerFor: realHandlers() });
  const headers = { Host: "autotest.autohaus.bg", Origin: "https://autotest.autohaus.bg", Cookie: "ah_admin_access=" + token, "Content-Type": "application/json" };
  const create = await f.call("/api/admin/vehicles", { method: "POST", headers, body: { make: "BMW", model: "Isolated test", published: false, images: [], equipment_bg: [], equipment_en: [] } });
  assert.equal(create.status, 201);
  assert.equal((await f.call("/api/admin/vehicles?id=" + id, { headers })).body.vehicle.model, "Isolated test");
  role = "editor";
  assert.equal((await f.call("/api/admin/vehicles?id=" + id, { method: "PATCH", headers, body: { model: "Edited fixture" } })).status, 200);
  const before = writes;
  assert.equal((await f.call("/api/admin/vehicles?id=" + id, { method: "DELETE", headers })).status, 403);
  role = "viewer";
  assert.equal((await f.call("/api/admin/vehicles?id=" + id, { method: "PATCH", headers, body: { price: 100 } })).status, 403);
  assert.equal(writes, before);
  role = "owner";
  assert.equal((await f.call("/api/admin/vehicles?id=" + id, { method: "DELETE", headers })).status, 200);
  assert.equal(rows.length, 0);
});
