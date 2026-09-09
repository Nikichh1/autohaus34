"use strict";

const {
  json, clean, login, requireAdmin, setSessionCookies, clearSessionCookies
} = require("../../server/admin-lib");

module.exports = async function handler(req, res) {
  const action = clean((req.query && req.query.action) || "session", 40).toLowerCase();

  if (action === "login") {
    if (req.method !== "POST") return json(res, 405, { ok: false, error: "Method not allowed" });
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const result = await login(body.email, body.password).catch((err) => ({ ok: false, status: 503, error: err.message }));
    if (!result.ok) return json(res, result.status || 401, { ok: false, error: result.error || "Invalid credentials" });
    setSessionCookies(req, res, result.session);
    return json(res, 200, { ok: true, user: { email: result.user.email } });
  }

  if (action === "logout") {
    if (req.method !== "POST") return json(res, 405, { ok: false, error: "Method not allowed" });
    clearSessionCookies(req, res);
    return json(res, 200, { ok: true });
  }

  if (req.method !== "GET") return json(res, 405, { ok: false, error: "Method not allowed" });
  const user = await requireAdmin(req, res);
  if (!user) return json(res, 401, { ok: false, authenticated: false });
  return json(res, 200, { ok: true, authenticated: true, user: { email: user.email } });
};
