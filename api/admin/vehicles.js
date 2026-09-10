"use strict";

const fs = require("fs");
const path = require("path");
const {
  json, clean, requireAdmin, requireSameOrigin, db, normalizeVehicle, legacyVehicle
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
  const source = readAssignment(path.join(root, "vehicles.base.js"), "AH_VEHICLES");
  if (source.length !== 87 || new Set(source.map((v) => v.id)).size !== 87) throw new Error("Canonical inventory must contain 87 distinct vehicles");
  return source.map((vehicle, index) => {
    if (!/^[a-z0-9-]+$/.test(vehicle.id)) throw new Error("Invalid canonical vehicle URL");
    const equipmentPath = path.join(root, "eq", vehicle.id + ".js");
    const equipment = fs.existsSync(equipmentPath) ? readAssignment(equipmentPath, "AH_EQ") : null;
    if (equipment && equipment.id !== vehicle.id) throw new Error("Equipment vehicle mismatch");
    return legacyToRow(vehicle, index, equipment);
  });
}

async function nextSortOrder() {
  const r = await db("vehicles?select=sort_order&order=sort_order.desc&limit=1", { method: "GET" });
  const data = await readJson(r);
  if (!r.ok || !Array.isArray(data)) throw new Error("Could not determine inventory order");
  if (!data.length) return 1;
  return Math.max(1, Number(data[0].sort_order || 0) + 1);
}

module.exports = async function handler(req, res) {
  if (!requireSameOrigin(req, res)) return;
  const user = await requireAdmin(req, res);
  if (!user) return apiError(res, 401, "Authentication required");

  const action = clean((req.query && req.query.action) || "", 40).toLowerCase();
  const id = clean((req.query && req.query.id) || "", 80);
  if (id && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return apiError(res, 400, "Invalid vehicle ID");

  try {
    if (req.method === "GET") {
      if (id) {
        const r = await db("vehicles?id=eq." + encodeURIComponent(id) + "&select=*&limit=1", { method: "GET" });
        const data = await readJson(r);
        if (!r.ok) return apiError(res, r.status, "Could not load vehicle", data);
        if (!Array.isArray(data) || !data.length) return apiError(res, 404, "Vehicle not found");
        return json(res, 200, { ok: true, vehicle: data[0] });
      }

      const r = await db("vehicles?select=*&order=updated_at.desc", { method: "GET" });
      const data = await readJson(r);
      if (!r.ok) return apiError(res, r.status, "Could not load vehicles", data);
      if (!Array.isArray(data)) throw new Error("Invalid inventory response");
      const activation = await db("inventory_state?select=initialized&singleton=eq.true", { method: "GET" });
      const state = await readJson(activation);
      if (!activation.ok || !Array.isArray(state) || !state.length) throw new Error("Inventory schema needs updating");
      return json(res, 200, { ok: true, vehicles: data, can_import: !state[0].initialized && !data.length });
    }

    if (req.method === "POST" && action === "bootstrap") {
      // Re-check server-side immediately before importing. The admin JWT is
      // authorized by RLS and the activation trigger permanently marks the
      // managed catalogue initialized after the first insert.
      const existingResponse = await db("vehicles?select=id&limit=1", { method: "GET" });
      const existing = await readJson(existingResponse);
      if (!existingResponse.ok || !Array.isArray(existing)) throw new Error("Could not verify inventory state");
      const stateResponse = await db("inventory_state?select=initialized&singleton=eq.true", { method: "GET" });
      const inventoryState = await readJson(stateResponse);
      if (!stateResponse.ok || !Array.isArray(inventoryState) || !inventoryState.length) throw new Error("Inventory schema needs updating");
      if (inventoryState[0].initialized || existing.length) {
        return json(res, 409, { ok: false, error: "Initial inventory has already been imported.", code: "ALREADY_INITIALIZED" });
      }
      const rows = initialInventory();
      const r = await db("vehicles", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify(rows)
      });
      const data = await readJson(r);
      if (!r.ok) return apiError(res, r.status, "Import failed", data);
      return json(res, 200, { ok: true, imported: rows.length });
    }

    if (action) return apiError(res, 400, "Unknown action");

    if (req.method === "POST") {
      const normalized = normalizeVehicle(req.body);
      if (normalized.error) return apiError(res, 400, normalized.error);
      const row = Object.assign({ created_at: new Date().toISOString(), sort_order: await nextSortOrder() }, normalized.row);
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
      const previousResponse = await db("vehicles?id=eq." + encodeURIComponent(id) + "&select=*&limit=1", { method: "GET" });
      const previous = await readJson(previousResponse);
      if (!previousResponse.ok) return apiError(res, previousResponse.status, "Could not load vehicle");
      if (!Array.isArray(previous) || !previous.length) return apiError(res, 404, "Vehicle not found");
      const body = req.body && typeof req.body === "object" ? req.body : {};
      const normalized = normalizeVehicle(Object.assign({}, previous[0], body));
      if (normalized.error) return apiError(res, 400, normalized.error);
      const version = body.if_unmodified_since;
      if (version && (typeof version !== "string" || !Number.isFinite(Date.parse(version)))) return apiError(res, 400, "Invalid saved version");
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
