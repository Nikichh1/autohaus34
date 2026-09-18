/* AutoHaus build: generate CSS, version delivered assets and prepare public-only dist. */
"use strict";
const fs = require("fs"), path = require("path"), crypto = require("crypto");

const SHEETS = ["style.css", "catalog.css"];
const ADMIN_STYLES = ["admin/admin.css", "admin/brand.css", "admin/brand-fallback.css"];
const PAGES = ["index.html", "concierge.html", "vehicle.html", "legal.html", "admin/login.html", "admin/setup.html", "api/admin/page.js"];
const PUBLIC_FILES = [
  "index.html", "vehicle.html", "concierge.html", "legal.html", "style.min.css", "catalog.min.css", "vehicle-fixes.css",
  "main.js", "catalog.js", "showroom.js", "vehicle.js", "vehicle-i18n-runtime.js", "concierge.js", "i18n.js", "analytics.js", "watermark.js",
  "autohaus.svg", "favicon.jpg", "_headers", "data/vehicles.base.js", "data/vehicles.js", "data/photo-insets.js",
  "admin/login.html", "admin/setup.html", "admin/admin.css", "admin/admin.js", "admin/admin-fixes.js", "admin/fast-cache.js", "admin/notes-translation.js", "admin/login.js",
  "admin/advanced.js", "admin/image-sorter.js", "admin/image-sorter.css"
];

function stripCss(src) {
  let out = "", i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    if (c === '"' || c === "'") {
      const q = c; out += c; i++;
      while (i < n) {
        if (src[i] === "\\") { out += src[i] + (src[i + 1] || ""); i += 2; continue; }
        if (src[i] === q) break;
        out += src[i++];
      }
      out += q; i++; continue;
    }
    if (c === "/" && src[i + 1] === "*") {
      const e = src.indexOf("*/", i + 2);
      i = e === -1 ? n : e + 2;
      if (!/\s$/.test(out)) out += " ";
      continue;
    }
    if (/\s/.test(c)) {
      let j = i;
      while (j < n && /\s/.test(src[j])) j++;
      out += " "; i = j; continue;
    }
    out += c; i++;
  }
  return out.replace(/\s*([{};,])\s*/g, "$1").replace(/;}/g, "}").trim();
}

const digest = bytes => crypto.createHash("sha256").update(bytes).digest("hex").slice(0, 12);
const size = bytes => (bytes / 1024).toFixed(1) + "KB";

function build(options = {}) {
  const root = path.resolve(options.root || __dirname);
  const log = options.log || console.log;
  const built = [];
  for (const file of SHEETS) {
    const source = fs.readFileSync(path.join(root, file), "utf8"), output = stripCss(source);
    if (output.includes("/*") || output.includes("*/")) throw new Error("Unbalanced CSS comment in " + file);
    const dest = file.replace(/\.css$/, ".min.css");
    fs.writeFileSync(path.join(root, dest), output, "utf8");
    built.push({ file, dest, before: Buffer.byteLength(source), after: Buffer.byteLength(output) });
  }

  const adminCss = ADMIN_STYLES.map(file => fs.readFileSync(path.join(root, file), "utf8")).join("\n");
  const versions = new Map();
  for (const file of PUBLIC_FILES) {
    if (!/\.(?:css|js|svg)$/.test(file) || !fs.existsSync(path.join(root, file))) continue;
    versions.set(file, digest(file === "admin/admin.css" ? adminCss : fs.readFileSync(path.join(root, file))));
  }

  const equipmentDir = path.join(root, "data", "eq"), equipmentHash = crypto.createHash("sha256");
  if (fs.existsSync(equipmentDir)) {
    for (const file of fs.readdirSync(equipmentDir).sort()) {
      if (!file.endsWith(".js")) continue;
      equipmentHash.update(file + "\0").update(fs.readFileSync(path.join(equipmentDir, file))).update("\0");
    }
  }
  const equipmentVersion = equipmentHash.digest("hex").slice(0, 12);
  let stamped = 0;
  for (const page of PAGES) {
    const file = path.join(root, page);
    if (!fs.existsSync(file)) continue;
    let source = fs.readFileSync(file, "utf8"), before = source;
    source = source.replace(/(["'(])((?:[\w./-]*\/)?[\w.-]+\.(?:css|js|svg))\?v=[\w-]+/g, (match, quote, url) => {
      const asset = path.posix.normalize(url.startsWith("/") ? url.slice(1) : path.posix.join(path.posix.dirname(page), url));
      const version = versions.get(asset);
      if (!version) throw new Error("No public asset version for " + url + " in " + page);
      return quote + url + "?v=" + version;
    });
    if (["index.html", "vehicle.html", "concierge.html", "legal.html"].includes(page) && !source.includes("analytics.js?v=")) {
      source = source.replace(/<\/head>/i, '<script defer src="analytics.js?v=' + versions.get("analytics.js") + '"></script>\n</head>');
    }
    if (page === "vehicle.html" && !source.includes("watermark.js?v=")) {
      source = source.replace(/<\/head>/i, '<script defer src="watermark.js?v=' + versions.get("watermark.js") + '"></script>\n</head>');
    }
    if (page === "index.html" && !source.includes("catalog-prefetch.js?v=")) {
      source = source.replace(/<script defer src="showroom\.js[^>]*><\/script>/i, function (tag) {
        return '<script defer src="catalog-prefetch.js?v=' + versions.get("catalog-prefetch.js") + '"></script>\n' + tag;
      });
    }
    if (page === "vehicle.html") {
      if (!source.includes("vehicle-fixes.css?v=")) {
        source = source.replace(/<link rel="stylesheet" href="catalog\.min\.css[^>]*>/i, function (tag) {
          return tag + '\n<link rel="stylesheet" href="vehicle-fixes.css?v=' + versions.get("vehicle-fixes.css") + '">';
        });
      }
      if (!source.includes("vehicle-i18n-runtime.js?v=")) {
        source = source.replace(/<script defer src="i18n\.js[^>]*><\/script>/i, function (tag) {
          return '<script defer src="vehicle-i18n-runtime.js?v=' + versions.get("vehicle-i18n-runtime.js") + '"></script>\n' + tag;
        });
      }
      const tag = '<meta name="ah-equipment-version" content="' + equipmentVersion + '">';
      const existing = /<meta\b[^>]*\bname=["']ah-equipment-version["'][^>]*>/i;
      source = existing.test(source) ? source.replace(existing, tag) : source.replace(/<\/head>/i, tag + "\n</head>");
    }
    if (source !== before) { fs.writeFileSync(file, source, "utf8"); stamped++; }
  }

  const dist = path.resolve(root, "dist");
  if (path.dirname(dist) !== root || path.basename(dist) !== "dist") throw new Error("Invalid output directory");
  fs.rmSync(dist, { recursive: true, force: true });
  fs.mkdirSync(dist, { recursive: true });
  for (const file of PUBLIC_FILES) {
    if (!fs.existsSync(path.join(root, file))) continue;
    fs.mkdirSync(path.dirname(path.join(dist, file)), { recursive: true });
    if (file === "admin/admin.css") fs.writeFileSync(path.join(dist, file), adminCss, "utf8");
    else fs.copyFileSync(path.join(root, file), path.join(dist, file));
  }
  for (const dir of ["img", "fonts", "data/eq"]) {
    fs.cpSync(path.join(root, dir), path.join(dist, dir), {
      recursive: true,
      filter: file => fs.statSync(file).isDirectory() || !/(?:README|\.md$)/.test(file)
    });
  }
  log("AutoHaus build");
  built.forEach(item => log("  " + item.file.padEnd(14) + size(item.before) + " -> " + item.dest.padEnd(18) + size(item.after) + "   (-" + Math.round((1 - item.after / item.before) * 100) + "%)"));
  log("  Asset hashes   " + versions.size + " independent versions; stamped " + stamped + " page(s)");
  log("  Public assets prepared in dist/");
  return { versions: Object.fromEntries(versions), equipmentVersion, stamped };
}

if (require.main === module) build();
module.exports = { build, stripCss };
