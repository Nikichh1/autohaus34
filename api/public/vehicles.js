"use strict";

const { configured, json, db, legacyVehicle, clean } = require("../../server/admin-lib");

async function parse(r) {
  const t = await r.text();
  if (!r.ok) throw new Error("Inventory response unavailable");
  const parsed = JSON.parse(t);
  if (!Array.isArray(parsed)) throw new Error("Invalid inventory response");
  return parsed;
}

function compactVehicle(row) {
  const v = legacyVehicle(row);
  // Collection/showroom pages need the complete photo sequence for focus view,
  // but not descriptions, equipment or duplicated per-image metadata for all cars.
  delete v.managed_images;
  delete v.description_bg;
  delete v.description_en;
  delete v.equipment_bg;
  delete v.equipment_en;
  delete v.notes;
  return v;
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return json(res, 405, { ok: false, error: "Method not allowed" });
  if (!configured()) return json(res, 200, { ok: true, authoritative: false, vehicles: [] });

  const id = clean((req.query && req.query.id) || "", 180);
  if (id && !/^[a-z0-9-]+$/.test(id)) return json(res, 400, { ok: false, error: "Invalid vehicle ID" });

  try {
    const stateResponse = await db("inventory_state?select=initialized&singleton=eq.true", { method: "GET" });
    const state = await parse(stateResponse);
    if (!state.length || !state[0].initialized) {
      return json(res, 200, { ok: true, authoritative: false, vehicles: [] });
    }

    if (id) {
      const r = await db("vehicles?published=eq.true&slug=eq." + encodeURIComponent(id) + "&select=*&limit=1", { method: "GET" });
      const rows = await parse(r);
      if (!rows.length) return json(res, 404, { ok: false, error: "Vehicle not found" });
      return json(res, 200, { ok: true, authoritative: true, vehicle: legacyVehicle(rows[0]) });
    }

    const fields = [
      "id", "slug", "ref", "make", "model", "full_name", "body_type", "colour",
      "transmission", "fuel", "mileage", "first_registration_year", "first_registration_month",
      "unregistered", "horsepower", "price", "chapter", "tags", "images", "source_url", "sort_order"
    ].join(",");
    const r = await db("vehicles?published=eq.true&select=" + fields + "&order=sort_order.asc,updated_at.desc", { method: "GET" });
    const rows = await parse(r);
    const vehicles = rows.map(compactVehicle);

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "no-store");
    res.end(JSON.stringify({ ok: true, authoritative: true, count: vehicles.length, vehicles }));
  } catch (err) {
    console.error("Public inventory API failed", err);
    return json(res, 200, { ok: true, authoritative: false, vehicles: [] });
  }
};
