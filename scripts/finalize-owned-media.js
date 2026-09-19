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
