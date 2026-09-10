"use strict";

const crypto = require("crypto");

const ACCESS_COOKIE = "ah_admin_access";
const REFRESH_COOKIE = "ah_admin_refresh";

function env(name) {
  return String(process.env[name] || "").trim();
}

function configured() {
  return !!(env("SUPABASE_URL") && env("SUPABASE_ANON_KEY") && env("SUPABASE_SERVICE_ROLE_KEY"));
}

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.end(JSON.stringify(body));
}

// Cookies are intentionally unavailable to scripts. Mutations additionally require
// same-origin JSON, including login, to protect against login CSRF and sibling sites.
function requireSameOrigin(req, res) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return true;
  const origin = String(req.headers.origin || "");
  let matches = false;
  try {
    const actual = new URL(origin || req.headers.referer || "");
    const expected = new URL((secureCookie(req) ? "https://" : "http://") + req.headers.host);
    matches = actual.origin === expected.origin;
  } catch (_) { matches = false; }
  if (!matches || String(req.headers["sec-fetch-site"] || "same-origin") !== "same-origin") {
    json(res, 403, { ok: false, error: "Please reload the admin and try again.", code: "INVALID_ORIGIN" });
    return false;
  }
  if (!/^application\/json(?:\s*;|$)/i.test(String(req.headers["content-type"] || ""))) {
    json(res, 415, { ok: false, error: "JSON request required" });
    return false;
  }
  return true;
}

function timedFetch(url, options, timeout) {
  return fetch(url, Object.assign({}, options, { signal: AbortSignal.timeout(timeout || 12000) }));
}

function clean(value, max) {
  return String(value == null ? "" : value)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim().slice(0, max || 1000);
}

function parseCookies(req) {
  const out = {};
  String(req.headers.cookie || "").split(";").forEach((part) => {
    const i = part.indexOf("=");
    if (i < 0) return;
    const key = part.slice(0, i).trim();
    const value = part.slice(i + 1).trim();
    if (!key) return;
    try { out[key] = decodeURIComponent(value); } catch (_) { out[key] = value; }
  });
  return out;
}

function secureCookie(req) {
  return String(req.headers["x-forwarded-proto"] || "https").split(",")[0].trim() !== "http";
}

function cookie(name, value, maxAge, req) {
  return name + "=" + encodeURIComponent(value || "") + "; Path=/; HttpOnly; SameSite=Strict; Max-Age=" +
    Math.max(0, Math.floor(maxAge || 0)) + (secureCookie(req) ? "; Secure" : "");
}

function setSessionCookies(req, res, session) {
  const expires = Math.max(60, Number(session.expires_in || 3600) - 60);
  res.setHeader("Set-Cookie", [
    cookie(ACCESS_COOKIE, session.access_token, expires, req),
    cookie(REFRESH_COOKIE, session.refresh_token, 60 * 60 * 24 * 30, req)
  ]);
}

function clearSessionCookies(req, res) {
  res.setHeader("Set-Cookie", [cookie(ACCESS_COOKIE, "", 0, req), cookie(REFRESH_COOKIE, "", 0, req)]);
}

function allowedEmails() {
  return env("ADMIN_EMAILS").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
}

function isAllowed(email) {
  const allowed = allowedEmails();
  return allowed.length > 0 && allowed.includes(String(email || "").toLowerCase());
}

async function authFetch(path, options) {
  const url = env("SUPABASE_URL").replace(/\/$/, "") + "/auth/v1/" + path.replace(/^\//, "");
  const headers = Object.assign({
    apikey: env("SUPABASE_ANON_KEY"),
    "Content-Type": "application/json"
  }, (options && options.headers) || {});
  return timedFetch(url, Object.assign({}, options || {}, { headers }));
}

async function login(email, password) {
  if (!configured()) throw new Error("Supabase is not configured");
  if (!allowedEmails().length) throw new Error("ADMIN_EMAILS is not configured");
  if (!isAllowed(clean(email, 240)) || typeof password !== "string" || !password || password.length > 4096) {
    return { ok: false, status: 401 };
  }
  const r = await authFetch("token?grant_type=password", {
    method: "POST",
    body: JSON.stringify({ email: clean(email, 240), password: String(password || "") })
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data.access_token) return { ok: false, status: r.status === 429 ? 429 : 401 };
  if (!data.user || !isAllowed(data.user.email)) return { ok: false, status: 403 };
  return { ok: true, session: data, user: data.user };
}

async function userForToken(access) {
  if (!access) return null;
  const r = await authFetch("user", { method: "GET", headers: { Authorization: "Bearer " + access } });
  if (!r.ok) return null;
  const user = await r.json().catch(() => null);
  if (!user || !isAllowed(user.email)) return null;
  // Supabase access JWTs can outlive logout. Check the verified token's session
  // against auth.sessions, through a service-role-only SQL function.
  let claims;
  try { claims = JSON.parse(Buffer.from(access.split(".")[1], "base64url").toString()); }
  catch (_) { return null; }
  if (!claims.session_id) return null;
  const session = await db("rpc/admin_session_active", {
    method: "POST", body: JSON.stringify({ session_uuid: claims.session_id, user_uuid: user.id })
  });
  return session.ok && await session.json().catch(() => false) === true ? user : null;
}

async function refreshSession(refreshToken) {
  if (!refreshToken) return null;
  const r = await authFetch("token?grant_type=refresh_token", {
    method: "POST",
    body: JSON.stringify({ refresh_token: refreshToken })
  });
  if (!r.ok) return null;
  const data = await r.json().catch(() => null);
  if (!data || !data.access_token || !data.user || !isAllowed(data.user.email)) return null;
  return data;
}

async function requireAdmin(req, res) {
  if (!configured() || !allowedEmails().length) return null;
  try {
    const cookies = parseCookies(req);
    const user = await userForToken(cookies[ACCESS_COOKIE]);
    if (user) return user;
    const refreshed = await refreshSession(cookies[REFRESH_COOKIE]);
    if (!refreshed || !await userForToken(refreshed.access_token)) return null;
    setSessionCookies(req, res, refreshed);
    return refreshed.user;
  } catch (_) { return null; }
}

async function logout(req) {
  const cookies = parseCookies(req);
  let access = cookies[ACCESS_COOKIE];
  if (!access && cookies[REFRESH_COOKIE]) {
    const session = await refreshSession(cookies[REFRESH_COOKIE]);
    access = session && session.access_token;
  }
  if (!access) return;
  let response = await authFetch("logout?scope=local", { method: "POST", headers: { Authorization: "Bearer " + access } });
  // A token may expire between its last authenticated request and sign-out.
  // Refresh it once so the server session can still be revoked.
  if (response.status === 401 && cookies[REFRESH_COOKIE]) {
    const session = await refreshSession(cookies[REFRESH_COOKIE]);
    if (!session) return; // The refresh token is already invalid/revoked.
    response = await authFetch("logout?scope=local", { method: "POST", headers: { Authorization: "Bearer " + session.access_token } });
  }
  if (!response.ok && response.status !== 401 && response.status !== 403) throw new Error("Session revocation failed");
}

function serviceHeaders(extra) {
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  return Object.assign({
    apikey: key,
    Authorization: "Bearer " + key,
    "Content-Type": "application/json"
  }, extra || {});
}

async function db(path, options) {
  if (!configured()) throw new Error("Supabase is not configured");
  const url = env("SUPABASE_URL").replace(/\/$/, "") + "/rest/v1/" + path.replace(/^\//, "");
  return timedFetch(url, Object.assign({}, options || {}, {
    headers: serviceHeaders((options && options.headers) || {})
  }));
}

function numberOrNull(v, integer) {
  if (v === "" || v == null) return null;
  if (typeof v !== "number" && typeof v !== "string") return null;
  if (typeof v === "string" && !v.trim()) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return integer && !Number.isInteger(n) ? null : n;
}

function safeUrl(value, imageOnly) {
  const s = clean(value, 1200);
  if (!s) return "";
  if (imageOnly && /^(?:\/?(?:assets|img\/v)\/)[a-z0-9_./-]+\.(?:jpe?g|png|webp|avif)$/i.test(s) && !s.includes("..")) return s;
  if (imageOnly && /^\/img\/v\/[a-z0-9_-]+-(?:400|800|1280)\.(?:jpg|webp)$/i.test(s)) return s;
  try {
    const url = new URL(s);
    if (url.protocol !== "https:" || url.username || url.password) return "";
    if (imageOnly && url.hostname !== "autohaus.bg" && url.hostname !== "www.autohaus.bg" &&
        !(url.hostname === "res.cloudinary.com" && url.pathname.startsWith("/" + env("CLOUDINARY_CLOUD_NAME") + "/image/upload/"))) return "";
    return url.href;
  } catch (_) { return ""; }
}

function stringArray(v, maxItems) {
  const a = Array.isArray(v) ? v : [];
  return a.slice(0, maxItems || 200).map((x) => clean(x, 2000)).filter(Boolean);
}

function sanitizeImages(v) {
  const a = Array.isArray(v) ? v : [];
  return a.slice(0, 80).map((img, i) => ({
    id: clean(img && img.id, 180) || crypto.randomUUID(),
    public_id: clean(img && img.public_id, 500),
    original: safeUrl(img && img.original, true),
    width: numberOrNull(img && img.width, true),
    height: numberOrNull(img && img.height, true),
    legacy: !!(img && img.legacy),
    position: i,
    variants: img && typeof img.variants === "object" && img.variants ? {
      jpg400: safeUrl(img.variants.jpg400, true),
      jpg800: safeUrl(img.variants.jpg800, true),
      jpg1280: safeUrl(img.variants.jpg1280, true),
      webp400: safeUrl(img.variants.webp400, true),
      webp800: safeUrl(img.variants.webp800, true),
      webp1280: safeUrl(img.variants.webp1280, true)
    } : {}
  })).filter((img) => img.original || img.variants.jpg1280);
}

function slugify(value) {
  return clean(value, 220).toLowerCase().normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "").slice(0, 180);
}

function normalizeVehicle(body) {
  body = body && typeof body === "object" ? body : {};
  const make = clean(body.make, 120);
  const model = clean(body.model, 220);
  const slug = slugify(body.slug || [make, model].filter(Boolean).join(" "));
  const row = {
    slug,
    ref: clean(body.ref, 80),
    make,
    model,
    full_name: clean(body.full_name, 320) || [make, model].filter(Boolean).join(" "),
    body_type: clean(body.body_type, 80),
    colour: clean(body.colour, 120),
    transmission: clean(body.transmission, 40),
    fuel: clean(body.fuel, 40),
    mileage: numberOrNull(body.mileage, true),
    first_registration_year: numberOrNull(body.first_registration_year, true),
    first_registration_month: numberOrNull(body.first_registration_month, true),
    unregistered: body.unregistered === true,
    horsepower: numberOrNull(body.horsepower, true),
    price: numberOrNull(body.price, false),
    chapter: clean(body.chapter, 80),
    tags: stringArray(body.tags, 60),
    notes: stringArray(body.notes, 80),
    description_bg: clean(body.description_bg, 20000),
    description_en: clean(body.description_en, 20000),
    description_source: clean(body.description_source, 30000),
    description_review_notes: stringArray(body.description_review_notes, 100),
    equipment_bg: stringArray(body.equipment_bg, 600),
    equipment_en: stringArray(body.equipment_en, 600),
    images: sanitizeImages(body.images),
    source_url: safeUrl(body.source_url, false),
    published: body.published === true,
    updated_at: new Date().toISOString()
  };
  if (!row.slug || !row.make || !row.model) return { error: "Brand, model and slug are required." };
  for (const [key, max] of Object.entries({ description_bg: 20000, description_en: 20000, description_source: 30000 })) {
    if (body[key] != null && (typeof body[key] !== "string" || body[key].length > max)) return { error: key + " is too long (maximum " + max + " characters)." };
  }
  for (const [key, max] of Object.entries({ equipment_bg: 600, equipment_en: 600, description_review_notes: 100, tags: 60, notes: 80 })) {
    if (body[key] != null && (!Array.isArray(body[key]) || body[key].length > max || body[key].some((value) => typeof value !== "string" || value.length > 2000))) return { error: "Invalid or oversized " + key + "." };
  }
  for (const key of ["mileage", "horsepower", "price", "first_registration_year", "first_registration_month"]) {
    if (body[key] !== "" && body[key] != null && (row[key] == null || row[key] < 0 || row[key] > (key === "price" ? 999999999999.99 : 2147483647))) {
      return { error: "Enter a valid non-negative number for " + key + "." };
    }
  }
  for (const [key, values] of Object.entries({ fuel: ["", "petrol", "diesel", "hybrid", "phev", "ev"], transmission: ["", "auto", "manual"] })) {
    if (!values.includes(row[key])) return { error: "Invalid " + key + "." };
  }
  if (row.unregistered) { row.first_registration_year = null; row.first_registration_month = null; }
  if (row.first_registration_month != null && row.first_registration_year == null) return { error: "Enter a registration year or leave both registration fields empty." };
  if (clean(body.source_url, 1200) && !row.source_url) return { error: "The source URL must use HTTPS." };
  if (body.images != null && !Array.isArray(body.images)) return { error: "Photos must be an ordered list." };
  if (Array.isArray(body.images) && body.images.length !== row.images.length) return { error: "One or more photos are invalid. Use the photo upload control." };
  if (row.equipment_bg.length !== row.equipment_en.length) return { error: "Bulgarian and English equipment must have the same number of lines." };
  if (row.published && (!row.images.length || !row.fuel || !row.transmission)) return { error: "Add a photo, fuel and transmission before publishing." };
  if (row.first_registration_month != null && (row.first_registration_month < 1 || row.first_registration_month > 12)) {
    return { error: "First registration month must be 1-12." };
  }
  if (row.first_registration_year != null && (row.first_registration_year < 1900 || row.first_registration_year > 2100)) {
    return { error: "First registration year is invalid." };
  }
  return { row };
}

function legacyVehicle(row) {
  const images = (Array.isArray(row.images) ? row.images : []).map((img) =>
    img && img.public_id && !img.legacy ? Object.assign({}, img, { variants: imageVariants(img.public_id) }) : img);
  const shots = images.map((img) => {
    if (img && img.variants && img.variants.jpg1280) return img.variants.jpg1280;
    return img && img.original ? img.original : "";
  }).filter(Boolean);
  return {
    id: row.slug,
    db_id: row.id,
    ref: row.ref || "",
    make: row.make || "",
    model: row.model || "",
    full: row.full_name || [row.make, row.model].filter(Boolean).join(" "),
    body_type: row.body_type || "",
    year: row.first_registration_year,
    month: row.first_registration_month,
    unreg: !!row.unregistered,
    km: row.mileage,
    hp: row.horsepower,
    fuel: row.fuel || "",
    gear: row.transmission || "",
    colour: row.colour || "",
    price: row.price == null ? null : Number(row.price),
    chapter: row.chapter || "saloon",
    tags: Array.isArray(row.tags) ? row.tags : [],
    notes: Array.isArray(row.notes) ? row.notes : [],
    shots,
    managed_images: images,
    description_bg: row.description_bg || "",
    description_en: row.description_en || "",
    equipment_bg: Array.isArray(row.equipment_bg) ? row.equipment_bg : [],
    equipment_en: Array.isArray(row.equipment_en) ? row.equipment_en : [],
    src: row.source_url || ""
  };
}

function cloudinaryUrl(publicId, transformation, format) {
  const cloud = env("CLOUDINARY_CLOUD_NAME");
  if (!cloud || !publicId) return "";
  return "https://res.cloudinary.com/" + encodeURIComponent(cloud) + "/image/upload/" + transformation + "/" +
    publicId.split("/").map(encodeURIComponent).join("/") + "." + (format || "jpg");
}

function imageVariants(publicId) {
  const base = "a_auto/c_lpad,b_white,q_auto:good";
  return {
    jpg400: cloudinaryUrl(publicId, base + ",w_400,h_245,fl_progressive", "jpg"),
    jpg800: cloudinaryUrl(publicId, base + ",w_800,h_490,fl_progressive", "jpg"),
    jpg1280: cloudinaryUrl(publicId, base + ",w_1280,h_784,fl_progressive", "jpg"),
    webp400: cloudinaryUrl(publicId, base + ",w_400,h_245", "webp"),
    webp800: cloudinaryUrl(publicId, base + ",w_800,h_490", "webp"),
    webp1280: cloudinaryUrl(publicId, base + ",w_1280,h_784", "webp")
  };
}

module.exports = {
  ACCESS_COOKIE, REFRESH_COOKIE, env, configured, json, clean, parseCookies,
  setSessionCookies, clearSessionCookies, login, requireAdmin, db,
  normalizeVehicle, legacyVehicle, slugify, imageVariants, isAllowed,
  requireSameOrigin, timedFetch, logout, safeUrl
};
