"use strict";
const fs = require("node:fs"), path = require("node:path"), zlib = require("node:zlib");
const { spawnSync } = require("node:child_process");
const { build } = require("../build");
const { inside } = require("../server/cpanel-server");
const ROOT = path.resolve(__dirname, "..");

function compressPublic(root) {
  let count = 0, before = 0, after = 0;
  function walk(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) { walk(file); continue; }
      if (!entry.isFile() || !/\.(?:html|css|js|svg)$/.test(file)) continue;
      const source = fs.readFileSync(file);
      if (source.length < 512) continue;
      const br = zlib.brotliCompressSync(source, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 5 } });
      const gzip = zlib.gzipSync(source, { level: 9 });
      if (br.length < source.length) fs.writeFileSync(file + ".br", br);
      if (gzip.length < source.length) fs.writeFileSync(file + ".gz", gzip);
      count++; before += source.length; after += br.length;
    }
  }
  walk(path.join(root, "dist"));
  return { count, before, after };
}

function resetRelease(root) {
  const parent = path.join(root, "artifacts", "cpanel");
  fs.mkdirSync(parent, { recursive: true });
  if (!inside(root, fs.realpathSync(parent))) throw new Error("Release output escapes the project");
  const release = path.join(parent, "autohaus34-cnpanel");
  if (fs.existsSync(release)) {
    if (fs.lstatSync(release).isSymbolicLink() || !inside(root, fs.realpathSync(release))) throw new Error("Unsafe release output");
    fs.rmSync(release, { recursive: true, force: true });
  }
  fs.mkdirSync(release);
  return release;
}

function stageRelease(root = ROOT) {
  root = fs.realpathSync(root);
  const release = resetRelease(root);
  const copy = file => {
    const source = path.join(root, file), target = path.join(release, file);
    if (!inside(root, fs.realpathSync(source))) throw new Error("Release input escapes the project");
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
  };
  // Runtime-only allowlist: no credentials, SQL, Git, tools, or CI workflows.
  for (const file of ["app.js", "package.json", "index.html", "build-info.json", "CPANEL.md", "data/inventory.snapshot.json", "data/inventory-manifest.json"]) copy(file);
  if (fs.existsSync(path.join(root, "package-lock.json"))) copy("package-lock.json");
  for (const directory of ["api", "server", "data/eq"]) {
    function walk(relative) {
      for (const entry of fs.readdirSync(path.join(root, relative), { withFileTypes: true })) {
        const file = path.join(relative, entry.name);
        if (entry.isDirectory()) walk(file);
        else if (entry.isFile() && entry.name.endsWith(".js")) copy(file);
      }
    }
    walk(directory);
  }
  fs.cpSync(path.join(root, "dist"), path.join(release, "dist"), { recursive: true, dereference: false });
  fs.mkdirSync(path.join(release, "tmp"));
  fs.mkdirSync(path.join(release, "public"));
  fs.writeFileSync(path.join(release, "public", ".htaccess"), "Options -Indexes\n");
  fs.writeFileSync(path.join(release, "tmp", "restart.txt"), "");
  return release;
}

function archiveRelease(release) {
  const archive = path.join(path.dirname(release), "autohaus34-cnpanel.tar.gz");
  const result = spawnSync("tar", ["-czf", archive, "-C", release, "."], { encoding: "utf8", windowsHide: true });
  if (result.error) throw new Error("tar is required to package the release; the runtime folder is already prepared");
  if (result.status !== 0) throw new Error("Could not package the cPanel release: " + result.stderr);
  return archive;
}

function buildCpanel(options = {}) {
  const root = path.resolve(options.root || ROOT), log = options.log || console.log;
  const result = build({ root, log });
  const compressed = compressPublic(root);
  log("  Precompressed " + compressed.count + " text assets (Brotli + gzip)");
  if (options.package) {
    const release = stageRelease(root), archive = archiveRelease(release);
    log("  cPanel upload: " + archive);
    return { ...result, compressed, release, archive };
  }
  return { ...result, compressed };
}

if (require.main === module) buildCpanel({ package: process.argv.includes("--package") });
module.exports = { buildCpanel, compressPublic, stageRelease, archiveRelease };
