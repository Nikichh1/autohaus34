"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const sharp = require("sharp");

const ROOT = path.resolve(__dirname, "..");
const DIST = path.join(ROOT, "dist");
const VEHICLE_DIR = path.join(DIST, "img", "v");
const LOGO_FILE = path.join(ROOT, "autohaus.svg");
const SUPABASE_URL = "https://ajoiqomflplhadyhxvfe.supabase.co";
const SUPABASE_KEY = "sb_publishable_gBEUBrOjT_JsBRjAnGL9PQ_ra-1hY0g";

/* This is deliberately weaker than the visible configurable watermark.
   It exists only so the underlying downloadable bytes are never pristine.
   The normal CSS watermark can still change instantly without rebuilding. */
const SECURITY_OPACITY = 0.07;
const SECURITY_SIZE = 0.13;
const CONCURRENCY = 6;

function protectedKey(publicId) {
  return crypto.createHash("sha1").update(String(publicId || "")).digest("hex").slice(0, 20);
}

function listVehicleVariants(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "protected") out.push(...listVehicleVariants(full));
      continue;
    }
    if (/-(?:400|800|1280)\.(?:jpe?g|webp)$/i.test(entry.name)) out.push(full);
  }
  return out;
}

function opacityLogoSvg() {
  const svg = fs.readFileSync(LOGO_FILE, "utf8");
  return svg.replace(/<svg\b/i, '<svg opacity="' + SECURITY_OPACITY + '"');
}

const overlayCache = new Map();
async function overlayFor(width) {
  const markWidth = Math.max(1, Math.round(width * SECURITY_SIZE));
  if (!overlayCache.has(markWidth)) {
    overlayCache.set(markWidth, sharp(Buffer.from(opacityLogoSvg()))
      .resize({ width: markWidth, withoutEnlargement: false })
      .png()
      .toBuffer());
  }
  return overlayCache.get(markWidth);
}

async function protectBuffer(input, format, width) {
  const sourceMetadata = await sharp(input, { failOn: "none" }).metadata();
  let pipeline = sharp(input, { failOn: "none" }).rotate();
  if (width) pipeline = pipeline.resize({ width, withoutEnlargement: true });
  const actualWidth = width || Number(sourceMetadata.width) || 1280;
  const overlay = await overlayFor(actualWidth);
  pipeline = pipeline.composite([{ input: overlay, gravity: "centre" }]);
  if (format === "webp") return pipeline.webp({ quality: 88, effort: 4 }).toBuffer();
  return pipeline.jpeg({ quality: 90, progressive: true, chromaSubsampling: "4:2:0" }).toBuffer();
}

async function protectFile(file) {
  const ext = path.extname(file).toLowerCase();
  const format = ext === ".webp" ? "webp" : "jpg";
  const source = await fs.promises.readFile(file);
  const protectedBytes = await protectBuffer(source, format);
  const tmp = file + ".ah-protect-" + process.pid + ext;
  await fs.promises.writeFile(tmp, protectedBytes);
  await fs.promises.rename(tmp, file);
}

async function mapLimit(items, limit, worker) {
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor++;
      await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length || 1) }, run));
}

async function protectLegacyFiles() {
  const files = listVehicleVariants(VEHICLE_DIR);
  await mapLimit(files, CONCURRENCY, protectFile);
  return files.length;
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { apikey: SUPABASE_KEY, Accept: "application/json" }
  });
  if (!response.ok) throw new Error("Managed image protection query failed: " + response.status);
  return response.json();
}

async function fetchBytes(url) {
  const response = await fetch(url, { headers: { Accept: "image/*" } });
  if (!response.ok) throw new Error("Managed image download failed: " + response.status);
  return Buffer.from(await response.arrayBuffer());
}

async function protectExistingManagedFiles() {
  const rows = await fetchJson(
    SUPABASE_URL + "/rest/v1/vehicles?select=images&published=eq.true"
  );
  const pending = [];
  (Array.isArray(rows) ? rows : []).forEach(function (row) {
    (Array.isArray(row.images) ? row.images : []).forEach(function (image) {
      /* owned-v1 variants are already pixel-watermarked and backed by a
         private master. Reprocessing them would only waste build time and
         double-encode the image. */
      if (!image || image.legacy === true || image.embedded_watermark === true ||
          image.protected_variants === true || !image.public_id) return;
      const variants = image.variants || {};
      const source = variants.jpg1280 || variants.jpg800 || image.original;
      if (!source) return;
      pending.push({ publicId: image.public_id, source });
    });
  });

  const targetDir = path.join(VEHICLE_DIR, "protected");
  fs.mkdirSync(targetDir, { recursive: true });

  await mapLimit(pending, 2, async function (item) {
    const input = await fetchBytes(item.source);
    const key = protectedKey(item.publicId);
    for (const width of [400, 800, 1280]) {
      for (const format of ["jpg", "webp"]) {
        const bytes = await protectBuffer(input, format, width);
        await fs.promises.writeFile(path.join(targetDir, "managed-" + key + "-" + width + "." + format), bytes);
      }
    }
  });
  return pending.length;
}

async function run() {
  if (!fs.existsSync(VEHICLE_DIR) || !fs.existsSync(LOGO_FILE)) {
    throw new Error("Vehicle image protection inputs are missing");
  }
  /* The live inventory is now fully owned media. Legacy repo images are no
     longer a runtime dependency, so do not re-encode hundreds of archived
     files on every deployment. Only protect any future pre-migration managed
     upload that somehow lacks embedded/protected variants. */
  const managed = await protectExistingManagedFiles();
  console.log("  Product image protection check: " + managed + " unprotected managed source(s) processed");
}

run().catch(function (error) {
  console.error(error);
  process.exitCode = 1;
});
