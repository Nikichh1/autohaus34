"use strict";

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const SUPABASE = "https://ajoiqomflplhadyhxvfe.supabase.co";
const ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqb2lxb21mbHBsaGFkeWh4dmZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwNDIxNjcsImV4cCI6MjEwNDYxODE2N30.B0izdPcH05zWrAvvYXuOGieTkIL7r_UhTrbTVXDAShQ";
const MASTER_BUCKET = "vehicle-originals";
const PUBLIC_BUCKET = "vehicle-images";
const OUTPUT_PREFIX = "owned-hires-v1";
const WIDTH = 1920;
const WATERMARK_WIDTH = 0.13;
const WATERMARK_OPACITY = 0.25;
const CONCURRENCY = 3;
const LOGO = path.resolve(__dirname, "..", "autohaus.svg");

function headers(extra) {
  return Object.assign({
    apikey: ANON,
    authorization: "Bearer " + ANON
  }, extra || {});
}
function enc(pathname) {
  return String(pathname).split("/").map(encodeURIComponent).join("/");
}
function watermarkSvg() {
  return fs.readFileSync(LOGO, "utf8").replace(/<svg\b/i, '<svg opacity="' + WATERMARK_OPACITY + '"');
}
const overlayCache = new Map();
async function overlay(width) {
  const markWidth = Math.max(1, Math.round(width * WATERMARK_WIDTH));
  if (!overlayCache.has(markWidth)) {
    overlayCache.set(markWidth, sharp(Buffer.from(watermarkSvg())).resize({ width: markWidth }).png().toBuffer());
  }
  return overlayCache.get(markWidth);
}
async function rows() {
  const r = await fetch(SUPABASE + "/rest/v1/vehicles?published=eq.true&select=slug,images&order=sort_order.asc", {
    headers: headers({ accept: "application/json" })
  });
  if (!r.ok) throw new Error("Vehicle read failed " + r.status + ": " + (await r.text()).slice(0, 300));
  const data = await r.json();
  if (!Array.isArray(data) || data.length !== 77) throw new Error("Expected 77 vehicles, got " + (data && data.length));
  return data;
}
async function master(pathname) {
  const r = await fetch(SUPABASE + "/storage/v1/object/" + MASTER_BUCKET + "/" + enc(pathname), {
    headers: headers({ accept: "image/*" })
  });
  if (!r.ok) throw new Error("Master read failed " + r.status + " for " + pathname + ": " + (await r.text()).slice(0, 200));
  return Buffer.from(await r.arrayBuffer());
}
async function upload(pathname, bytes, type) {
  const r = await fetch(SUPABASE + "/storage/v1/object/" + PUBLIC_BUCKET + "/" + enc(pathname), {
    method: "POST",
    headers: headers({
      "content-type": type,
      "x-upsert": "true",
      "cache-control": "31536000, immutable"
    }),
    body: bytes
  });
  if (!r.ok) throw new Error("Upload failed " + r.status + " for " + pathname + ": " + (await r.text()).slice(0, 240));
}
async function build(job) {
  const input = await master(job.masterPath);
  const meta = await sharp(input, { failOn: "none" }).rotate().metadata();
  if (!meta.width || !meta.height) throw new Error("No dimensions for " + job.masterPath);
  const targetWidth = Math.min(WIDTH, meta.width);
  const mark = await overlay(targetWidth);

  const jpg = await sharp(input, { failOn: "none" }).rotate()
    .resize({ width: WIDTH, withoutEnlargement: true, kernel: sharp.kernel.lanczos3 })
    .composite([{ input: mark, gravity: "centre" }])
    .jpeg({ quality: 95, progressive: true, mozjpeg: true, chromaSubsampling: "4:4:4" })
    .toBuffer();

  const webp = await sharp(input, { failOn: "none" }).rotate()
    .resize({ width: WIDTH, withoutEnlargement: true, kernel: sharp.kernel.lanczos3 })
    .composite([{ input: mark, gravity: "centre" }])
    .webp({ quality: 94, effort: 5, smartSubsample: true })
    .toBuffer();

  const base = OUTPUT_PREFIX + "/" + job.slug + "/" + String(job.index + 1).padStart(2, "0") + "-1920";
  await Promise.all([
    upload(base + ".jpg", jpg, "image/jpeg"),
    upload(base + ".webp", webp, "image/webp")
  ]);
}
async function run() {
  if (!fs.existsSync(LOGO)) throw new Error("autohaus.svg missing");
  const vehicles = await rows();
  const jobs = [];
  vehicles.forEach(row => {
    const images = Array.isArray(row.images) ? row.images : [];
    images.forEach((image, index) => {
      const masterPath = image && image.master_path;
      if (!masterPath || !String(masterPath).startsWith("owned-v1/")) {
        throw new Error("Missing private master for " + row.slug + " #" + (index + 1));
      }
      jobs.push({ slug: row.slug, index, masterPath });
    });
  });
  if (jobs.length !== 582) throw new Error("Expected 582 master images, got " + jobs.length);

  console.log("Generating " + jobs.length + " high-resolution protected masters -> 1164 variants");
  let cursor = 0, done = 0;
  async function worker() {
    while (cursor < jobs.length) {
      const job = jobs[cursor++];
      await build(job);
      done++;
      if (done % 20 === 0 || done === jobs.length) console.log("  generated " + done + "/" + jobs.length);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log("High-resolution protected variant generation complete");
}
run().catch(err => {
  console.error(err && (err.stack || err.message) || err);
  process.exitCode = 1;
});
