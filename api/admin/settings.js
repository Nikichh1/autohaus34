"use strict";

const { json, requireAdmin, requireSameOrigin, databaseFor } = require("../../server/admin-lib");

async function parse(response) {
  const text = await response.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch (_) { return text; }
}

function defaults() {
  return { watermark_enabled: false, watermark_transparency: 75 };
}

module.exports = async function handler(req, res) {
  if (!requireSameOrigin(req, res)) return;
  const user = await requireAdmin(req, res);
  if (!user) return json(res, 401, { ok: false, error: "Authentication required" });
  if (!['GET', 'POST', 'PATCH'].includes(req.method)) return json(res, 405, { ok: false, error: "Method not allowed" });

  const db = databaseFor(req);
  try {
    if (req.method === 'GET') {
      const response = await db('admin_settings?singleton=eq.true&select=watermark_enabled,watermark_transparency&limit=1', { method: 'GET' });
      const data = await parse(response);
      if (!response.ok) throw new Error('settings_read_failed');
      const row = Array.isArray(data) && data[0] ? data[0] : defaults();
      return json(res, 200, { ok: true, settings: {
        watermark_enabled: row.watermark_enabled === true,
        watermark_transparency: Number.isFinite(Number(row.watermark_transparency)) ? Math.max(0, Math.min(100, Math.round(Number(row.watermark_transparency)))) : 75
      }});
    }

    if (user.adminRole === 'viewer') return json(res, 403, { ok: false, error: "Your role cannot change settings." });
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    if (typeof body.watermark_enabled !== 'boolean') return json(res, 400, { ok: false, error: "Invalid watermark setting" });
    const transparency = Number(body.watermark_transparency);
    if (!Number.isInteger(transparency) || transparency < 0 || transparency > 100) return json(res, 400, { ok: false, error: "Transparency must be between 0 and 100." });

    const row = {
      watermark_enabled: body.watermark_enabled,
      watermark_transparency: transparency,
      updated_at: new Date().toISOString()
    };
    const response = await db('admin_settings?singleton=eq.true', {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(row)
    });
    const data = await parse(response);
    if (!response.ok || !Array.isArray(data) || !data.length) throw new Error('settings_write_failed');
    return json(res, 200, { ok: true, settings: {
      watermark_enabled: data[0].watermark_enabled === true,
      watermark_transparency: Number(data[0].watermark_transparency)
    }});
  } catch (error) {
    console.error('Admin settings API failed', error);
    return json(res, 503, { ok: false, error: "Settings are temporarily unavailable." });
  }
};
