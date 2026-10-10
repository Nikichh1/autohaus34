"use strict";
const fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto");
const { verifyBuild } = require("../server/build-info");
const { originConfiguration } = require("../server/cpanel-server");
const { db } = require("../server/admin-lib");
const ROOT = path.resolve(__dirname, "..");

function checkDocumentRoot(applicationRoot, directory) {
  const root = fs.realpathSync(directory);
  if (root === applicationRoot || root === path.join(applicationRoot, "dist")) throw new Error("Document Root must be an empty public directory, not the checkout or dist");
  const unexpected = fs.readdirSync(root).filter(name => ![".htaccess", ".well-known"].includes(name));
  if (unexpected.length) throw new Error("Document Root contains source/static files which can shadow Passenger: " + unexpected.slice(0, 5).join(", "));
  return root;
}

async function liveCheck(origin, info) {
  const read = (url, options = {}) => fetch(origin + url, { redirect: "manual", signal: AbortSignal.timeout(15000), ...options });
  const health = await read("/healthz");
  const state = await health.json();
  if (!health.ok || !state.ok || state.buildId !== info.buildId) throw new Error("Live /healthz does not match this build; check Passenger application root and Restart");
  const asset = await read("/admin/admin.css?v=" + info.buildId);
  const bytes = Buffer.from(await asset.arrayBuffer());
  if (!asset.ok || crypto.createHash("sha256").update(bytes).digest("hex") !== info.files["dist/admin/admin.css"]) throw new Error("Live admin CSS differs from dist (old source file or cache)");
  if (!/no-store|no-cache/.test(asset.headers.get("cache-control") || "")) throw new Error("Admin CSS has an unsafe deployment cache policy");
  for (const route of ["/admin", "/admin/"]) {
    const page = await read(route);
    if (page.status !== 302 || page.headers.get("location") !== "/admin/login.html") throw new Error("Anonymous admin route must redirect to login: " + route);
  }
  for (const route of ["/.env", "/.git/config", "/server/admin-lib.js", "/app.js", "/admin/schema.sql", "/build-info.json"]) {
    const response = await read(route, { method: "HEAD" });
    if (![403, 404].includes(response.status)) throw new Error("Private file is publicly reachable: " + route);
  }
  const catalogResponse = await read("/api/public/vehicles?fresh=" + Date.now(), { headers: { Referer: origin + "/", "Sec-Fetch-Site": "same-origin" } });
  const catalog = await catalogResponse.json();
  if (!catalogResponse.ok || catalog.ok !== true || catalog.authoritative !== true || !Array.isArray(catalog.vehicles)) throw new Error("Live catalog is not an authoritative Supabase response");
  // Read-only comparison; never import, seed or edit a record.
  const databaseResponse = await db("vehicles?published=eq.true&select=slug", { method: "GET" });
  if (!databaseResponse.ok) throw new Error("Could not verify published Supabase records");
  const rows = await databaseResponse.json();
  const ids = list => list.map(row => row.slug || row.id).sort().join("\n");
  if (ids(rows) !== ids(catalog.vehicles)) throw new Error("Live catalog differs from the currently published Supabase vehicles");
  console.log("PASS: live build, current admin CSS, both login redirects and " + rows.length + " published Supabase vehicles");
}

async function main(args) {
  const values = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--live") values.live = true;
    else if (["--document-root", "--origin"].includes(args[i]) && args[i + 1]) values[args[i].slice(2)] = args[++i];
    else throw new Error("Usage: node tools/cpanel-doctor.js [--document-root PATH] --origin https://autotest.autohaus.bg [--live]");
  }
  const info = verifyBuild(ROOT);
  const { origin } = originConfiguration(values.origin || process.env.PUBLIC_ORIGIN, true);
  console.log("PASS: application root " + ROOT + "; build " + info.buildId);
  if (values["document-root"]) console.log("PASS: public Document Root " + checkDocumentRoot(ROOT, path.resolve(values["document-root"])));
  if (values.live) await liveCheck(origin.origin, info);
  else console.log("Run again with --live after cPanel Save/Restart to verify the actual deployment.");
}
if (require.main === module) main(process.argv.slice(2)).catch(error => { console.error("FAIL: " + error.message); process.exitCode = 1; });
module.exports = { checkDocumentRoot, liveCheck };
