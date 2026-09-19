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
