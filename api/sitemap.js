"use strict";
const { configured, db } = require("../server/admin-lib");
module.exports = async function handler(req, res) {
  if (req.method !== "GET") { res.statusCode=405; return res.end("Method not allowed"); }
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "autohaus24.vercel.app").split(",")[0].trim();
  const origin = "https://" + host.replace(/^https?:\/\//i, "");
  const urls = [origin + "/", origin + "/concierge.html", origin + "/legal.html"];
  try {
    if (configured()) {
      const r = await db("vehicles?published=eq.true&select=slug,updated_at&order=updated_at.desc");
      const rows = await r.json();
      if (r.ok && Array.isArray(rows)) rows.forEach(v => { if (/^[a-z0-9-]+$/.test(String(v.slug||""))) urls.push(origin + "/vehicle.html?id=" + encodeURIComponent(v.slug)); });
    }
  } catch (_) {}
  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
    urls.map(u => '<url><loc>' + String(u).replace(/&/g,'&amp;') + '</loc></url>').join('') +
    '</urlset>';
  res.statusCode=200;res.setHeader("Content-Type","application/xml; charset=utf-8");res.setHeader("Cache-Control","public, max-age=300, s-maxage=300");res.end(xml);
};
