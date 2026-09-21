"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), crypto = require("node:crypto");
const { build } = require("../build.js");

function fixture(t) {
  const parent = fs.realpathSync(os.tmpdir());
  const root = fs.mkdtempSync(path.join(parent, "autohaus-build-performance-"));
  function write(file, content) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), content);
  }
  t.after(() => {
    const target = fs.realpathSync(root);
    if (path.dirname(target) !== parent || !path.basename(target).startsWith("autohaus-build-performance-")) throw new Error("Invalid test cleanup target");
    fs.rmSync(target, { recursive: true, force: true });
  });
  for (const file of ["main.js", "catalog.js", "showroom.js", "vehicle.js", "concierge.js", "i18n.js", "analytics.js", "data/vehicles.base.js", "data/vehicles.js", "data/photo-insets.js", "admin/admin.js", "admin/login.js", "admin/advanced.js", "admin/image-sorter.js"]) write(file, "/* " + file + " */\nwindow.loaded = true;");
  for (const file of ["style.css", "catalog.css", "admin/admin.css", "admin/brand.css", "admin/brand-fallback.css", "admin/image-sorter.css"]) write(file, "/* " + file + " */\nbody { color: #111; }");
  for (const file of ["watermark.js", "image-guard.js", "catalog-prefetch.js", "vehicle-i18n-runtime.js"]) write(file, "/* fixture */");
  write("vehicle-fixes.css", "/* fixture */");
  write("autohaus.svg", "<svg></svg>"); write("favicon.jpg", "image"); write("_headers", "/*\n  X-Content-Type-Options: nosniff");
  write("img/test.webp", "picture"); write("fonts/test.woff2", "font"); write("data/eq/test.js", "window.AH_EQ={id:'test',e:[]};");
  write(".env", "PRIVATE=true"); write("server/private.js", "PRIVATE"); write("data/inventory.snapshot.json", "PRIVATE");
  const head = '<link rel="stylesheet" href="style.min.css?v=old"><link rel="stylesheet" href="catalog.min.css?v=old"><script async src="data/vehicles.js?v=old"></script><script defer src="main.js?v=old"></script><img src="autohaus.svg?v=old">';
  for (const file of ["index.html", "vehicle.html", "concierge.html", "legal.html"]) write(file, "<!doctype html><head>" + head + "</head><body></body>");
  write("admin/login.html", '<head><link href="/admin/admin.css?v=old"><script src="/admin/login.js?v=old"></script></head>');
  write("admin/setup.html", "<head></head>");
  write("api/admin/page.js", 'module.exports = "<head><link href=\'/admin/admin.css?v=old\'><link href=\'/admin/image-sorter.css?v=old\'><script src=\'/admin/admin.js?v=old\'></script><script src=\'/admin/image-sorter.js?v=old\'></script></head>";');
  return { root, write, read: file => fs.readFileSync(path.join(root, file), "utf8"), run: () => build({ root, log() {} }) };
}

test("admin-only edits preserve every unchanged public asset URL", t => {
  const f = fixture(t), first = f.run(), index = f.read("index.html");
  f.write("admin/admin.js", "window.adminChanged = true;");
  const second = f.run();
  assert.notEqual(second.versions["admin/admin.js"], first.versions["admin/admin.js"]);
  for (const file of Object.keys(first.versions).filter(file => file !== "admin/admin.js")) assert.equal(second.versions[file], first.versions[file], file);
  assert.equal(f.read("index.html"), index);
  assert.match(f.read("api/admin/page.js"), new RegExp("/admin/admin.js\\?v=" + second.versions["admin/admin.js"]));
});

test("admin CSS version covers the exact concatenated bytes delivered in dist", t => {
  const f = fixture(t), first = f.run();
  f.write("admin/brand-fallback.css", ".card { border-color: black; }");
  const second = f.run(), output = f.read("dist/admin/admin.css");
  assert.notEqual(first.versions["admin/admin.css"], second.versions["admin/admin.css"]);
  assert.equal(second.versions["admin/admin.css"], crypto.createHash("sha256").update(output).digest("hex").slice(0, 12));
  assert.equal(output, ["admin/admin.css", "admin/brand.css", "admin/brand-fallback.css"].map(f.read).join("\n"));
  assert.match(f.read("admin/login.html"), new RegExp("admin/admin.css\\?v=" + second.versions["admin/admin.css"]));
  assert.equal(first.versions["style.min.css"], second.versions["style.min.css"]);
});

test("CSS hashes use minified content, and repeated builds are idempotent", t => {
  const f = fixture(t), first = f.run();
  assert.equal(f.run().stamped, 0);
  f.write("style.css", "/* Changed developer explanation only */\nbody { color: #111; }");
  const second = f.run();
  assert.equal(second.versions["style.min.css"], first.versions["style.min.css"]);
  assert.equal(second.stamped, 0);
  assert.equal((f.read("vehicle.html").match(/name="ah-equipment-version"/g) || []).length, 1);
});

test("equipment changes update only independent page metadata, including renamed files", t => {
  const f = fixture(t), first = f.run();
  f.write("data/eq/test.js", "window.AH_EQ={id:'test',e:['New item']};");
  const second = f.run();
  assert.notEqual(second.equipmentVersion, first.equipmentVersion);
  assert.deepEqual(second.versions, first.versions);
  assert.match(f.read("dist/vehicle.html"), new RegExp('name="ah-equipment-version" content="' + second.equipmentVersion + '"'));
  f.write("data/eq/another.js", "window.AH_EQ={id:'test',e:['New item']};");
  assert.notEqual(f.run().equipmentVersion, second.equipmentVersion);
});

test("dist retains the public allowlist and excludes private sources", t => {
  const f = fixture(t); f.run();
  for (const file of [".env", "server/private.js", "api/admin/page.js", "data/inventory.snapshot.json", "build.js"]) assert.equal(fs.existsSync(path.join(f.root, "dist", file)), false, file);
  for (const file of ["index.html", "admin/admin.js", "admin/image-sorter.js", "admin/image-sorter.css", "data/photo-insets.js", "img/test.webp", "fonts/test.woff2", "data/eq/test.js"]) assert.equal(fs.existsSync(path.join(f.root, "dist", file)), true, file);
});

test("font URL deduplication preserves exact font bytes and weight declarations", () => {
  const root = path.join(__dirname, ".."), css = fs.readFileSync(path.join(root, "style.css"), "utf8");
  let total = 0, unique = 0;
  for (const subset of ["latin", "cyrillic"]) {
    const canonical = fs.readFileSync(path.join(root, "fonts/exo2-300-" + subset + ".woff2"));
    unique += canonical.length;
    for (const weight of [300, 400, 600]) {
      const file = fs.readFileSync(path.join(root, "fonts/exo2-" + weight + "-" + subset + ".woff2"));
      assert.deepEqual(file, canonical);
      total += file.length;
      assert.match(css, new RegExp('font-weight:' + weight + ';font-display:swap;\\s*src:url\\("fonts/exo2-300-' + subset + '\\.woff2"\\)'));
    }
  }
  assert.equal(total - unique, 120984);
  assert.equal((css.match(/src:url\("fonts\/exo2-(?:400|600)-/g) || []).length, 0);
});
