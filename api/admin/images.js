"use strict";

const crypto = require("crypto");
const {
  ACCESS_COOKIE, json, clean, parseCookies, requireAdmin, requireSameOrigin, timedFetch, db
} = require("../../server/admin-lib");

const SUPABASE_URL = "https://ajoiqomflplhadyhxvfe.supabase.co";
const SUPABASE_KEY = "sb_publishable_gBEUBrOjT_JsBRjAnGL9PQ_ra-1hY0g";
const BUCKET = "vehicle-images";

function currentAccess(req, res) {
  let access = parseCookies(req)[ACCESS_COOKIE] || "";
  const setCookie = res.getHeader && res.getHeader("Set-Cookie");
  const values = Array.isArray(setCookie) ? setCookie : setCookie ? [String(setCookie)] : [];
  for (const value of values) {
    if (!String(value).startsWith(ACCESS_COOKIE + "=")) continue;
    const raw = String(value).slice(ACCESS_COOKIE.length + 1).split(";")[0];
    try { access = decodeURIComponent(raw); } catch (_) { access = raw; }
  }
  return access;
}

function storageHeaders(access, extra) {
  return Object.assign({
    apikey: SUPABASE_KEY,
    Authorization: "Bearer " + access,
    "Content-Type": "application/json"
  }, extra || {});
}

function encodePath(path) {
  return path.split("/").map(encodeURIComponent).join("/");
}

function validPath(path) {
  return /^vehicles\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(path);
}

function publicUrl(path) {
  return SUPABASE_URL + "/storage/v1/object/public/" + BUCKET + "/" + encodePath(path);
}

module.exports = async function handler(req, res) {
  if (!requireSameOrigin(req, res)) return;
  const user = await requireAdmin(req, res);
  if (!user) return json(res, 401, { ok: false, error: "Authentication required" });
  if (req.method !== "POST") return json(res, 405, { ok: false, error: "Method not allowed" });

  const action = clean((req.query && req.query.action) || "sign", 30).toLowerCase();
  const access = currentAccess(req, res);
  if (!access) return json(res, 401, { ok: false, error: "Authentication required" });

  if (action === "sign") {
    const path = "vehicles/" + crypto.randomUUID();
    try {
      const endpoint = SUPABASE_URL + "/storage/v1/object/upload/sign/" + BUCKET + "/" + encodePath(path);
      const r = await timedFetch(endpoint, {
        method: "POST",
        headers: storageHeaders(access),
        body: "{}"
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || !data.url) {
        console.error("Supabase signed upload failed", r.status, data && data.message);
        return json(res, r.status === 401 || r.status === 403 ? 401 : 502, { ok: false, error: "Photo upload could not be prepared" });
      }
      const uploadUrl = SUPABASE_URL + "/storage/v1" + data.url;
      return json(res, 200, {
        ok: true,
        provider: "supabase",
        upload_url: uploadUrl,
        public_id: path,
        api_key: "",
        signature: "",
        params: {}
      });
    } catch (err) {
      console.error("Supabase signed upload failed", err);
      return json(res, 502, { ok: false, error: "Image service unavailable" });
    }
  }

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const path = clean(body.supabase_path || body.public_id, 500);
  if (!validPath(path)) return json(res, 400, { ok: false, error: "Invalid vehicle image" });

  if (action === "complete") {
    try {
      const original = publicUrl(path);
      const check = await timedFetch(original, { method: "HEAD" }, 10000);
      if (!check.ok) return json(res, 400, { ok: false, error: "Photo upload could not be verified. Please upload it again." });
      return json(res, 200, {
        ok: true,
        image: {
          id: crypto.randomUUID(),
          public_id: path,
          original,
          width: Number(body.width) || null,
          height: Number(body.height) || null,
          legacy: false,
          variants: {
            jpg400: original,
            jpg800: original,
            jpg1280: original,
            webp400: original,
            webp800: original,
            webp1280: original
          }
        }
      });
    } catch (err) {
      console.error("Supabase upload verification failed", err);
      return json(res, 502, { ok: false, error: "Photo upload could not be verified" });
    }
  }

  if (action === "delete") {
    try {
      const used = await db("vehicles?select=id&limit=1&images=cs." + encodeURIComponent(JSON.stringify([{ public_id: path }])), { method: "GET" });
      const references = await used.json().catch(() => null);
      if (!used.ok || !Array.isArray(references)) return json(res, 503, { ok: false, error: "Could not verify photo usage. Please try again." });
      if (references.length) return json(res, 409, { ok: false, error: "Save the vehicle before deleting this photo.", code: "IMAGE_IN_USE" });

      const endpoint = SUPABASE_URL + "/storage/v1/object/" + BUCKET + "/" + encodePath(path);
      const r = await timedFetch(endpoint, {
        method: "DELETE",
        headers: storageHeaders(access)
      });
      if (!r.ok && r.status !== 404) {
        const detail = await r.text().catch(() => "");
        console.error("Supabase image delete failed", r.status, detail.slice(0, 200));
        return json(res, 502, { ok: false, error: "Image delete failed" });
      }
      return json(res, 200, { ok: true, result: "ok" });
    } catch (err) {
      console.error("Supabase image delete failed", err);
      return json(res, 502, { ok: false, error: "Image service unavailable" });
    }
  }

  return json(res, 400, { ok: false, error: "Unknown action" });
};
