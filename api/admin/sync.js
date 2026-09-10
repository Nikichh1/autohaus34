"use strict";

const { json, clean, requireAdmin, requireSameOrigin, db } = require("../../server/admin-lib");
const { discoverLiveCars, fetchVehicle } = require("../../server/autohaus-sync");

async function parseArray(response) {
  const raw = await response.text();
  if (!response.ok) throw new Error("Database returned HTTP " + response.status);
  const data = JSON.parse(raw || "[]");
  if (!Array.isArray(data)) throw new Error("Invalid database response");
  return data;
}

module.exports = async function handler(req, res) {
  if (!requireSameOrigin(req, res)) return;
  const user = await requireAdmin(req, res);
  if (!user) return json(res, 401, { ok:false, error:"Authentication required" });

  const action = clean((req.query && req.query.action) || "discover", 30).toLowerCase();

  try {
    if (req.method === "GET" && action === "discover") {
      const slugs = await discoverLiveCars();
      return json(res, 200, { ok:true, total:slugs.length, slugs });
    }

    if (req.method !== "POST") return json(res, 405, { ok:false, error:"Method not allowed" });

    if (action === "vehicle") {
      const body = req.body && typeof req.body === "object" ? req.body : {};
      const slug = clean(body.slug, 180).toLowerCase();
      const sortOrder = Number(body.sort_order) || 0;
      if (!/^[a-z0-9-]{1,180}$/.test(slug)) return json(res, 400, { ok:false, error:"Invalid vehicle slug" });

      const currentResponse = await db("vehicles?slug=eq." + encodeURIComponent(slug) + "&select=*", { method:"GET" });
      const currentRows = await parseArray(currentResponse);
      const existing = currentRows[0] || null;
      const row = await fetchVehicle(slug, existing, sortOrder);

      const upsert = await db("vehicles?on_conflict=slug", {
        method:"POST",
        headers:{ Prefer:"resolution=merge-duplicates,return=representation" },
        body:JSON.stringify(row)
      });
      const saved = await parseArray(upsert);
      return json(res, 200, {
        ok:true,
        slug,
        created:!existing,
        full_name:row.full_name,
        images:row.images.length,
        equipment:row.equipment_bg.length,
        id:saved[0] && saved[0].id
      });
    }

    if (action === "finalize") {
      // Re-read the origin here instead of trusting the browser's earlier list.
      // A sold car disappearing midway through a long sync is therefore removed.
      const liveSlugs = await discoverLiveCars();
      const live = new Set(liveSlugs);
      const currentResponse = await db("vehicles?select=slug", { method:"GET" });
      const current = await parseArray(currentResponse);
      const stale = current.map(r => r.slug).filter(slug => !live.has(slug));

      for (const slug of stale) {
        const del = await db("vehicles?slug=eq." + encodeURIComponent(slug), {
          method:"DELETE",
          headers:{ Prefer:"return=minimal" }
        });
        if (!del.ok) throw new Error("Could not remove stale listing " + slug);
      }

      return json(res, 200, { ok:true, total:liveSlugs.length, removed:stale.length, removed_slugs:stale });
    }

    return json(res, 400, { ok:false, error:"Unknown sync action" });
  } catch (err) {
    console.error("AutoHaus live sync failed", action, err);
    return json(res, 502, { ok:false, error:err && err.message ? err.message : "Live sync failed" });
  }
};
