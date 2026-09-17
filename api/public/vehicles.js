"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { configured, json, db, legacyVehicle, clean } = require("../../server/admin-lib");

function bundledPhotoSet() {
  try {
    const source = fs.readFileSync(path.join(__dirname, "../../data/photos.js"), "utf8");
    const start = source.indexOf("[");
    const end = source.lastIndexOf("]");
    return new Set(JSON.parse(source.slice(start, end + 1)));
  } catch (_) {
    return new Set();
  }
}

const LOCAL_PHOTOS = bundledPhotoSet();
const memory = new Map();
const pending = new Map();
const encoded = new WeakMap();
const FRESH_MS = 30000;
const MAX_ENTRIES = 250;
let requestOrder = 0;

async function parse(r) {
  const t = await r.text();
  if (!r.ok) throw new Error("Inventory response unavailable");
  const parsed = JSON.parse(t);
  if (!Array.isArray(parsed)) throw new Error("Invalid inventory response");
  return parsed;
}

function publicVehicle(row) {
  const v = legacyVehicle(row);
  v.local_shots = (v.managed_images || []).filter((image) => LOCAL_PHOTOS.has(image.original)).map((image) => image.original);
  return v;
}

function compactVehicle(row) {
  const v = publicVehicle(row);
  v.managed_images = (v.managed_images || []).map((image) => ({
    original: image.original, variants: image.variants
  }));
  delete v.description_bg;
  delete v.description_en;
  delete v.equipment_bg;
  delete v.equipment_en;
  delete v.notes;
  return v;
}

function send(req, res, status, body) {
  let representation = encoded.get(body);
  if (!representation) {
    const raw = JSON.stringify(body);
    representation = { raw, etag: '"' + crypto.createHash("sha1").update(raw).digest("base64url") + '"' };
    encoded.set(body, representation);
  }
  const { raw, etag } = representation;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("ETag", etag);
  const remaining = Math.max(0, Math.floor((Number(body.fresh_until) - Date.now()) / 1000));
  res.setHeader("Cache-Control", remaining ? "public, max-age=" + remaining + ", s-maxage=" + remaining + ", must-revalidate" : "no-store");
  if (req.headers && req.headers["if-none-match"] === etag) { res.statusCode = 304; return res.end(); }
  res.statusCode = status;
  res.end(raw);
}

function cached(req, res, key) {
  const hit = memory.get(key);
  if (!hit) return false;
  if (hit.body.fresh_until <= Date.now()) { memory.delete(key); return false; }
  send(req, res, hit.status, hit.body);
  return true;
}

function remember(key, body, started, order, status = 200) {
  body.fresh_until = started + FRESH_MS;
  const previous = memory.get(key);
  if (!previous || previous.order < order) {
    memory.delete(key);
    memory.set(key, { body, order, status });
  }
  while (memory.size > MAX_ENTRIES) memory.delete(memory.keys().next().value);
  return body;
}

async function publicSettings() {
  const response = await db("admin_settings?singleton=eq.true&select=watermark_enabled,watermark_transparency,watermark_size&limit=1", { method: "GET" });
  const rows = await parse(response);
  const row = rows[0] || {};
  const transparency = Number(row.watermark_transparency);
  const size = Number(row.watermark_size);
  return {
    watermark_enabled: row.watermark_enabled === true,
    watermark_transparency: Number.isFinite(transparency) ? Math.max(0, Math.min(100, Math.round(transparency))) : 75,
    watermark_size: Number.isFinite(size) ? Math.max(10, Math.min(60, Math.round(size))) : 34
  };
}

async function inventory(id, cacheKey) {
  const started = Date.now();
  const order = ++requestOrder;
  if (id) {
    const r = await db("vehicles?published=eq.true&slug=eq." + encodeURIComponent(id) + "&select=id,slug,ref,make,model,full_name,body_type,colour,transmission,fuel,mileage,first_registration_year,first_registration_month,unregistered,horsepower,price,chapter,tags,notes,description_bg,description_en,equipment_bg,equipment_en,images,source_url,published,sort_order,updated_at&limit=1", { method: "GET" });
    const rows = await parse(r);
    if (!rows.length) {
      return { status: 404, body: remember(cacheKey, { ok: false, authoritative: true, vehicle: null, vehicles: [], error: "Vehicle not found" }, started, order, 404) };
    }
    return { status: 200, body: remember(cacheKey, { ok: true, authoritative: true, vehicle: publicVehicle(rows[0]) }, started, order) };
  }

  const fields = [
    "id", "slug", "ref", "make", "model", "full_name", "body_type", "colour",
    "transmission", "fuel", "mileage", "first_registration_year", "first_registration_month",
    "unregistered", "horsepower", "price", "chapter", "tags", "cover:images->0", "source_url", "sort_order", "updated_at"
  ].join(",");
  const r = await db("vehicles?published=eq.true&select=" + fields + "&order=updated_at.desc,sort_order.asc", { method: "GET" });
  const rows = await parse(r);
  if (!rows.length) {
    const stateResponse = await db("inventory_state?select=initialized&singleton=eq.true", { method: "GET" });
    const state = await parse(stateResponse);
    if (!state.length || !state[0].initialized) return { status: 200, body: { ok: true, authoritative: false, vehicles: [] } };
  }
  const vehicles = rows.map((row) => compactVehicle(Object.assign({}, row, { images: row.cover ? [row.cover] : [] })));
  return { status: 200, body: remember(cacheKey, { ok: true, authoritative: true, count: vehicles.length, vehicles }, started, order) };
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return json(res, 405, { ok: false, error: "Method not allowed" });
  if (!configured()) return json(res, 200, { ok: true, authoritative: false, vehicles: [] });

  const settingsOnly = clean((req.query && req.query.settings) || "", 8) === "1";
  if (settingsOnly) {
    res.setHeader("Cache-Control", "no-store, max-age=0");
    try {
      return json(res, 200, { ok: true, settings: await publicSettings() });
    } catch (err) {
      console.error("Public settings API failed", err);
      return json(res, 200, { ok: true, settings: { watermark_enabled: false, watermark_transparency: 75, watermark_size: 34 } });
    }
  }

  const id = clean((req.query && req.query.id) || "", 180);
  if (id && !/^[a-z0-9-]+$/.test(id)) return json(res, 400, { ok: false, error: "Invalid vehicle ID" });
  const cacheKey = id ? "vehicle:" + id : "catalog";
  const fresh = clean((req.query && req.query.fresh) || "", 20);
  const refresh = /^\d{13}$/.test(fresh);
  if (!refresh && cached(req, res, cacheKey)) return;
  const requestKey = cacheKey + (refresh ? ":" + fresh : "");

  try {
    if (!pending.has(requestKey)) {
      const request = inventory(id, cacheKey).finally(() => pending.delete(requestKey));
      pending.set(requestKey, request);
    }
    const result = await pending.get(requestKey);
    return send(req, res, result.status, result.body);
  } catch (err) {
    console.error("Public inventory API failed", err);
    return json(res, 200, { ok: true, authoritative: false, vehicles: [] });
  }
};
