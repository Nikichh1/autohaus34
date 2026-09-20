"use strict";

const fs = require("fs");
const path = require("path");
const {
  json, clean, requireAdmin, requireSameOrigin, databaseFor, normalizeVehicle, legacyVehicle
} = require("../../server/admin-lib");

function apiError(res, status, message, detail) {
  if (detail && detail.code === "23505") return json(res, 409, { ok: false, error: "This vehicle URL is already in use. Choose a different URL.", code: "DUPLICATE_SLUG" });
  return json(res, status >= 500 ? 503 : status, { ok: false, error: message });
}

async function readJson(r) {
  const text = await r.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch (_) { return text; }
}

function staticVariants(url) {
  const match = String(url).match(/^https?:\/\/(?:www\.)?autohaus\.bg\/wp-content\/uploads\/(\d{4})\/(\d{2})\/([^/]+?)(?:-\d+x\d+)?\.(?:jpe?g|png)$/i);
  if (!match || !/^[a-z0-9_-]+$/i.test(match[3])) throw new Error("Invalid canonical photo");
  const key = "/img/v/" + match[1] + "-" + match[2] + "_" + match[3];
  const variants = {};
  for (const format of ["jpg", "webp"]) for (const width of [400, 800, 1280]) variants[format + width] = key + "-" + width + "." + format;
  return variants;
}

function translatedNotes(value, expected) {
  if (value == null) return null;
  if (!Array.isArray(value) || value.length > 80 || value.some((line) => typeof line !== "string" || line.length > 2000)) {
    return { error: "Invalid or oversized notes_en." };
  }
  const lines = value.map((line) => clean(line, 2000)).filter(Boolean);
  if (lines.length && lines.length !== expected) return { error: "Bulgarian and English notes must have the same number of lines." };
  return { lines };
}

function normalizeWithTranslations(source) {
  const normalized = normalizeVehicle(source);
  if (normalized.error) return normalized;
  const translated = translatedNotes(source && source.notes_en, normalized.row.notes.length);
  if (translated && translated.error) return translated;
  if (translated) normalized.row.notes_en = translated.lines;
  return normalized;
}

function isFullVehicleUpdate(body) {
  return body && typeof body === "object" &&
    typeof body.make === "string" && typeof body.model === "string" &&
    Array.isArray(body.images) && Array.isArray(body.notes) &&
    Array.isArray(body.equipment_bg) && Array.isArray(body.equipment_en) &&
    Object.prototype.hasOwnProperty.call(body, "fuel") &&
    Object.prototype.hasOwnProperty.call(body, "transmission");
}

function legacyToRow(v, index, equipment) {
  const normalized = normalizeVehicle({
    slug: v.id,
    ref: v.ref,
    make: v.make,
    model: v.model,
    full_name: v.full,
    body_type: v.body_type || "",
    colour: v.colour,
    transmission: v.gear,
    fuel: v.fuel,
    mileage: v.km,
    first_registration_year: v.year,
    first_registration_month: v.month,
    unregistered: !!v.unreg,
    horsepower: v.hp,
    price: v.price,
    chapter: v.chapter === "guard" ? "chauffeur" : v.chapter,
    tags: v.tags,
    notes: v.notes,
    equipment_bg: equipment && equipment.e || [],
    equipment_en: equipment && equipment.en || [],
    images: (v.shots || []).map((url, i) => ({
      id: "legacy-" + v.id + "-" + i,
      legacy: true,
      original: String(url).replace(/^http:\/\/(www\.)?autohaus\.bg\//i, "https://autohaus.bg/"),
      position: i,
      variants: staticVariants(url)
    })),
    source_url: v.src,
    published: true
  });
  if (normalized.error) throw new Error("Invalid canonical vehicle " + v.id + ": " + normalized.error);
  normalized.row.sort_order = Number(index || 0) + 1;
  return normalized.row;
}

function readAssignment(file, variable) {
  const source = fs.readFileSync(file, "utf8");
  const match = source.match(new RegExp("window\\." + variable + "\\s*=\\s*([\\s\\S]+?);?\\s*$"));
  if (!match) throw new Error("Invalid inventory source: " + path.basename(file));
  return JSON.parse(match[1]);
}

function initialInventory() {
  const root = path.join(__dirname, "../../data");
  const source = JSON.parse(fs.readFileSync(path.join(root, "inventory.snapshot.json"), "utf8"));
  const count = JSON.parse(fs.readFileSync(path.join(root, "inventory-manifest.json"), "utf8")).count;
  if (!count || source.length !== count || new Set(source.map((v) => v.id)).size !== count) throw new Error("Canonical inventory does not match its verified manifest");
  return source.map((vehicle, index) => {
    if (!/^[a-z0-9-]+$/.test(vehicle.id)) throw new Error("Invalid canonical vehicle URL");
    const equipmentPath = path.join(root, "eq", vehicle.id + ".js");
    const equipment = fs.existsSync(equipmentPath) ? readAssignment(equipmentPath, "AH_EQ") : null;
    if (equipment && equipment.id !== vehicle.id) throw new Error("Equipment vehicle mismatch");
    return legacyToRow(vehicle, index, equipment);
  });
}

function normalizedSettings(row) {
  row = row || {};
  const transparency = Number(row.watermark_transparency);
  const size = Number(row.watermark_size);
  const ratio = row.photo_aspect_ratio === "16:10" ? "16:10" : "16:9";
  const filter = ["none", "balanced", "showroom"].includes(row.photo_filter) ? row.photo_filter : "none";
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
    photo_aspect_ratio: ratio,
    photo_filter: filter,
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

async function settingsAction(req, res, db) {
  if (req.method === "GET") {
    const response = await db("admin_settings?singleton=eq.true&select=watermark_enabled,watermark_transparency,watermark_size,photo_aspect_ratio,photo_filter,photo_filter_strength,desktop_gallery_scale,scroll_header_style,landing_standard_header,landing_standard_header_sticky,landing_original_after_scroll,product_standard_header,product_standard_header_sticky,product_original_header,landing_standard_header_mode,landing_original_header_mode,product_standard_header_mode,product_original_header_mode,original_header_size,original_header_opacity,original_header_language,original_header_desktop_menu_label&limit=1", { method: "GET" });
    const data = await readJson(response);
    if (!response.ok) return apiError(res, response.status, "Could not load settings", data);
    return json(res, 200, { ok: true, settings: normalizedSettings(Array.isArray(data) && data[0]) });
  }
  if (!["POST", "PATCH", "PUT"].includes(req.method)) return apiError(res, 405, "Method not allowed");
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const update = { updated_at: new Date().toISOString() };
  let changed = false;

  if (Object.prototype.hasOwnProperty.call(body, "watermark_enabled")) {
    if (typeof body.watermark_enabled !== "boolean") return apiError(res, 400, "Invalid watermark setting");
    update.watermark_enabled = body.watermark_enabled;
    changed = true;
  }
  if (Object.prototype.hasOwnProperty.call(body, "watermark_transparency")) {
    const transparency = Number(body.watermark_transparency);
    if (!Number.isInteger(transparency) || transparency < 0 || transparency > 100) return apiError(res, 400, "Transparency must be between 0 and 100.");
    update.watermark_transparency = transparency;
    changed = true;
  }
  if (Object.prototype.hasOwnProperty.call(body, "watermark_size")) {
    const size = Number(body.watermark_size);
    if (!Number.isInteger(size) || size < 10 || size > 60) return apiError(res, 400, "Watermark size must be between 10 and 60.");
    update.watermark_size = size;
    changed = true;
  }
  if (Object.prototype.hasOwnProperty.call(body, "photo_aspect_ratio")) {
    if (!["16:9", "16:10"].includes(body.photo_aspect_ratio)) return apiError(res, 400, "Invalid photo aspect ratio");
    update.photo_aspect_ratio = body.photo_aspect_ratio;
    changed = true;
  }
  if (Object.prototype.hasOwnProperty.call(body, "photo_filter")) {
    if (!["none", "balanced", "showroom"].includes(body.photo_filter)) return apiError(res, 400, "Invalid photo filter");
    update.photo_filter = body.photo_filter;
    changed = true;
  }
  if (Object.prototype.hasOwnProperty.call(body, "photo_filter_strength")) {
    const strength = Number(body.photo_filter_strength);
    if (!Number.isInteger(strength) || strength < 0 || strength > 100) return apiError(res, 400, "Photo filter strength must be between 0 and 100.");
    update.photo_filter_strength = strength;
    changed = true;
  }
  if (Object.prototype.hasOwnProperty.call(body, "desktop_gallery_scale")) {
    const galleryScale = Number(body.desktop_gallery_scale);
    if (!Number.isInteger(galleryScale) || galleryScale < 70 || galleryScale > 100) return apiError(res, 400, "Desktop gallery scale must be between 70 and 100.");
    update.desktop_gallery_scale = galleryScale;
    changed = true;
  }
  if (Object.prototype.hasOwnProperty.call(body, "scroll_header_style")) {
    if (!["compact", "autohaus_original"].includes(body.scroll_header_style)) return apiError(res, 400, "Invalid scroll header style");
    update.scroll_header_style = body.scroll_header_style;
    changed = true;
  }
  const headerBooleans = ["landing_standard_header","landing_standard_header_sticky","landing_original_after_scroll","product_standard_header","product_standard_header_sticky","product_original_header"];
  for (const key of headerBooleans) {
    if (!Object.prototype.hasOwnProperty.call(body, key)) continue;
    if (typeof body[key] !== "boolean") return apiError(res, 400, "Invalid header setting: " + key);
    update[key] = body[key];
    changed = true;
  }
  const modeFields = {
    landing_standard_header_mode: ["hidden","top","sticky"],
    landing_original_header_mode: ["hidden","always","after_scroll"],
    product_standard_header_mode: ["hidden","top","sticky"],
    product_original_header_mode: ["hidden","always","after_scroll"]
  };
  for (const [key, allowed] of Object.entries(modeFields)) {
    if (!Object.prototype.hasOwnProperty.call(body, key)) continue;
    if (!allowed.includes(body[key])) return apiError(res, 400, "Invalid header mode: " + key);
    update[key] = body[key];
    changed = true;
  }
  if (Object.prototype.hasOwnProperty.call(body, "original_header_size")) {
    const size = Number(body.original_header_size);
    if (!Number.isInteger(size) || size < 65 || size > 100) return apiError(res, 400, "Original header size must be 65–100.");
    update.original_header_size = size;
    changed = true;
  }
  if (Object.prototype.hasOwnProperty.call(body, "original_header_opacity")) {
    const opacity = Number(body.original_header_opacity);
    if (!Number.isInteger(opacity) || opacity < 85 || opacity > 100) return apiError(res, 400, "Original header opacity must be 85–100.");
    update.original_header_opacity = opacity;
    changed = true;
  }
  if (Object.prototype.hasOwnProperty.call(body, "original_header_language")) {
    if (!["menu","header"].includes(body.original_header_language)) return apiError(res, 400, "Invalid language position.");
    update.original_header_language = body.original_header_language;
    changed = true;
  }
  if (Object.prototype.hasOwnProperty.call(body, "original_header_desktop_menu_label")) {
    if (typeof body.original_header_desktop_menu_label !== "boolean") return apiError(res, 400, "Invalid desktop menu label setting.");
    update.original_header_desktop_menu_label = body.original_header_desktop_menu_label;
    changed = true;
  }
  if (!changed) return apiError(res, 400, "No settings to update");
  const response = await db("admin_settings?singleton=eq.true", {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(update)
  });
  const data = await readJson(response);
  if (!response.ok || !Array.isArray(data) || !data.length) return apiError(res, response.status || 503, "Could not save settings", data);
  return json(res, 200, { ok: true, settings: normalizedSettings(data[0]) });
}

module.exports = async function handler(req, res) {
  if (!requireSameOrigin(req, res)) return;
  const user = await requireAdmin(req, res);
  if (!user) return apiError(res, 401, "Authentication required");
  const db = databaseFor(req);
  if (req.method !== "GET" && (user.adminRole === "viewer" || (req.method === "DELETE" && user.adminRole === "editor"))) return json(res, 403, { ok: false, error: "Your role cannot perform this action." });

  const action = clean((req.query && req.query.action) || "", 40).toLowerCase();
  const id = clean((req.query && req.query.id) || "", 80);
  if (id && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return apiError(res, 400, "Invalid vehicle ID");

  try {
    if (action === "settings") return await settingsAction(req, res, db);

    if (req.method === "GET") {
      if (action) return apiError(res, 400, "Unknown action");
      if (id) {
        const r = await db("vehicles?id=eq." + encodeURIComponent(id) + "&select=*&limit=1", { method: "GET" });
        const data = await readJson(r);
        if (!r.ok) return apiError(res, r.status, "Could not load vehicle", data);
        if (!Array.isArray(data) || !data.length) return apiError(res, 404, "Vehicle not found");
        return json(res, 200, { ok: true, vehicle: data[0] });
      }

      const r = await db("vehicles?select=id,slug,ref,make,model,full_name,price,mileage,fuel,transmission,published,updated_at,cover:images->0&order=updated_at.desc", { method: "GET" });
      const data = await readJson(r);
      if (!r.ok) return apiError(res, r.status, "Could not load vehicles", data);
      if (!Array.isArray(data)) throw new Error("Invalid inventory response");
      return json(res, 200, { ok: true, vehicles: data.map(v => { const row = Object.assign({}, v, { images: v.cover ? [v.cover] : [] }); delete row.cover; return row; }), can_import: false });
    }

    if (req.method === "POST" && action === "bootstrap") {
      return json(res, 410, { ok: false, error: "Use live AutoHaus sync to import inventory." });
    }

    if (action) return apiError(res, 400, "Unknown action");

    if (req.method === "POST") {
      const normalized = normalizeWithTranslations(req.body);
      if (normalized.error) return apiError(res, 400, normalized.error);
      // Public ordering is updated_at DESC; using epoch seconds avoids an extra
      // database read solely to allocate a cosmetic tie-breaker.
      const row = Object.assign({ created_at: new Date().toISOString(), sort_order: Math.min(2147483647, Math.floor(Date.now() / 1000)) }, normalized.row);
      const r = await db("vehicles", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(row)
      });
      const data = await readJson(r);
      if (!r.ok) return apiError(res, r.status, "Could not create vehicle", data);
      return json(res, 201, { ok: true, vehicle: Array.isArray(data) ? data[0] : data });
    }

    if ((req.method === "PUT" || req.method === "PATCH") && id) {
      const body = req.body && typeof req.body === "object" ? req.body : {};
      const version = body.if_unmodified_since;
      if (version && (typeof version !== "string" || !Number.isFinite(Date.parse(version)))) return apiError(res, 400, "Invalid saved version");

      let normalized;
      if (isFullVehicleUpdate(body)) {
        // The editor sends the complete editable vehicle. Normalize it directly
        // so a normal Save is one database round-trip instead of GET + PATCH.
        normalized = normalizeWithTranslations(body);
      } else {
        const previousResponse = await db("vehicles?id=eq." + encodeURIComponent(id) + "&select=*&limit=1", { method: "GET" });
        const previous = await readJson(previousResponse);
        if (!previousResponse.ok) return apiError(res, previousResponse.status, "Could not load vehicle");
        if (!Array.isArray(previous) || !previous.length) return apiError(res, 404, "Vehicle not found");
        normalized = normalizeWithTranslations(Object.assign({}, previous[0], body));
      }
      if (normalized.error) return apiError(res, 400, normalized.error);

      const r = await db("vehicles?id=eq." + encodeURIComponent(id) + (version ? "&updated_at=eq." + encodeURIComponent(version) : ""), {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(normalized.row)
      });
      const data = await readJson(r);
      if (!r.ok) return apiError(res, r.status, "Could not save vehicle", data);
      if (!Array.isArray(data) || !data.length) return json(res, 409, { ok: false, error: "This car changed in another session. Reload it before saving.", code: "EDIT_CONFLICT" });
      return json(res, 200, { ok: true, vehicle: data[0], public: legacyVehicle(data[0]) });
    }

    if (req.method === "DELETE" && id) {
      const r = await db("vehicles?id=eq." + encodeURIComponent(id), {
        method: "DELETE",
        headers: { Prefer: "return=representation" }
      });
      const data = await readJson(r);
      if (!r.ok) return apiError(res, r.status, "Could not delete vehicle", data);
      if (!Array.isArray(data) || !data.length) return apiError(res, 404, "Vehicle not found");
      return json(res, 200, { ok: true, deleted: data.length });
    }

    return apiError(res, 405, "Method not allowed");
  } catch (err) {
    console.error("Admin vehicles API failed", err);
    return apiError(res, 503, "Admin data service is unavailable");
  }
};

module.exports.initialInventory = initialInventory;
