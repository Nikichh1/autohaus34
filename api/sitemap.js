"use strict";
const { configured, db } = require("../server/admin-lib");
module.exports = async function handler(req, res) {
  if (req.method !== "GET") { res.statusCode=405; return res.end("Method not allowed"); }
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "autohaus24.vercel.app").split(",")[0].trim();
  const origin = "https://" + host.replace(/^https?:\/\//i, "");
  const urls = [origin + "/", origin + "/legal.html"];
  try {
    if (configured()) {
      const [r, settings] = await Promise.all([
        db("vehicles?published=eq.true&select=slug,updated_at&order=updated_at.desc"),
        db("admin_settings?singleton=eq.true&select=inquiry_enabled&limit=1")
      ]);
      const [rows, settingRows] = await Promise.all([r.json(), settings.json()]);
      if (settings.ok && Array.isArray(settingRows) && settingRows[0] && settingRows[0].inquiry_enabled === true) urls.push(origin + "/concierge.html");
      if (r.ok && Array.isArray(rows)) rows.forEach(v => { if (/^[a-z0-9-]+$/.test(String(v.slug||""))) urls.push(origin + "/vehicle.html?id=" + encodeURIComponent(v.slug)); });
    } else urls.push(origin + "/concierge.html");
  } catch (_) { /* Do not advertise a possibly disabled route during an outage. */ }
  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
    urls.map(u => '<url><loc>' + String(u).replace(/&/g,'&amp;') + '</loc></url>').join('') +
    '</urlset>';
  res.statusCode=200;res.setHeader("Content-Type","application/xml; charset=utf-8");res.setHeader("Cache-Control","public, max-age=300, s-maxage=300");res.end(xml);
};
