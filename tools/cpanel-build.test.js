"use strict";
const { test } = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), zlib = require("node:zlib");
const { spawnSync } = require("node:child_process");
const { compressPublic, stageRelease, archiveRelease } = require("./cpanel-build");

function fixture(t) {
  const parent = fs.realpathSync(os.tmpdir()), root = fs.mkdtempSync(path.join(parent, "autohaus-cpanel-package-"));
  const write = (file, content) => { fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.writeFileSync(path.join(root, file), content); };
  t.after(() => {
    const target = fs.realpathSync(root);
    if (path.dirname(target) !== parent || !path.basename(target).startsWith("autohaus-cpanel-package-")) throw new Error("Unsafe cleanup");
    fs.rmSync(target, { recursive: true, force: true });
  });
  for (const file of ["app.js", "package.json", "index.html", "build-info.json", "CPANEL.md", "data/inventory.snapshot.json", "data/inventory-manifest.json", "server/cpanel-server.js", "api/admin/auth.js", "data/eq/fixture.js"]) write(file, "fixture");
  for (const file of [".env", "server/.env", "api/private.sql", "admin/schema.sql", ".git/config", "tools/private.js", ".github/workflows/private.yml"]) write(file, "PRIVATE_SENTINEL");
  write("dist/vehicle.html", "<!doctype html>" + "fixture".repeat(1000));
  write("dist/main.js", "window.fixture=true;".repeat(1000));
  write("dist/img/photo.webp", "fixture image");
  return { root, write };
}

test("build-time compression is lossless and does not process image bytes", t => {
  const f = fixture(t), result = compressPublic(f.root);
  assert.equal(result.count, 2);
  assert.ok(result.after < result.before);
  for (const file of ["vehicle.html", "main.js"]) {
    const source = fs.readFileSync(path.join(f.root, "dist", file));
    assert.deepEqual(zlib.brotliDecompressSync(fs.readFileSync(path.join(f.root, "dist", file + ".br"))), source);
    assert.deepEqual(zlib.gunzipSync(fs.readFileSync(path.join(f.root, "dist", file + ".gz"))), source);
  }
  assert.equal(fs.existsSync(path.join(f.root, "dist/img/photo.webp.br")), false);
});

test("runtime release has startup/backend/assets but no credentials, SQL, Git or tools", t => {
  const f = fixture(t), release = stageRelease(f.root);
  for (const file of ["app.js", "package.json", "index.html", "server/cpanel-server.js", "api/admin/auth.js", "data/inventory.snapshot.json", "data/eq/fixture.js", "dist/main.js", "tmp/restart.txt"]) assert.ok(fs.existsSync(path.join(release, file)), file);
  for (const file of [".env", "server/.env", "api/private.sql", "admin/schema.sql", ".git/config", "tools/private.js", ".github/workflows/private.yml"]) assert.equal(fs.existsSync(path.join(release, file)), false, file);
  assert.equal(stageRelease(f.root), release, "Repeated packaging only replaces generated output");
});

test("runtime tar archive has a direct app.js and no private configuration", t => {
  const f = fixture(t), archive = archiveRelease(stageRelease(f.root));
  const result = spawnSync("tar", ["-tzf", archive], { encoding: "utf8", windowsHide: true });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /\.\/app\.js/);
  assert.doesNotMatch(result.stdout, /\.env|\.git\/|schema\.sql|tools\//);
});
