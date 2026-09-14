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
  // Cards need the cover only. The full gallery belongs to the detail endpoint.
  delete v.managed_images;
  delete v.description_bg;
  delete v.description_en;
  delete v.equipment_bg;
  delete v.equipment_en;
  delete v.notes;
  return v;
}

function send(req, res, status, body, ttl) {
  const raw = JSON.stringify(body);
  const etag = '"' + crypto.createHash("sha1").update(raw).digest("base64url") + '"';
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("ETag", etag);
  res.setHeader("Cache-Control", ttl ? "public, max-age=30, s-maxage=" + ttl + ", stale-while-revalidate=600" : "no-store");
  if (req.headers && req.headers["if-none-match"] === etag) { res.statusCode = 304; return res.end(); }
  res.statusCode = status;
  res.end(raw);
}

function cached(req, res, key) {
  const hit = memory.get(key);
  if (!hit || hit.expires < Date.now()) return false;
  send(req, res, 200, hit.body, hit.ttl);
  return true;
}

function remember(key, body, ttl) {
  memory.set(key, { body, ttl, expires: Date.now() + ttl * 1000 });
  return body;
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return json(res, 405, { ok: false, error: "Method not allowed" });
  if (!configured()) return json(res, 200, { ok: true, authoritative: false, vehicles: [] });

  const id = clean((req.query && req.query.id) || "", 180);
  if (id && !/^[a-z0-9-]+$/.test(id)) return json(res, 400, { ok: false, error: "Invalid vehicle ID" });
  const cacheKey = id || "catalog";
  if (cached(req, res, cacheKey)) return;

  try {
    if (id) {
      const r = await db("vehicles?published=eq.true&slug=eq." + encodeURIComponent(id) + "&select=id,slug,ref,make,model,full_name,body_type,colour,transmission,fuel,mileage,first_registration_year,first_registration_month,unregistered,horsepower,price,chapter,tags,notes,description_bg,description_en,equipment_bg,equipment_en,images,source_url,published,sort_order,updated_at&limit=1", { method: "GET" });
      const rows = await parse(r);
      if (!rows.length) return json(res, 404, { ok: false, error: "Vehicle not found" });
      const body = remember(cacheKey, { ok: true, authoritative: true, vehicle: publicVehicle(rows[0]) }, 120);
      return send(req, res, 200, body, 120);
    }

    const fields = [
      "id", "slug", "ref", "make", "model", "full_name", "body_type", "colour",
      "transmission", "fuel", "mileage", "first_registration_year", "first_registration_month",
      "unregistered", "horsepower", "price", "chapter", "tags", "cover:images->0", "source_url", "sort_order"
    ].join(",");
    const r = await db("vehicles?published=eq.true&select=" + fields + "&order=sort_order.asc,updated_at.desc", { method: "GET" });
    const rows = await parse(r);
    if (!rows.length) {
      const stateResponse = await db("inventory_state?select=initialized&singleton=eq.true", { method: "GET" });
      const state = await parse(stateResponse);
      if (!state.length || !state[0].initialized) return json(res, 200, { ok: true, authoritative: false, vehicles: [] });
    }
    const vehicles = rows.map((row) => compactVehicle(Object.assign({}, row, { images: row.cover ? [row.cover] : [] })));
    const body = remember(cacheKey, { ok: true, authoritative: true, count: vehicles.length, vehicles }, 60);
    return send(req, res, 200, body, 60);
  } catch (err) {
    console.error("Public inventory API failed", err);
    const stale = memory.get(cacheKey);
    if (stale) return send(req, res, 200, stale.body, 30);
    return json(res, 200, { ok: true, authoritative: false, vehicles: [] });
  }
};
