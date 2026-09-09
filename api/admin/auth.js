"use strict";

const {
  json, clean, login, requireAdmin, setSessionCookies, clearSessionCookies
} = require("../../server/admin-lib");

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;
const attempts = globalThis.__ahAdminLoginAttempts || (globalThis.__ahAdminLoginAttempts = new Map());

function clientKey(req) {
  return clean(String(req.headers["x-forwarded-for"] || "unknown").split(",")[0], 100) || "unknown";
}

function limited(req, success) {
  const key = clientKey(req), now = Date.now();
  let entry = attempts.get(key);
  if (!entry || now - entry.started > WINDOW_MS) entry = { started: now, count: 0 };
  if (success) { attempts.delete(key); return false; }
  entry.count += 1; attempts.set(key, entry);
  if (attempts.size > 500) for (const [k, v] of attempts) if (now - v.started > WINDOW_MS) attempts.delete(k);
  return entry.count > MAX_ATTEMPTS;
}

module.exports = async function handler(req, res) {
  const action = clean((req.query && req.query.action) || "session", 40).toLowerCase();

  if (action === "login") {
    if (req.method !== "POST") return json(res, 405, { ok: false, error: "Method not allowed" });
    const key = clientKey(req), existing = attempts.get(key);
    if (existing && Date.now() - existing.started <= WINDOW_MS && existing.count >= MAX_ATTEMPTS) {
      return json(res, 429, { ok: false, error: "Too many login attempts. Try again later." });
    }
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const result = await login(body.email, body.password).catch((err) => ({ ok: false, status: 503, error: err.message }));
    if (!result.ok) {
      limited(req, false);
      return json(res, result.status || 401, { ok: false, error: result.error || "Invalid credentials" });
    }
    limited(req, true);
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
