"use strict";
const crypto = require("node:crypto");
const { requireAdmin, requireSameOrigin, json, databaseFor, timedFetch, clean } = require("../../server/admin-lib");
const { UUID, SLOTS, BUCKET, STORAGE_URL, STORAGE_KEY, dimensions, assetPlan, publicImage } = require("../../server/homepage-media");
async function data(response) {
  const value = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(value.message || "Image service unavailable");
    error.status = /STALE_IMAGE|IMAGE_ACTIVE|IMAGE_BUSY/.test(error.message) ? 409 : response.status === 403 ? 403 : 502;
    throw error;
  }
  return value;
}
function storageHeaders(req) { return { apikey: STORAGE_KEY, Authorization: "Bearer " + req.adminAccess, "Content-Type": "application/json" }; }
module.exports = async function handler(req, res) {
  if (!requireSameOrigin(req, res)) return;
  const user = await requireAdmin(req, res);
  if (!user) return json(res, 401, { ok: false, error: "Authentication required" });
  if (!["GET", "POST"].includes(req.method)) return json(res, 405, { ok: false, error: "Method not allowed" });
  const db = databaseFor(req), body = req.body && typeof req.body === "object" ? req.body : {};
  const action = req.method === "GET" ? "list" : clean(req.query && req.query.action, 24);
  if (req.method !== "GET" && user.adminRole === "viewer") return json(res, 403, { ok: false, error: "Read-only access" });
  if (action === "delete" && !["owner", "admin"].includes(user.adminRole)) return json(res, 403, { ok: false, error: "Only an owner or administrator can permanently delete photos." });
  try {
    if (action === "list") {
      const rows = await data(await db("homepage_images?select=*&order=is_active.desc,created_at.desc&limit=1000", { method: "GET" }));
      return json(res, 200, { ok: true, images: rows.map(row => ({ ...row, image: publicImage(row) })), slots: SLOTS });
    }
    if (!SLOTS.includes(body.slot)) return json(res, 400, { ok: false, error: "Invalid image position" });
    const expected = body.expected_id;
    if (expected !== null && !UUID.test(expected || "")) return json(res, 400, { ok: false, error: "Reload the current photo before saving." });
    if (action === "sign") {
      if (!dimensions(body.width, body.height)) return json(res, 400, { ok: false, error: "Invalid optimized dimensions" });
      const row = { id: crypto.randomUUID(), slot: body.slot, width: body.width, height: body.height, file_name: clean(body.file_name, 180), created_by: user.id };
      await data(await db("homepage_images", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify(row) }));
      const plan = assetPlan(row);
      const uploads = await Promise.all(plan.map(async asset => {
        const signed = await data(await timedFetch(STORAGE_URL + "/storage/v1/object/upload/sign/" + BUCKET + "/" + asset.path, { method: "POST", headers: storageHeaders(req), body: "{}" }));
        if (typeof signed.url !== "string" || !signed.url.startsWith("/object/upload/sign/")) throw new Error("Invalid signed upload");
        return { ...asset, upload_url: STORAGE_URL + "/storage/v1" + signed.url };
      }));
      return json(res, 200, { ok: true, id: row.id, uploads, headers: { apikey: STORAGE_KEY } });
    }
    if (!["complete", "restore", "delete", "default"].includes(action)) return json(res, 400, { ok: false, error: "Unknown action" });
    if (action === "default") {
      await data(await db("rpc/activate_homepage_image", { method: "POST", body: JSON.stringify({ p_slot: body.slot, p_id: null, p_expected: expected, p_bytes: 0 }) }));
      return json(res, 200, { ok: true });
    }
    if (!UUID.test(body.id || "")) return json(res, 400, { ok: false, error: "Invalid image" });
    const rows = await data(await db("homepage_images?id=eq." + body.id + "&select=*&limit=1", { method: "GET" }));
    const row = rows[0];
    if (!row || row.slot !== body.slot) return json(res, 404, { ok: false, error: "Image not found" });
    if (action === "delete") {
      if (body.confirm_delete !== true) return json(res, 400, { ok: false, error: "Deletion confirmation required" });
      await data(await db("rpc/delete_homepage_image", { method: "POST", body: JSON.stringify({ p_id: row.id, p_finish: false }) }));
      // The server derives every path; no user-supplied bucket/path can reach a vehicle photo.
      const prefixes = assetPlan(row).map(a => a.path);
      await data(await timedFetch(STORAGE_URL + "/storage/v1/object/" + BUCKET, { method: "DELETE", headers: storageHeaders(req), body: JSON.stringify({ prefixes }) }));
      await data(await db("rpc/delete_homepage_image", { method: "POST", body: JSON.stringify({ p_id: row.id, p_finish: true }) }));
      return json(res, 200, { ok: true });
    }
    let bytes = 0;
    if (action === "complete") {
      if (row.created_by !== user.id || row.state !== "pending") return json(res, 409, { ok: false, error: "Photo has already been processed. Reload the archive." });
      const checks = await Promise.all(assetPlan(row).map(async asset => {
        const r = await timedFetch(STORAGE_URL + "/storage/v1/object/public/" + BUCKET + "/" + asset.path, { method: "HEAD", cache: "no-store" });
        const size = Number(r.headers.get("content-length"));
        if (!r.ok || r.headers.get("content-type").split(";")[0] !== asset.type || !Number.isInteger(size) || size <= 0 || size > 4 * 1024 * 1024) throw new Error("Photo upload could not be verified. The previous photo is unchanged.");
        return size;
      }));
      bytes = checks.reduce((sum, n) => sum + n, 0);
    } else if (row.state !== "ready") return json(res, 409, { ok: false, error: "This photo cannot be restored. Upload it again." });
    await data(await db("rpc/activate_homepage_image", { method: "POST", body: JSON.stringify({ p_slot: row.slot, p_id: row.id, p_expected: expected, p_bytes: bytes }) }));
    return json(res, 200, { ok: true, image: publicImage(row), byte_count: bytes || row.byte_count });
  } catch (error) {
    console.error("Homepage media", action, error.message);
    return json(res, error.status || 502, { ok: false, error: /STALE_IMAGE/.test(error.message) ? "Another administrator changed this photo. Reload and try again." : /IMAGE_ACTIVE/.test(error.message) ? "The photo is in use. Replace it before deleting it." : "The photo could not be processed. Reload and try again.", code: /STALE_IMAGE|IMAGE_ACTIVE|IMAGE_BUSY/.exec(error.message)?.[0] || "MEDIA_UNAVAILABLE" });
  }
};
