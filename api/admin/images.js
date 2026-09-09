"use strict";

const crypto = require("crypto");
const {
  json, clean, env, requireAdmin, imageVariants
} = require("../../server/admin-lib");

function cloudReady() {
  return !!(env("CLOUDINARY_CLOUD_NAME") && env("CLOUDINARY_API_KEY") && env("CLOUDINARY_API_SECRET"));
}

function sign(params) {
  const raw = Object.keys(params).sort().map((k) => k + "=" + params[k]).join("&") + env("CLOUDINARY_API_SECRET");
  return crypto.createHash("sha1").update(raw).digest("hex");
}

module.exports = async function handler(req, res) {
  const user = await requireAdmin(req, res);
  if (!user) return json(res, 401, { ok: false, error: "Authentication required" });
  if (!cloudReady()) return json(res, 503, { ok: false, error: "Cloudinary is not configured" });
  if (req.method !== "POST") return json(res, 405, { ok: false, error: "Method not allowed" });

  const action = clean((req.query && req.query.action) || "sign", 30).toLowerCase();
  const cloud = env("CLOUDINARY_CLOUD_NAME");
  const apiKey = env("CLOUDINARY_API_KEY");

  if (action === "sign") {
    const timestamp = Math.floor(Date.now() / 1000);
    const folder = "auto-house/vehicles";
    const eager = [
      "a_auto,c_fill,g_auto,w_400,h_245,q_auto:good,f_jpg,fl_progressive",
      "a_auto,c_fill,g_auto,w_800,h_490,q_auto:good,f_jpg,fl_progressive",
      "a_auto,c_fill,g_auto,w_1280,h_784,q_auto:good,f_jpg,fl_progressive",
      "a_auto,c_fill,g_auto,w_400,h_245,q_auto:good,f_webp",
      "a_auto,c_fill,g_auto,w_800,h_490,q_auto:good,f_webp",
      "a_auto,c_fill,g_auto,w_1280,h_784,q_auto:good,f_webp"
    ].join("|");
    const params = { eager, folder, timestamp };
    return json(res, 200, {
      ok: true,
      cloud_name: cloud,
      api_key: apiKey,
      timestamp,
      folder,
      eager,
      signature: sign(params),
      upload_url: "https://api.cloudinary.com/v1_1/" + encodeURIComponent(cloud) + "/image/upload"
    });
  }

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const publicId = clean(body.public_id, 500);
  if (!publicId) return json(res, 400, { ok: false, error: "public_id is required" });

  if (action === "complete") {
    return json(res, 200, {
      ok: true,
      image: {
        id: clean(body.asset_id, 180) || crypto.randomUUID(),
        public_id: publicId,
        original: clean(body.secure_url, 1200),
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
      const r = await fetch("https://api.cloudinary.com/v1_1/" + encodeURIComponent(cloud) + "/image/destroy", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form.toString()
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) return json(res, 502, { ok: false, error: "Cloudinary delete failed", detail: data });
      return json(res, 200, { ok: true, result: data.result || "ok" });
    } catch (err) {
      console.error("Cloudinary delete failed", err);
      return json(res, 502, { ok: false, error: "Image service unavailable" });
    }
  }

  return json(res, 400, { ok: false, error: "Unknown action" });
};
