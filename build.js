/* AutoHaus build: generate CSS, stamp asset versions and prepare public-only dist. */
"use strict";
const fs = require("fs"), path = require("path"), crypto = require("crypto");
const ROOT = __dirname;

const SHEETS = ["style.css", "catalog.css"];
const SCRIPTS = ["main.js", "catalog.js", "showroom.js", "concierge.js", "i18n.js",
                 "vehicle.js", "data/vehicles.base.js", "data/vehicles.js", "admin/admin.js", "admin/login.js",
                 "admin/setup.js", "admin/storage-compat.js", "admin/sync.js", "admin/admin.css"];
const STATIC_ASSETS = ["autohaus.svg"];
const PAGES = ["index.html", "concierge.html", "vehicle.html", "legal.html", "admin/login.html", "admin/setup.html", "api/admin/page.js"];

/* ---- the stripper ----------------------------------------------------
   Character-by-character rather than regex, because a regex that removes
   comments will also remove the inside of `content:"/* "` and a regex that
   collapses whitespace will also collapse it inside a url(). This walks
   strings and comments as the tokeniser does, and only then tightens the
   structural punctuation. */
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
      let j = i; while (j < n && /\s/.test(src[j])) j++;
      out += " "; i = j; continue;
    }
    out += c; i++;
  }
  return out.replace(/\s*([{};,])\s*/g, "$1").replace(/;}/g, "}").trim();
}

const k = b => (b / 1024).toFixed(1) + "KB";
let built = [];

for (const f of SHEETS) {
  const src = fs.readFileSync(path.join(ROOT, f), "utf8");
  const out = stripCss(src);
  const OPEN = "/" + "*", CLOSE = "*" + "/";
  const at = Math.max(out.indexOf(CLOSE), out.indexOf(OPEN));
  if (at !== -1) {
    console.error("\n  " + f + ": unbalanced comment — a " + out.substr(at, 2) +
      " survived stripping, after:\n    …" +
      out.slice(Math.max(0, at - 96), at + 2).replace(/\s+/g, " ") +
      "\n\n  The CSS parser discards that and the rules following it." +
      "\n  Nothing was written; fix the comment and run again.\n");
    process.exit(1);
  }
  const dest = f.replace(/\.css$/, ".min.css");
  fs.writeFileSync(path.join(ROOT, dest), out, "utf8");
  built.push({ f, dest, a: Buffer.byteLength(src), b: Buffer.byteLength(out) });
}

const h = crypto.createHash("sha1");
for (const f of SHEETS.concat(SCRIPTS, STATIC_ASSETS)) {
  const p = path.join(ROOT, f);
  if (fs.existsSync(p)) h.update(fs.readFileSync(p));
}
const EQ = path.join(ROOT, "data", "eq");
if (fs.existsSync(EQ)) {
  for (const f of fs.readdirSync(EQ).sort()) {
    if (f.endsWith(".js")) h.update(fs.readFileSync(path.join(EQ, f)));
  }
}
const V = h.digest("hex").slice(0, 8);

let stamped = 0;
for (const p of PAGES) {
  const file = path.join(ROOT, p);
  if (!fs.existsSync(file)) continue;
  let s = fs.readFileSync(file, "utf8"), before = s;
  s = s.replace(/(["'(])((?:[\w./-]*\/)?[\w.-]+\.(?:css|js|svg))\?v=[\w-]+/g, "$1$2?v=" + V);
  if (s !== before) { fs.writeFileSync(file, s, "utf8"); stamped++; }
}

console.log("AutoHaus build");
built.forEach(b => console.log("  " + b.f.padEnd(14) + k(b.a) + " -> " + b.dest.padEnd(18) + k(b.b) +
  "   (-" + Math.round((1 - b.b / b.a) * 100) + "%)"));
console.log("  version        ?v=" + V + "   stamped into " + stamped + " page(s)");
console.log("\n  Styles generated and page asset versions updated.");

const DIST = path.resolve(ROOT, "dist");
if (path.dirname(DIST) !== ROOT || path.basename(DIST) !== "dist") throw new Error("Invalid output directory");
fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });
const publicFiles = ["index.html", "vehicle.html", "concierge.html", "legal.html", "style.min.css", "catalog.min.css", "main.js", "catalog.js", "showroom.js", "vehicle.js", "concierge.js", "i18n.js", "autohaus.svg", "favicon.jpg", "_headers", "data/vehicles.base.js", "data/vehicles.js", "admin/login.html", "admin/setup.html", "admin/admin.css", "admin/admin.js", "admin/login.js", "admin/setup.js", "admin/storage-compat.js", "admin/sync.js"];
for (const f of publicFiles) {
  if (!fs.existsSync(path.join(ROOT, f))) continue;
  fs.mkdirSync(path.dirname(path.join(DIST, f)), { recursive: true });
  fs.copyFileSync(path.join(ROOT, f), path.join(DIST, f));
}
for (const dir of ["img", "fonts", "data/eq"]) {
  fs.cpSync(path.join(ROOT, dir), path.join(DIST, dir), { recursive: true, filter: f => fs.statSync(f).isDirectory() || !/(?:README|\.md$)/.test(f) });
}
console.log("  Public assets prepared in dist/");
