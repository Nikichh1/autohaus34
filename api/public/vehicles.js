"use strict";

const { configured, json, db, legacyVehicle } = require("../../server/admin-lib");

async function parse(r) {
  const t = await r.text();
  if (!r.ok) throw new Error("Inventory response unavailable");
  const parsed = JSON.parse(t);
  if (!Array.isArray(parsed)) throw new Error("Invalid inventory response");
  return parsed;
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return json(res, 405, { ok: false, error: "Method not allowed" });
  if (!configured()) return json(res, 200, { ok: true, authoritative: false, vehicles: [] });

  try {
    const stateResponse = await db("inventory_state?select=initialized&singleton=eq.true", { method: "GET" });
    const state = await parse(stateResponse);
    if (!state.length || !state[0].initialized) {
      return json(res, 200, { ok: true, authoritative: false, vehicles: [] });
    }

    const r = await db("vehicles?published=eq.true&select=*&order=sort_order.asc,updated_at.desc", { method: "GET" });
    const rows = await parse(r);
    if (!r.ok) throw new Error("Supabase HTTP " + r.status);
    const vehicles = rows.map(legacyVehicle);
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "no-store");
    res.end(JSON.stringify({ ok: true, authoritative: true, vehicles }));
  } catch (err) {
    console.error("Public inventory API failed", err);
    return json(res, 200, { ok: true, authoritative: false, vehicles: [] });
  }
};
