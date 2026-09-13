"use strict";

const { json, clean, requireAdmin, requireSameOrigin, db } = require("../../server/admin-lib");

async function readJson(r) {
  const text = await r.text();
  try { return text ? JSON.parse(text) : {}; } catch (_) { return {}; }
}

module.exports = async function handler(req, res) {
  if (!requireSameOrigin(req, res)) return;
  if (req.method !== "GET") return json(res, 405, { ok: false, error: "Method not allowed" });
  const user = await requireAdmin(req, res);
  if (!user) return json(res, 401, { ok: false, error: "Authentication required" });
  const days = Math.max(1, Math.min(365, Number(clean((req.query && req.query.days) || "30", 3)) || 30));
  try {
    const r = await db("rpc/admin_analytics_summary", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ p_days: days })
    });
    const data = await readJson(r);
    if (!r.ok) return json(res, r.status === 403 ? 403 : 503, { ok: false, error: r.status === 403 ? "Analytics access is restricted." : "Analytics service is unavailable." });
    return json(res, 200, { ok: true, summary: Array.isArray(data) ? data[0] : data });
  } catch (err) {
    console.error("Admin analytics failed", err);
    return json(res, 503, { ok: false, error: "Analytics service is unavailable." });
  }
};
