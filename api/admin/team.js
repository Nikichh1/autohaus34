"use strict";

const { json, requireAdmin, requireSameOrigin, parseCookies, refreshSession, ACCESS_COOKIE, REFRESH_COOKIE } = require("../../server/admin-lib");
const SUPABASE_URL = "https://ajoiqomflplhadyhxvfe.supabase.co";

function currentAccess(req, res) {
  let access = parseCookies(req)[ACCESS_COOKIE] || "";
  const setCookie = res.getHeader && res.getHeader("Set-Cookie");
  const values = Array.isArray(setCookie) ? setCookie : setCookie ? [String(setCookie)];
  for (const value of values) {
    if (!String(value).startsWith(ACCESS_COOKIE + "=")) continue;
    const raw = String(value).slice(ACCESS_COOKIE.length + 1).split(";")[0];
    try { access = decodeURIComponent(raw); } catch (_) { access = raw; }
  }
  return access;
}

module.exports = async function handler(req, res) {
  if (!requireSameOrigin(req, res)) return;
  const user = await requireAdmin(req, res);
  if (!user) return json(res, 401, { ok: false, error: "Authentication required" });
  let access = currentAccess(req, res);
  if (!access) {
    const cookies = parseCookies(req);
    const refreshed = await refreshSession(cookies[REFRESH_COOKIE]);
    if (refreshed) access = refreshed.access_token;
  }
  if (!access) return json(res, 401, { ok: false, error: "Session expired" });
  try {
    const body = req.method === "GET" ? {} : (req.body && typeof req.body === "object" ? req.body : {});
    const action = String((req.query && req.query.action) || body.action || "list");
    const response = await fetch(SUPABASE_URL + "/functions/v1/admin-team-v2", {
      method: "POST",
      headers: { Authorization: "Bearer " + access, "Content-Type": "application/json" },
      body: JSON.stringify(Object.assign({}, body, { action }))
    });
    const data = await response.json().catch(() => ({}));
    return json(res, response.status, data);
  } catch (err) {
    console.error("Admin team proxy failed", err);
    return json(res, 503, { ok: false, error: "Admin team service is unavailable." });
  }
};
