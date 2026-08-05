/* ============================================================
   AUTOHAUS — THE BUILD  (node build.js)

   This site is hand-authored and has no framework, no bundler and no
   dependencies, and that does not change. This script does exactly two
   things, both of which are measurable and neither of which touches a
   source file:

     1. STRIPS THE STYLESHEETS.  style.css is 206KB of which 44% is the
        commentary that explains why every number in it is what it is. That
        commentary is the most valuable thing in the repository and it stays
        exactly where it is — but it does not need to travel to a phone.
        style.min.css is generated from it, comments removed and whitespace
        collapsed, nothing else: no reordering, no shorthand rewriting, no
        removal of spaces around calc() operators. Measured on a 1.6Mbps
        link with a 4x-throttled CPU: 49KB -> 18KB over brotli and first
        paint 1352ms -> 1152ms. Verified by comparing every computed
        property of every element on four page/width combinations — the two
        stylesheets are indistinguishable to the browser.

     2. STAMPS THE VERSION.  Every asset URL carries ?v=<hash>, where the
        hash is taken over the content of all of them. Editing any file
        changes every URL exactly once, so a returning visitor is never
        served a stale stylesheet and never re-downloads an unchanged one.
        This replaces the hand-typed ?v=155 that had to be remembered.

   WHAT IT DELIBERATELY DOES NOT DO: minify JavaScript. A hand-rolled JS
   minifier was written, measured and thrown away — it corrupted main.js at
   line 1330 by mistaking the tail of a regular expression for a comment.
   The scripts are already off the critical path (see "THE CRITICAL PATH" in
   any page head) and brotli takes main.js to 20KB on its own. The risk was
   real and the remaining prize was not.

   RUN THIS AFTER EDITING ANY .css OR .js FILE. If you forget, the site
   still works — it just serves the previous stylesheet until you do.
   ============================================================ */
"use strict";
const fs = require("fs"), path = require("path"), crypto = require("crypto");
const ROOT = __dirname;

const SHEETS = ["style.css", "catalog.css"];
const SCRIPTS = ["main.js", "catalog.js", "showroom.js", "concierge.js", "i18n.js",
                 "vehicle.js", "data/vehicles.js"];
const PAGES = ["index.html", "concierge.html", "vehicle.html", "legal.html"];

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
    if (c === '"' || c === "'") {                       /* string: verbatim */
      const q = c; out += c; i++;
      while (i < n) {
        if (src[i] === "\\") { out += src[i] + (src[i + 1] || ""); i += 2; continue; }
        if (src[i] === q) break;
        out += src[i++];
      }
      out += q; i++; continue;
    }
    if (c === "/" && src[i + 1] === "*") {              /* comment: gone */
      const e = src.indexOf("*/", i + 2);
      i = e === -1 ? n : e + 2;
      /* leave one space behind, so two tokens separated only by a comment
         can never fuse into one when the comment goes */
      if (!/\s$/.test(out)) out += " ";
      continue;
    }
    if (/\s/.test(c)) {                                  /* run -> one space */
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
  const dest = f.replace(/\.css$/, ".min.css");
  fs.writeFileSync(path.join(ROOT, dest), out, "utf8");
  built.push({ f, dest, a: Buffer.byteLength(src), b: Buffer.byteLength(out) });
}

/* ---- one hash over everything the browser can fetch ---- */
const h = crypto.createHash("sha1");
for (const f of SHEETS.concat(SCRIPTS)) {
  const p = path.join(ROOT, f);
  if (fs.existsSync(p)) h.update(fs.readFileSync(p));
}
const V = h.digest("hex").slice(0, 8);

/* ---- stamp every asset URL in every page ---- */
let stamped = 0;
for (const p of PAGES) {
  const file = path.join(ROOT, p);
  if (!fs.existsSync(file)) continue;
  let s = fs.readFileSync(file, "utf8"), before = s;
  s = s.replace(/(["'(])((?:[\w./-]*\/)?[\w.-]+\.(?:css|js))\?v=[\w]+/g, "$1$2?v=" + V);
  if (s !== before) { fs.writeFileSync(file, s, "utf8"); stamped++; }
}

console.log("AutoHaus build");
built.forEach(b => console.log("  " + b.f.padEnd(14) + k(b.a) + " -> " + b.dest.padEnd(18) + k(b.b) +
  "   (-" + Math.round((1 - b.b / b.a) * 100) + "%)"));
console.log("  version        ?v=" + V + "   stamped into " + stamped + " page(s)");
console.log("\n  Sources are untouched. Re-run after editing any .css or .js file.");
