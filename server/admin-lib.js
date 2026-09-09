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
  res.end(JSON.stringify(body));
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
  return fetch(url, Object.assign({}, options || {}, { headers }));
}

async function login(email, password) {
  if (!configured()) throw new Error("Supabase is not configured");
  if (!allowedEmails().length) throw new Error("ADMIN_EMAILS is not configured");
  const r = await authFetch("token?grant_type=password", {
    method: "POST",
    body: JSON.stringify({ email: clean(email, 240), password: String(password || "") })
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data.access_token) return { ok: false, status: r.status || 401 };
  if (!data.user || !isAllowed(data.user.email)) return { ok: false, status: 403 };
  return { ok: true, session: data, user: data.user };
}

async function userForToken(access) {
  if (!access) return null;
  const r = await authFetch("user", { method: "GET", headers: { Authorization: "Bearer " + access } });
  if (!r.ok) return null;
  const user = await r.json().catch(() => null);
  return user && isAllowed(user.email) ? user : null;
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
  const cookies = parseCookies(req);
  let user = await userForToken(cookies[ACCESS_COOKIE]);
  if (user) return user;
  const refreshed = await refreshSession(cookies[REFRESH_COOKIE]);
  if (!refreshed) return null;
  setSessionCookies(req, res, refreshed);
  user = refreshed.user;
  return user && isAllowed(user.email) ? user : null;
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
  return fetch(url, Object.assign({}, options || {}, {
    headers: serviceHeaders((options && options.headers) || {})
  }));
}

function numberOrNull(v, integer) {
  if (v === "" || v == null) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return integer ? Math.round(n) : n;
}

function stringArray(v, maxItems) {
  const a = Array.isArray(v) ? v : [];
  return a.slice(0, maxItems || 200).map((x) => clean(x, 500)).filter(Boolean);
}

function sanitizeImages(v) {
  const a = Array.isArray(v) ? v : [];
  return a.slice(0, 80).map((img, i) => ({
    id: clean(img && img.id, 180) || crypto.randomUUID(),
    public_id: clean(img && img.public_id, 500),
    original: clean(img && img.original, 1200),
    width: numberOrNull(img && img.width, true),
    height: numberOrNull(img && img.height, true),
    legacy: !!(img && img.legacy),
    position: i,
    variants: img && typeof img.variants === "object" && img.variants ? {
      jpg400: clean(img.variants.jpg400, 1200),
      jpg800: clean(img.variants.jpg800, 1200),
      jpg1280: clean(img.variants.jpg1280, 1200),
      webp400: clean(img.variants.webp400, 1200),
      webp800: clean(img.variants.webp800, 1200),
      webp1280: clean(img.variants.webp1280, 1200)
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
    unregistered: !!body.unregistered,
    horsepower: numberOrNull(body.horsepower, true),
    price: numberOrNull(body.price, false),
    chapter: clean(body.chapter, 80),
    tags: stringArray(body.tags, 60),
    notes: stringArray(body.notes, 80),
    description_bg: clean(body.description_bg, 20000),
    description_en: clean(body.description_en, 20000),
    equipment_bg: stringArray(body.equipment_bg, 600),
    equipment_en: stringArray(body.equipment_en, 600),
    images: sanitizeImages(body.images),
    source_url: clean(body.source_url, 1200),
    published: !!body.published,
    updated_at: new Date().toISOString()
  };
  if (!row.slug || !row.make || !row.model) return { error: "Brand, model and slug are required." };
  if (row.first_registration_month != null && (row.first_registration_month < 1 || row.first_registration_month > 12)) {
    return { error: "First registration month must be 1-12." };
  }
  if (row.first_registration_year != null && (row.first_registration_year < 1900 || row.first_registration_year > 2100)) {
    return { error: "First registration year is invalid." };
  }
  return { row };
}

function legacyVehicle(row) {
  const images = Array.isArray(row.images) ? row.images : [];
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
  const base = "a_auto,c_fill,g_auto,q_auto:good";
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
  normalizeVehicle, legacyVehicle, slugify, imageVariants, isAllowed
};
