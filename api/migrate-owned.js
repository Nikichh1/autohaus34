"use strict";

const { discoverLiveCars, fetchVehicle } = require("../server/autohaus-sync");

const SUPABASE_URL = "https://ajoiqomflplhadyhxvfe.supabase.co";
const SUPABASE_KEY = "sb_publishable_gBEUBrOjT_JsBRjAnGL9PQ_ra-1hY0g";
const BUCKET = "vehicle-images";
const KEY = "AH-MIG-20260920-8f31d9c20b7a4ed0";
const PREFIX = "owned-mig-8f31d9c20b7a4ed0/";

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
  res.end(JSON.stringify(body));
}
function headers(extra) {
  return Object.assign({ apikey: SUPABASE_KEY, "Content-Type": "application/json" }, extra || {});
}
function encodePath(path) {
  return String(path).split("/").map(encodeURIComponent).join("/");
}
async function readRows(path) {
  const r = await fetch(SUPABASE_URL + "/rest/v1/" + path, { headers: headers() });
  const data = await r.json().catch(() => []);
  if (!r.ok || !Array.isArray(data)) throw new Error("Database read failed (" + r.status + ")");
  return data;
}
async function write(action, row, slug) {
  const r = await fetch(SUPABASE_URL + "/rest/v1/rpc/autohaus_temp_migration_write", {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ p_token: KEY, p_action: action, p_row: row || null, p_slug: slug || null })
  });
  const data = await r.json().catch(() => null);
  if (!r.ok) throw new Error("Migration write failed (" + r.status + "): " + JSON.stringify(data).slice(0, 300));
  return data;
}
function extension(url, type) {
  const m = String(url || "").match(/\.([a-z0-9]+)(?:\?|$)/i);
  let ext = m ? m[1].toLowerCase() : "";
  if (ext === "jpeg") ext = "jpg";
  if (!["jpg", "png", "webp"].includes(ext)) {
    ext = /png/i.test(type) ? "png" : /webp/i.test(type) ? "webp" : "jpg";
  }
  return ext;
}
async function copyOne(slug, source, index) {
  const r = await fetch(source, {
    redirect: "follow",
    headers: {
      Accept: "image/avif,image/webp,image/*,*/*;q=0.8",
      "User-Agent": "AutoHaus inventory ownership migration/1.0"
    }
  });
  if (!r.ok) throw new Error(slug + " image " + (index + 1) + " source HTTP " + r.status);
  const type = r.headers.get("content-type") || "image/jpeg";
  if (!/^image\//i.test(type)) throw new Error(slug + " image " + (index + 1) + " is not an image");
  const bytes = await r.arrayBuffer();
  if (!bytes.byteLength || bytes.byteLength > 45 * 1024 * 1024) throw new Error(slug + " image " + (index + 1) + " has invalid size");
  const ext = extension(source, type);
  const path = PREFIX + slug + "/" + String(index + 1).padStart(2, "0") + "." + ext;
  const upload = await fetch(SUPABASE_URL + "/storage/v1/object/" + BUCKET + "/" + encodePath(path), {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      "Content-Type": type,
      "x-upsert": "true",
      "cache-control": "31536000"
    },
    body: bytes
  });
  const detail = await upload.text().catch(() => "");
  if (!upload.ok) throw new Error(slug + " image " + (index + 1) + " upload HTTP " + upload.status + " " + detail.slice(0, 160));
  return {
    id: slug + "-owned-" + (index + 1),
    public_id: path,
    original: SUPABASE_URL + "/storage/v1/object/public/" + BUCKET + "/" + encodePath(path),
    source_original: source,
    width: null,
    height: null,
    legacy: false,
    embedded_watermark: false,
    position: index,
    variants: {}
  };
}
async function copyImages(slug, sourceImages) {
  const sources = (sourceImages || []).map(x => x && x.original).filter(Boolean);
  if (!sources.length) throw new Error("No source images for " + slug);
  const out = new Array(sources.length);
  let cursor = 0;
  async function worker() {
    while (cursor < sources.length) {
      const i = cursor++;
      out[i] = await copyOne(slug, sources[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, sources.length) }, worker));
  return out;
}
async function migrateOne(slug, sortOrder) {
  const existingRows = await readRows("vehicles?slug=eq." + encodeURIComponent(slug) + "&select=*&limit=1");
  const existing = existingRows[0] || null;
  const row = await fetchVehicle(slug, existing, sortOrder);
  row.images = await copyImages(slug, row.images);
  row.published = true;
  row.sort_order = sortOrder;
  if (!Array.isArray(row.notes_en)) row.notes_en = Array.isArray(existing && existing.notes_en) ? existing.notes_en : [];
  const saved = await write("upsert", row, slug);
  return { slug, full_name: row.full_name, images: row.images.length, published: true, id: saved && saved.id };
}
function owned(images) {
  return Array.isArray(images) && images.length > 0 && images.every(img =>
    String(img && img.original || "").startsWith(SUPABASE_URL + "/storage/v1/object/public/" + BUCKET + "/" + PREFIX)
  );
}

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "GET") return json(res, 405, { ok: false, error: "GET only" });
    if (!req.query || req.query.k !== KEY) return json(res, 403, { ok: false, error: "Forbidden" });
    const action = String(req.query.action || "status");
    const live = await discoverLiveCars();

    if (action === "discover") return json(res, 200, { ok: true, count: live.length, slugs: live });

    if (action === "batch") {
      const offset = Math.max(0, Number(req.query.offset) || 0);
      const limit = Math.max(1, Math.min(3, Number(req.query.limit) || 2));
      const slice = live.slice(offset, offset + limit);
      const done = [];
      for (let i = 0; i < slice.length; i++) done.push(await migrateOne(slice[i], offset + i + 1));
      return json(res, 200, {
        ok: true, total: live.length, offset, processed: done,
        next: offset + slice.length, complete: offset + slice.length >= live.length
      });
    }

    const rows = await readRows("vehicles?select=slug,images,published,source_url");
    const bySlug = new Map(rows.map(r => [r.slug, r]));
    const missing = live.filter(slug => !bySlug.has(slug));
    const badImages = live.filter(slug => bySlug.has(slug) && !owned(bySlug.get(slug).images));

    if (action === "status") {
      const wordpress = rows.filter(r => Array.isArray(r.images) && r.images.some(img => /autohaus\.bg\/wp-content/i.test(String(img && img.original || "")))).map(r => r.slug);
      return json(res, 200, { ok: true, live: live.length, db: rows.length, missing, bad_images: badImages, wordpress_image_rows: wordpress });
    }

    if (action === "finalize") {
      if (missing.length || badImages.length) return json(res, 409, { ok: false, error: "Migration incomplete", missing, bad_images: badImages });
      const keep = new Set(live);
      const stale = rows.filter(r => !keep.has(r.slug)).map(r => r.slug);
      for (const slug of stale) await write("delete", null, slug);
      return json(res, 200, { ok: true, live: live.length, removed: stale.length, removed_slugs: stale });
    }

    return json(res, 400, { ok: false, error: "Unknown action" });
  } catch (err) {
    console.error("Ownership migration failed", err);
    return json(res, 500, { ok: false, error: err && err.message ? err.message : String(err) });
  }
};
