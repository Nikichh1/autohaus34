"use strict";

const crypto = require("crypto");
const {
  ACCESS_COOKIE, json, clean, parseCookies, requireAdmin, requireSameOrigin, timedFetch, databaseFor
} = require("../../server/admin-lib");

const SUPABASE_URL = "https://ajoiqomflplhadyhxvfe.supabase.co";
const SUPABASE_KEY = "sb_publishable_gBEUBrOjT_JsBRjAnGL9PQ_ra-1hY0g";
const BUCKET = "vehicle-images";
const RESPONSIVE_SUFFIXES = Object.freeze({
  original: "",
  jpg400: "-400.jpg",
  jpg800: "-800.jpg",
  jpg1280: "-1280.jpg",
  webp400: "-400.webp",
  webp800: "-800.webp",
  webp1280: "-1280.webp"
});

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

function responsivePaths(root) {
  return Object.fromEntries(Object.entries(RESPONSIVE_SUFFIXES).map(([key, suffix]) => [key, root + suffix]));
}

function uploadDimension(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 && number <= 1600 ? number : null;
}

async function signPath(access, path) {
  const endpoint = SUPABASE_URL + "/storage/v1/object/upload/sign/" + BUCKET + "/" + encodePath(path);
  const r = await timedFetch(endpoint, {
    method: "POST",
    headers: storageHeaders(access),
    body: "{}"
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data.url) {
    const error = new Error("Photo upload could not be prepared");
    error.status = r.status;
    error.detail = data && data.message;
    throw error;
  }
  return {
    path,
    upload_url: SUPABASE_URL + "/storage/v1" + data.url
  };
}

module.exports = async function handler(req, res) {
  if (!requireSameOrigin(req, res)) return;
  const user = await requireAdmin(req, res);
  if (!user) return json(res, 401, { ok: false, error: "Authentication required" });
  const db = databaseFor(req);
  if (user.adminRole === "viewer") return json(res, 403, { ok: false, error: "Your role cannot perform this action." });
  if (req.method !== "POST") return json(res, 405, { ok: false, error: "Method not allowed" });

  const action = clean((req.query && req.query.action) || "sign", 30).toLowerCase();
  const access = currentAccess(req, res);
  if (!access) return json(res, 401, { ok: false, error: "Authentication required" });
  const body = req.body && typeof req.body === "object" ? req.body : {};

  if (action === "sign") {
    const root = "vehicles/" + crypto.randomUUID();
    const responsive = body.responsive === true;
    try {
      if (responsive) {
        const paths = responsivePaths(root);
        const signed = await Promise.all(Object.entries(paths).map(async ([key, path]) => [key, await signPath(access, path)]));
        return json(res, 200, {
          ok: true,
          provider: "supabase",
          responsive: true,
          public_id: root,
          uploads: Object.fromEntries(signed),
          headers: { apikey: SUPABASE_KEY },
          signature: "",
          params: {}
        });
      }
      const signed = await signPath(access, root);
      return json(res, 200, {
        ok: true,
        provider: "supabase",
        upload_url: signed.upload_url,
        public_id: root,
        headers: { apikey: SUPABASE_KEY },
        signature: "",
        params: {}
      });
    } catch (err) {
      console.error("Supabase signed upload failed", err.status || "network", err.detail || err.message);
      return json(res, err.status === 401 || err.status === 403 ? 401 : 502, { ok: false, error: "Photo upload could not be prepared" });
    }
  }

  const path = clean(body.supabase_path || body.public_id, 500);
  if (!validPath(path)) return json(res, 400, { ok: false, error: "Invalid vehicle image" });

  if (action === "complete") {
    try {
      const responsive = body.responsive === true;
      const width = uploadDimension(body.width);
      const height = uploadDimension(body.height);
      if (responsive && (!width || !height)) return json(res, 400, { ok: false, error: "Invalid photo dimensions" });
      const paths = responsive ? responsivePaths(path) : { original: path };
      const checks = await Promise.all(Object.values(paths).map(async (objectPath) => ({
        path: objectPath,
        response: await timedFetch(publicUrl(objectPath), { method: "HEAD", cache: "no-store" }, 10000)
      })));
      if (checks.some((check) => !check.response.ok)) {
        return json(res, 400, { ok: false, error: "Photo upload could not be verified. Please upload it again." });
      }
      const original = publicUrl(paths.original);
      const variants = responsive ? {
        jpg400: publicUrl(paths.jpg400),
        jpg800: publicUrl(paths.jpg800),
        jpg1280: publicUrl(paths.jpg1280),
        webp400: publicUrl(paths.webp400),
        webp800: publicUrl(paths.webp800),
        webp1280: publicUrl(paths.webp1280)
      } : {
        jpg400: original,
        jpg800: original,
        jpg1280: original,
        webp400: original,
        webp800: original,
        webp1280: original
      };
      return json(res, 200, {
        ok: true,
        image: {
          id: crypto.randomUUID(),
          public_id: path,
          original,
          width,
          height,
          legacy: false,
          variants
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

      const responsive = body.responsive === true;
      const objectPaths = responsive ? Object.values(responsivePaths(path)) : [path];
      const deletions = await Promise.all(objectPaths.map(async (objectPath) => {
        const endpoint = SUPABASE_URL + "/storage/v1/object/" + BUCKET + "/" + encodePath(objectPath);
        const response = await timedFetch(endpoint, {
          method: "DELETE",
          headers: storageHeaders(access)
        });
        return { objectPath, response };
      }));
      const failed = deletions.find((deletion) => !deletion.response.ok && deletion.response.status !== 404);
      if (failed) {
        const detail = await failed.response.text().catch(() => "");
        console.error("Supabase image delete failed", failed.response.status, failed.objectPath, detail.slice(0, 200));
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
