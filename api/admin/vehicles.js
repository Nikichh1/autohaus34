"use strict";

const {
  json, clean, requireAdmin, db, normalizeVehicle, legacyVehicle
} = require("../../server/admin-lib");

function apiError(res, status, message, detail) {
  return json(res, status, { ok: false, error: message, detail: detail || undefined });
}

async function readJson(r) {
  const text = await r.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch (_) { return text; }
}

function legacyToRow(v, index) {
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
    images: (v.shots || []).map((url, i) => ({
      id: "legacy-" + v.id + "-" + i,
      legacy: true,
      original: url,
      position: i,
      variants: {}
    })),
    source_url: v.src,
    published: true
  });
  if (normalized.error) return null;
  normalized.row.sort_order = Number(index || 0) + 1;
  return normalized.row;
}

async function nextSortOrder() {
  const r = await db("vehicles?select=sort_order&order=sort_order.desc&limit=1", { method: "GET" });
  const data = await readJson(r);
  if (!r.ok || !Array.isArray(data) || !data.length) return 1;
  return Math.max(1, Number(data[0].sort_order || 0) + 1);
}

module.exports = async function handler(req, res) {
  const user = await requireAdmin(req, res);
  if (!user) return apiError(res, 401, "Authentication required");

  const action = clean((req.query && req.query.action) || "", 40).toLowerCase();
  const id = clean((req.query && req.query.id) || "", 80);

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
      return json(res, 200, { ok: true, vehicles: Array.isArray(data) ? data : [] });
    }

    if (req.method === "POST" && action === "bootstrap") {
      const body = req.body && typeof req.body === "object" ? req.body : {};
      const source = Array.isArray(body.vehicles) ? body.vehicles : [];
      if (!source.length) return apiError(res, 400, "No source vehicles supplied");
      if (source.length > 300) return apiError(res, 413, "Too many vehicles");

      const rows = source.map(legacyToRow).filter(Boolean);
      if (!rows.length) return apiError(res, 400, "No valid vehicles to import");

      const r = await db("vehicles?on_conflict=slug", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=representation" },
        body: JSON.stringify(rows)
      });
      const data = await readJson(r);
      if (!r.ok) return apiError(res, r.status, "Import failed", data);
      return json(res, 200, { ok: true, imported: Array.isArray(data) ? data.length : rows.length });
    }

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
      const normalized = normalizeVehicle(req.body);
      if (normalized.error) return apiError(res, 400, normalized.error);
      const r = await db("vehicles?id=eq." + encodeURIComponent(id), {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(normalized.row)
      });
      const data = await readJson(r);
      if (!r.ok) return apiError(res, r.status, "Could not save vehicle", data);
      if (!Array.isArray(data) || !data.length) return apiError(res, 404, "Vehicle not found");
      return json(res, 200, { ok: true, vehicle: data[0], public: legacyVehicle(data[0]) });
    }

    if (req.method === "DELETE" && id) {
      const r = await db("vehicles?id=eq." + encodeURIComponent(id), {
        method: "DELETE",
        headers: { Prefer: "return=representation" }
      });
      const data = await readJson(r);
      if (!r.ok) return apiError(res, r.status, "Could not delete vehicle", data);
      return json(res, 200, { ok: true, deleted: Array.isArray(data) ? data.length : 1 });
    }

    return apiError(res, 405, "Method not allowed");
  } catch (err) {
    console.error("Admin vehicles API failed", err);
    return apiError(res, 503, "Admin data service is unavailable");
  }
};
