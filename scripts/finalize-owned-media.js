"use strict";

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const ROOT = path.resolve(__dirname, "..");
const LOGO_FILE = path.join(ROOT, "autohaus.svg");
const SUPABASE_URL = "https://ajoiqomflplhadyhxvfe.supabase.co";
const SUPABASE_KEY = "sb_publishable_gBEUBrOjT_JsBRjAnGL9PQ_ra-1hY0g";
const PUBLIC_BUCKET = "vehicle-images";
const PRIVATE_BUCKET = "vehicle-originals";
const FINAL_PREFIX = "owned-v1/";
const TEMP_PREFIX = "owned-mig-8f31d9c20b7a4ed0/";
const SECURITY_OPACITY = 0.08;
const SECURITY_SIZE = 0.13;

function headers(extra) {
  return Object.assign({ apikey: SUPABASE_KEY }, extra || {});
}
function objectPath(value) {
  return String(value).split("/").map(encodeURIComponent).join("/");
}
async function fetchJson(url, options) {
  const r = await fetch(url, options || { headers: headers({ Accept: "application/json" }) });
  const data = await r.json().catch(() => null);
  if (!r.ok) throw new Error("HTTP " + r.status + " " + JSON.stringify(data).slice(0, 300));
  return data;
}

function logoSvg() {
  return fs.readFileSync(LOGO_FILE, "utf8").replace(/<svg\b/i, '<svg opacity="' + SECURITY_OPACITY + '"');
}
const overlayCache = new Map();
async function overlayFor(width) {
  const markWidth = Math.max(1, Math.round(width * SECURITY_SIZE));
  if (!overlayCache.has(markWidth)) {
    overlayCache.set(markWidth, sharp(Buffer.from(logoSvg())).resize({ width: markWidth }).png().toBuffer());
  }
  return overlayCache.get(markWidth);
}
async function protectedVariant(input, width, format) {
  const overlay = await overlayFor(width);
  let pipe = sharp(input, { failOn: "none" }).rotate().resize({ width, withoutEnlargement: true })
    .composite([{ input: overlay, gravity: "centre" }]);
  return format === "webp"
    ? pipe.webp({ quality: 88, effort: 4 }).toBuffer()
    : pipe.jpeg({ quality: 90, progressive: true, chromaSubsampling: "4:2:0" }).toBuffer();
}
async function put(bucket, key, bytes, contentType) {
  const r = await fetch(SUPABASE_URL + "/storage/v1/object/" + bucket + "/" + objectPath(key), {
    method: "POST",
    headers: headers({ "Content-Type": contentType, "x-upsert": "true", "cache-control": "31536000" }),
    body: bytes
  });
  if (!r.ok) throw new Error("Upload " + bucket + "/" + key + " failed " + r.status + " " + (await r.text()).slice(0, 200));
}
async function removeTemp(key) {
  const r = await fetch(SUPABASE_URL + "/storage/v1/object/" + PUBLIC_BUCKET + "/" + objectPath(key), {
    method: "DELETE", headers: headers()
  });
  if (!r.ok && r.status !== 404) throw new Error("Temp delete failed " + r.status + " " + (await r.text()).slice(0, 160));
}

function extFor(type) {
  if (/png/i.test(type)) return "png";
  if (/webp/i.test(type)) return "webp";
  return "jpg";
}
function publicUrl(key) {
  return SUPABASE_URL + "/storage/v1/object/public/" + PUBLIC_BUCKET + "/" + objectPath(key);
}
async function processImage(slug, image, index) {
  const source = String(image && image.original || "");
  if (!source.includes("/" + PUBLIC_BUCKET + "/" + TEMP_PREFIX)) throw new Error("Unexpected staged source for " + slug + " image " + (index + 1));
  const r = await fetch(source, { headers: { Accept: "image/*" } });
  if (!r.ok) throw new Error("Source fetch failed " + r.status + " for " + slug + " image " + (index + 1));
  const type = r.headers.get("content-type") || "image/jpeg";
  const input = Buffer.from(await r.arrayBuffer());
  const n = String(index + 1).padStart(2, "0");
  const masterKey = FINAL_PREFIX + slug + "/" + n + "." + extFor(type);
  await put(PRIVATE_BUCKET, masterKey, input, type);

  const variants = {};
  for (const width of [400, 800, 1280]) {
    for (const format of ["jpg", "webp"]) {
      const key = FINAL_PREFIX + slug + "/" + n + "-" + width + "." + format;
      const bytes = await protectedVariant(input, width, format);
      await put(PUBLIC_BUCKET, key, bytes, format === "webp" ? "image/webp" : "image/jpeg");
      variants[format + width] = publicUrl(key);
    }
  }
  return {
    id: image.id || slug + "-owned-" + (index + 1),
    public_id: FINAL_PREFIX + slug + "/" + n,
    original: variants.jpg1280,
    source_original: image.source_original || "",
    master_path: masterKey,
    width: image.width || null,
    height: image.height || null,
    legacy: false,
    embedded_watermark: false,
    protected_variants: true,
    position: index,
    variants
  };
}

async function updateStage(slug, payload) {
  const r = await fetch(SUPABASE_URL + "/rest/v1/autohaus_migration_stage?slug=eq." + encodeURIComponent(slug), {
    method: "PATCH",
    headers: headers({ "Content-Type": "application/json", Prefer: "return=minimal" }),
    body: JSON.stringify({ payload, created_at: new Date().toISOString() })
  });
  if (!r.ok) throw new Error("Stage update failed " + r.status + " " + (await r.text()).slice(0, 240));
}

async function processRow(row) {
  const payload = row && row.payload;
  const slug = row && row.slug;
  if (!payload || !slug || !Array.isArray(payload.images) || !payload.images.length) throw new Error("Invalid staging row");
  const nextImages = new Array(payload.images.length);
  let cursor = 0;
  async function worker() {
    while (cursor < payload.images.length) {
      const i = cursor++;
      nextImages[i] = await processImage(slug, payload.images[i], i);
    }
  }
  await Promise.all([worker(), worker()]);
  const nextPayload = Object.assign({}, payload, { images: nextImages });
  await updateStage(slug, nextPayload);
  await Promise.all(payload.images.map(function (image) {
    const source = String(image && image.original || "");
    const marker = "/storage/v1/object/public/" + PUBLIC_BUCKET + "/";
    const p = source.indexOf(marker);
    if (p < 0) return Promise.resolve();
    return removeTemp(decodeURIComponent(source.slice(p + marker.length)));
  }));
  console.log("  finalized " + slug + " (" + nextImages.length + " images)");
}

async function run() {
  if (!fs.existsSync(LOGO_FILE)) throw new Error("AutoHaus watermark asset missing");
  const rows = await fetchJson(SUPABASE_URL + "/rest/v1/autohaus_migration_stage?select=slug,payload&order=slug.asc");
  if (!Array.isArray(rows) || rows.length < 20) throw new Error("Unexpected staging inventory size");
  console.log("AutoHaus owned media finalization: " + rows.length + " vehicles");
  for (const row of rows) await processRow(row);
  console.log("AutoHaus owned media finalization complete");
}

run().catch(function (error) {
  console.error(error && error.stack || error);
  process.exitCode = 1;
});
