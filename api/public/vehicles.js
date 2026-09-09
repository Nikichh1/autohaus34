"use strict";

const { configured, json, db, legacyVehicle } = require("../../server/admin-lib");

async function parse(r) {
  const t = await r.text();
  try { return t ? JSON.parse(t) : []; } catch (_) { return []; }
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return json(res, 405, { ok: false, error: "Method not allowed" });
  if (!configured()) {
    res.setHeader("Cache-Control", "public, s-maxage=30, stale-while-revalidate=120");
    return json(res, 200, { ok: true, authoritative: false, vehicles: [] });
  }

  try {
    const existsResponse = await db("vehicles?select=id&limit=1", { method: "GET" });
    const exists = await parse(existsResponse);
    if (!existsResponse.ok || !Array.isArray(exists) || !exists.length) {
      res.setHeader("Cache-Control", "public, s-maxage=30, stale-while-revalidate=120");
      return json(res, 200, { ok: true, authoritative: false, vehicles: [] });
    }

    const r = await db("vehicles?published=eq.true&select=*&order=updated_at.desc", { method: "GET" });
    const rows = await parse(r);
    if (!r.ok) throw new Error("Supabase HTTP " + r.status);
    const vehicles = (Array.isArray(rows) ? rows : []).map(legacyVehicle);
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
    res.end(JSON.stringify({ ok: true, authoritative: true, vehicles }));
  } catch (err) {
    console.error("Public inventory API failed", err);
    res.setHeader("Cache-Control", "public, s-maxage=15, stale-while-revalidate=60");
    return json(res, 200, { ok: true, authoritative: false, vehicles: [] });
  }
};
