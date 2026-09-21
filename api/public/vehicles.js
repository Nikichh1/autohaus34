"use strict";

const crypto = require("crypto");
const { configured, json, db, legacyVehicle, clean } = require("../../server/admin-lib");

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

function protectedManagedVariants(publicId) {
  const key = crypto.createHash("sha1").update(String(publicId || "")).digest("hex").slice(0, 20);
  const base = "/img/v/protected/managed-" + key + "-";
  return {
    jpg400: base + "400.jpg",
    jpg800: base + "800.jpg",
    jpg1280: base + "1280.jpg",
    webp400: base + "400.webp",
    webp800: base + "800.webp",
    webp1280: base + "1280.webp"
  };
}

function publicVehicle(row) {
  const v = legacyVehicle(row);
  v.notes_en = Array.isArray(row.notes_en) ? row.notes_en : [];
  const sourceImages = v.managed_images || [];

  /* Public inventory serves only project-owned/protected derivatives. */
  const publicVariants = sourceImages.map((image) => {
    if (!image) return {};
    /* owned-v1 media was migrated into our private masters + six protected
       public derivatives. Use those CDN URLs directly; never remap them to
       the temporary/local managed-image compatibility path. */
    if (image.protected_variants === true && image.variants && Object.keys(image.variants).length) {
      return image.variants;
    }
    if (image.legacy === true) return image.variants || {};
    if (image.embedded_watermark !== true && image.public_id) return protectedManagedVariants(image.public_id);
    return image.variants || {};
  });

  v.shots = sourceImages.map((image, index) => {
    const variants = publicVariants[index] || {};
    return variants.jpg1280 || variants.jpg800 || variants.jpg400 || "";
  }).filter(Boolean);

  v.local_shots = [];

  /* Never expose upload originals, storage object IDs or acquisition/source
     URLs to the public inventory endpoint. */
  v.managed_images = sourceImages.map((image, index) => ({
    width: image.width || null,
    height: image.height || null,
    legacy: image.legacy === true,
    embedded_watermark: image.embedded_watermark === true,
    variants: publicVariants[index] || {}
  }));
  delete v.src;
  return v;
}

function compactVehicle(row) {
  const v = publicVehicle(row);
  v.managed_images = (v.managed_images || []).map((image) => ({
    legacy: image.legacy === true,
    embedded_watermark: image.embedded_watermark === true,
    variants: image.variants || {}
  }));
  delete v.description_bg;
  delete v.description_en;
  delete v.equipment_bg;
  delete v.equipment_en;
  delete v.notes;
  delete v.notes_en;
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
  res.setHeader("Cache-Control", remaining
    ? "public, max-age=" + remaining + ", s-maxage=" + remaining + ", must-revalidate"
    : "no-store");
  if (req.headers && req.headers["if-none-match"] === etag) { res.statusCode = 304; return res.end(); }
  res.statusCode = status;
  res.end(raw);
}

function canForceRefresh(req) {
  const site = String(req.headers && req.headers["sec-fetch-site"] || "");
  if (site && site !== "same-origin") return false;
  const referer = String(req.headers && req.headers.referer || "");
  if (!referer) return false;
  try {
    const ref = new URL(referer);
    return ref.host === String(req.headers.host || "");
  } catch (_) {
    return false;
  }
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
  const response = await db("admin_settings?singleton=eq.true&select=watermark_enabled,watermark_transparency,watermark_size,photo_aspect_ratio,photo_filter,photo_filter_strength,desktop_gallery_scale,scroll_header_style,landing_standard_header,landing_standard_header_sticky,landing_original_after_scroll,product_standard_header,product_standard_header_sticky,product_original_header,landing_standard_header_mode,landing_original_header_mode,product_standard_header_mode,product_original_header_mode,original_header_size,original_header_opacity,original_header_language,original_header_desktop_menu_label&limit=1", { method: "GET" });
  const rows = await parse(response);
  const row = rows[0] || {};
  const transparency = Number(row.watermark_transparency);
  const size = Number(row.watermark_size);
  const strength = Number(row.photo_filter_strength);
  const galleryScale = Number(row.desktop_gallery_scale);
  const scrollHeaderStyle = row.scroll_header_style === "autohaus_original" ? "autohaus_original" : "compact";
  const landingStandardMode = ["hidden","top","sticky"].includes(row.landing_standard_header_mode) ? row.landing_standard_header_mode :
    (row.landing_standard_header === false ? "hidden" : row.landing_standard_header_sticky === true ? "sticky" : "top");
  const landingOriginalMode = ["hidden","always","after_scroll"].includes(row.landing_original_header_mode) ? row.landing_original_header_mode :
    (row.landing_original_after_scroll === false ? "hidden" : "after_scroll");
  const productStandardMode = ["hidden","top","sticky"].includes(row.product_standard_header_mode) ? row.product_standard_header_mode :
    (row.product_standard_header === false ? "hidden" : row.product_standard_header_sticky === false ? "top" : "sticky");
  const productOriginalMode = ["hidden","always","after_scroll"].includes(row.product_original_header_mode) ? row.product_original_header_mode :
    (row.product_original_header === true ? "always" : "hidden");
  const originalHeaderSize = Number(row.original_header_size);
  const originalHeaderOpacity = Number(row.original_header_opacity);
  return {
    watermark_enabled: row.watermark_enabled === true,
    watermark_transparency: Number.isFinite(transparency) ? Math.max(0, Math.min(100, Math.round(transparency))) : 75,
    watermark_size: Number.isFinite(size) ? Math.max(10, Math.min(60, Math.round(size))) : 34,
    photo_aspect_ratio: row.photo_aspect_ratio === "16:10" ? "16:10" : "16:9",
    photo_filter: ["none", "balanced", "showroom"].includes(row.photo_filter) ? row.photo_filter : "none",
    photo_filter_strength: Number.isFinite(strength) ? Math.max(0, Math.min(100, Math.round(strength))) : 35,
    desktop_gallery_scale: Number.isFinite(galleryScale) ? Math.max(70, Math.min(100, Math.round(galleryScale))) : 84,
    scroll_header_style: scrollHeaderStyle,
    landing_standard_header: row.landing_standard_header !== false,
    landing_standard_header_sticky: row.landing_standard_header_sticky === true,
    landing_original_after_scroll: row.landing_original_after_scroll !== false,
    product_standard_header: row.product_standard_header !== false,
    product_standard_header_sticky: row.product_standard_header_sticky !== false,
    product_original_header: row.product_original_header === true,
    landing_standard_header_mode: landingStandardMode,
    landing_original_header_mode: landingOriginalMode,
    product_standard_header_mode: productStandardMode,
    product_original_header_mode: productOriginalMode,
    original_header_size: Number.isFinite(originalHeaderSize) ? Math.max(65, Math.min(100, Math.round(originalHeaderSize))) : 81,
    original_header_opacity: Number.isFinite(originalHeaderOpacity) ? Math.max(85, Math.min(100, Math.round(originalHeaderOpacity))) : 98,
    original_header_language: row.original_header_language === "header" ? "header" : "menu",
    original_header_desktop_menu_label: row.original_header_desktop_menu_label !== false
  };
}

async function inventory(id, cacheKey) {
  const started = Date.now();
  const order = ++requestOrder;
  if (id) {
    const r = await db("vehicles?published=eq.true&slug=eq." + encodeURIComponent(id) + "&select=id,slug,ref,make,model,full_name,body_type,colour,transmission,fuel,mileage,first_registration_year,first_registration_month,unregistered,horsepower,price,chapter,tags,notes,notes_en,description_bg,description_en,equipment_bg,equipment_en,images,published,sort_order,updated_at&limit=1", { method: "GET" });
    const rows = await parse(r);
    if (!rows.length) {
      return { status: 404, body: remember(cacheKey, { ok: false, authoritative: true, vehicle: null, vehicles: [], error: "Vehicle not found" }, started, order, 404) };
    }
    return { status: 200, body: remember(cacheKey, { ok: true, authoritative: true, vehicle: publicVehicle(rows[0]) }, started, order) };
  }

  const fields = [
    "id", "slug", "ref", "make", "model", "full_name", "body_type", "colour",
    "transmission", "fuel", "mileage", "first_registration_year", "first_registration_month",
    "unregistered", "horsepower", "price", "chapter", "tags", "cover:images->0", "sort_order", "updated_at"
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
      return json(res, 200, { ok: true, settings: { watermark_enabled: false, watermark_transparency: 75, watermark_size: 34, photo_aspect_ratio: "16:9", photo_filter: "none", photo_filter_strength: 35, desktop_gallery_scale: 84, scroll_header_style: "compact", landing_standard_header: true, landing_standard_header_sticky: false, landing_original_after_scroll: true, product_standard_header: true, product_standard_header_sticky: true, product_original_header: false, landing_standard_header_mode: "top", landing_original_header_mode: "after_scroll", product_standard_header_mode: "sticky", product_original_header_mode: "hidden", original_header_size: 81, original_header_opacity: 98, original_header_language: "menu", original_header_desktop_menu_label: true } });
    }
  }

  const id = clean((req.query && req.query.id) || "", 180);
  if (id && !/^[a-z0-9-]+$/.test(id)) return json(res, 400, { ok: false, error: "Invalid vehicle ID" });
  const cacheKey = id ? "vehicle:" + id : "catalog";
  const fresh = clean((req.query && req.query.fresh) || "", 20);
  const refresh = /^\d{13}$/.test(fresh) && canForceRefresh(req);
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
