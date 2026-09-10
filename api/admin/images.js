"use strict";

const crypto = require("crypto");
const {
  json, clean, env, requireAdmin, requireSameOrigin, imageVariants, timedFetch, db
} = require("../../server/admin-lib");

function cloudReady() {
  return !!(env("CLOUDINARY_CLOUD_NAME") && env("CLOUDINARY_API_KEY") && env("CLOUDINARY_API_SECRET"));
}

function sign(params) {
  const raw = Object.keys(params).sort().map((k) => k + "=" + params[k]).join("&") + env("CLOUDINARY_API_SECRET");
  return crypto.createHash("sha1").update(raw).digest("hex");
}

module.exports = async function handler(req, res) {
  if (!requireSameOrigin(req, res)) return;
  const user = await requireAdmin(req, res);
  if (!user) return json(res, 401, { ok: false, error: "Authentication required" });
  if (!cloudReady()) return json(res, 503, { ok: false, error: "Cloudinary is not configured" });
  if (req.method !== "POST") return json(res, 405, { ok: false, error: "Method not allowed" });

  const action = clean((req.query && req.query.action) || "sign", 30).toLowerCase();
  const cloud = env("CLOUDINARY_CLOUD_NAME");
  const apiKey = env("CLOUDINARY_API_KEY");

  if (action === "sign") {
    const timestamp = Math.floor(Date.now() / 1000);
    const folder = "autohaus/vehicles";
    const eager = [
      "a_auto/c_lpad,b_white,w_400,h_245,q_auto:good,f_jpg,fl_progressive",
      "a_auto/c_lpad,b_white,w_800,h_490,q_auto:good,f_jpg,fl_progressive",
      "a_auto/c_lpad,b_white,w_1280,h_784,q_auto:good,f_jpg,fl_progressive",
      "a_auto/c_lpad,b_white,w_400,h_245,q_auto:good,f_webp",
      "a_auto/c_lpad,b_white,w_800,h_490,q_auto:good,f_webp",
      "a_auto/c_lpad,b_white,w_1280,h_784,q_auto:good,f_webp"
    ].join("|");
    const params = { eager, folder, timestamp, overwrite: "false", allowed_formats: "jpg,jpeg,png,webp,avif,heic,heif,tiff,bmp" };
    return json(res, 200, {
      ok: true,
      cloud_name: cloud,
      api_key: apiKey,
      timestamp,
      folder,
      eager,
      params,
      signature: sign(params),
      upload_url: "https://api.cloudinary.com/v1_1/" + encodeURIComponent(cloud) + "/image/upload"
    });
  }

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const publicId = clean(body.public_id, 500);
  if (!/^auto(?:haus|-house)\/vehicles\/[a-zA-Z0-9_-]+$/.test(publicId)) return json(res, 400, { ok: false, error: "Invalid vehicle image" });

  if (action === "complete") {
    const version = Number(body.version);
    const supplied = clean(body.signature, 80);
    const expected = sign({ public_id: publicId, version });
    if (!Number.isSafeInteger(version) || version <= 0 || !/^[a-f0-9]{40}$/i.test(supplied) ||
        !crypto.timingSafeEqual(Buffer.from(supplied.toLowerCase()), Buffer.from(expected))) {
      return json(res, 400, { ok: false, error: "Photo upload could not be verified. Please upload it again." });
    }
    return json(res, 200, {
      ok: true,
      image: {
        id: clean(body.asset_id, 180) || crypto.randomUUID(),
        public_id: publicId,
        original: "https://res.cloudinary.com/" + encodeURIComponent(cloud) + "/image/upload/a_auto/c_lpad,b_white,w_2000,h_2000,q_auto:good,f_auto/v" + version + "/" + publicId,
        width: Number(body.width) || null,
        height: Number(body.height) || null,
        legacy: false,
        variants: imageVariants(publicId)
      }
    });
  }

  if (action === "delete") {
    const timestamp = Math.floor(Date.now() / 1000);
    const params = { invalidate: "true", public_id: publicId, timestamp };
    const form = new URLSearchParams();
    form.set("public_id", publicId);
    form.set("timestamp", String(timestamp));
    form.set("invalidate", "true");
    form.set("api_key", apiKey);
    form.set("signature", sign(params));
    try {
      const used = await db("vehicles?select=id&limit=1&images=cs." + encodeURIComponent(JSON.stringify([{ public_id: publicId }])), { method: "GET" });
      const references = await used.json().catch(() => null);
      if (!used.ok || !Array.isArray(references)) return json(res, 503, { ok: false, error: "Could not verify photo usage. Please try again." });
      if (references.length) return json(res, 409, { ok: false, error: "Save the vehicle before deleting this photo.", code: "IMAGE_IN_USE" });
      const r = await timedFetch("https://api.cloudinary.com/v1_1/" + encodeURIComponent(cloud) + "/image/destroy", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form.toString()
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) return json(res, 502, { ok: false, error: "Cloudinary delete failed" });
      return json(res, 200, { ok: true, result: data.result || "ok" });
    } catch (err) {
      console.error("Cloudinary delete failed", err);
      return json(res, 502, { ok: false, error: "Image service unavailable" });
    }
  }

  return json(res, 400, { ok: false, error: "Unknown action" });
};
