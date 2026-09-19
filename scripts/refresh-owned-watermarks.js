"use strict";
// one-time GitHub Actions watermark migration trigger

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const ROOT = path.resolve(__dirname, "..");
const LOGO = path.join(ROOT, "autohaus.svg");
const SUPABASE = "https://ajoiqomflplhadyhxvfe.supabase.co";
const KEY = "sb_publishable_gBEUBrOjT_JsBRjAnGL9PQ_ra-1hY0g";
const BUCKET = "vehicle-images";

/* Existing owned-v1 variants already contain an 8% alpha mark.
   Add exactly enough alpha at the same 13% geometry to reach ~25% total:
   1 - (1-.08)*(1-x) = .25 => x = .1847826087. */
const EXTRA_OPACITY = 0.1847826087;
const MARK_SIZE = 0.13;
const CONCURRENCY = 3;

function headers(extra) {
  return Object.assign({ apikey: KEY }, extra || {});
}
function objectKey(url) {
  const marker = "/storage/v1/object/public/" + BUCKET + "/";
  const i = String(url || "").indexOf(marker);
  if (i < 0) throw new Error("Unexpected public variant URL: " + url);
  return decodeURIComponent(String(url).slice(i + marker.length));
}
function encoded(key) {
  return String(key).split("/").map(encodeURIComponent).join("/");
}
function logoSvg() {
  return fs.readFileSync(LOGO, "utf8").replace(/<svg\b/i, '<svg opacity="' + EXTRA_OPACITY + '"');
}
const overlayCache = new Map();
async function overlay(width) {
  const w = Math.max(1, Math.round(width * MARK_SIZE));
  if (!overlayCache.has(w)) {
    overlayCache.set(w, sharp(Buffer.from(logoSvg())).resize({ width:w }).png().toBuffer());
  }
  return overlayCache.get(w);
}
async function variant(input, width, format) {
  const mark = await overlay(width);
  let p = sharp(input, { failOn:"none" }).rotate().resize({ width, withoutEnlargement:true })
    .composite([{ input:mark, gravity:"centre" }]);
  return format === "webp"
    ? p.webp({ quality:88, effort:4 }).toBuffer()
    : p.jpeg({ quality:90, progressive:true, chromaSubsampling:"4:2:0" }).toBuffer();
}
function v2(url) {
  const next = String(url || "").replace("/owned-v1/", "/owned-v2/");
  if (next === String(url || "")) throw new Error("Expected owned-v1 URL: " + url);
  return next;
}
async function put(url, bytes, contentType) {
  const key = objectKey(url);
  const r = await fetch(SUPABASE + "/storage/v1/object/" + BUCKET + "/" + encoded(key), {
    method:"POST",
    headers:headers({
      "Content-Type":contentType,
      "x-upsert":"true",
      "cache-control":"31536000"
    }),
    body:bytes
  });
  if (!r.ok) throw new Error("Upload failed " + r.status + " for " + key + ": " + (await r.text()).slice(0,220));
}
async function getInventory() {
  const r = await fetch(SUPABASE + "/rest/v1/vehicles?select=slug,images&published=eq.true", {
    headers:headers({ Accept:"application/json" })
  });
  if (!r.ok) throw new Error("Inventory read failed " + r.status);
  const rows = await r.json();
  if (!Array.isArray(rows) || rows.length < 20) throw new Error("Unexpected inventory size");
  return rows;
}
async function processImage(slug, image, index) {
  const v = image && image.variants || {};
  const source = v.jpg1280 || v.jpg800 || v.jpg400;
  if (!source || !String(source).includes("/owned-v1/")) throw new Error("Missing owned-v1 source for " + slug + " #" + (index+1));
  const r = await fetch(source, { headers:{ Accept:"image/jpeg,image/*" } });
  if (!r.ok) throw new Error("Source fetch " + r.status + " for " + slug + " #" + (index+1));
  const input = Buffer.from(await r.arrayBuffer());

  for (const width of [400,800,1280]) {
    const jpg = await variant(input, width, "jpg");
    const webp = await variant(input, width, "webp");
    if (!v["jpg"+width] || !v["webp"+width]) throw new Error("Incomplete variants for " + slug + " #" + (index+1));
    await Promise.all([
      put(v2(v["jpg"+width]), jpg, "image/jpeg"),
      put(v2(v["webp"+width]), webp, "image/webp")
    ]);
  }
}
async function run() {
  if (!fs.existsSync(LOGO)) throw new Error("Watermark logo missing");
  const rows = await getInventory();
  const jobs = [];
  rows.forEach(row => (Array.isArray(row.images) ? row.images : []).forEach((image,index) => jobs.push({slug:row.slug,image,index})));
  if (jobs.length !== 582) throw new Error("Expected 582 owned images, got " + jobs.length);
  console.log("Creating owned-v2 embedded-watermark set for " + jobs.length + " images / " + (jobs.length*6) + " variants");
  let cursor = 0, done = 0;
  async function worker() {
    while (cursor < jobs.length) {
      const job = jobs[cursor++];
      await processImage(job.slug, job.image, job.index);
      done++;
      if (done % 20 === 0 || done === jobs.length) console.log("  watermarked " + done + "/" + jobs.length);
    }
  }
  await Promise.all(Array.from({length:CONCURRENCY}, worker));
  console.log("owned-v2 embedded watermark generation complete");
}
run().catch(error => {
  console.error(error && (error.stack || error.message) || error);
  process.exitCode = 1;
});
