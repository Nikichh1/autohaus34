"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { db } = require("./admin-lib");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLOTS = ["hero-0", "hero-1", "hero-2", "hero-3", "hero-4", "wall-care", "wall-servis", "wall-lizing", "wall-zastrahovki", "wall-cafe"];
const STORAGE_URL = "https://ajoiqomflplhadyhxvfe.supabase.co";
const STORAGE_KEY = "sb_publishable_gBEUBrOjT_JsBRjAnGL9PQ_ra-1hY0g";
const BUCKET = "vehicle-images";
function dimensions(width, height) {
  return Number.isInteger(width) && Number.isInteger(height) && width >= 64 && height >= 64 && width <= 1920 && height <= 1920;
}
function assetPlan(row) {
  if (!UUID.test(row.id || "") || !SLOTS.includes(row.slot) || !dimensions(row.width, row.height)) throw new Error("Invalid homepage image");
  const root = "site-media/" + row.id;
  const widths = [...new Set([640, 1280, 1920].map(w => Math.min(w, row.width)))].sort((a, b) => a - b);
  const background = row.slot.startsWith("hero-") ? [{ key: "background", path: root + "/bg.jpg", width: Math.min(320, row.width), type: "image/jpeg" }] : [];
  return background.concat(widths.flatMap(width => [
    { key: "jpg" + width, path: root + "/" + width + ".jpg", width, type: "image/jpeg" },
    { key: "webp" + width, path: root + "/" + width + ".webp", width, type: "image/webp" }
  ]));
}
function publicImage(row) {
  const plan = assetPlan(row), urls = Object.fromEntries(plan.map(a => [a.key, STORAGE_URL + "/storage/v1/object/public/" + BUCKET + "/" + a.path]));
  const widths = plan.filter(a => a.type === "image/jpeg" && a.key !== "background").map(a => a.width);
  const largest = widths[widths.length - 1];
  return { id: row.id, slot: row.slot, width: row.width, height: row.height, background: urls.background || urls["jpg" + widths[0]],
    src: urls["jpg" + largest], jpg: widths.map(w => urls["jpg" + w] + " " + w + "w").join(", "),
    webp: widths.map(w => urls["webp" + w] + " " + w + "w").join(", "), preview: urls["jpg" + widths[0]] };
}
function publicMedia(rows) {
  const out = {};
  for (const row of Array.isArray(rows) ? rows : []) {
    try { out[row.slot] = publicImage(row); } catch (_) { /* Never inject malformed/provider URLs into the public HTML. */ }
  }
  return out;
}
async function settingsRow() {
  const result = await db("public_admin_settings?singleton=eq.true&select=*&limit=1", { method: "GET" });
  if (!result.ok) throw new Error("Homepage settings unavailable");
  const rows = await result.json();
  return rows[0] || {};
}
function attr(tag, name, value) {
  const safe = String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  const pattern = new RegExp("(?<![\\w-])" + name + '="[^"]*"');
  return pattern.test(tag) ? tag.replace(pattern, name + '="' + safe + '"') : tag.replace(/\s*\/?>(?=$)/, ' ' + name + '="' + safe + '">');
}
function renderHTML(html, media) {
  return html.replace(/<picture\b[^>]*data-home-slot="([^"]+)"[^>]*>[\s\S]*?<\/picture>/g, (picture, slot) => {
    const image = media[slot];
    if (!image) return picture;
    return picture.replace(/<source\b[^>]*>|<img\b[^>]*>/g, tag => {
      const lazy = /\bdata-src(?:set)?=/.test(tag), isImg = /^<img\b/.test(tag);
      tag = attr(tag, lazy ? "data-srcset" : "srcset", isImg ? image.jpg : image.webp);
      if (isImg) {
        tag = attr(tag, lazy ? "data-src" : "src", image.src);
        tag = attr(attr(tag, "width", image.width), "height", image.height);
        // Uploaded content is not necessarily the same scene as the factory photo.
        const titles = {"wall-care":"Автомивка","wall-servis":"Сервиз","wall-lizing":"Лизинг","wall-zastrahovki":"Застраховки","wall-cafe":"Кафе бар"};
        tag = attr(tag, "alt", slot.startsWith("hero-") ? "AutoHaus" : "AutoHaus — " + titles[slot]);
        if (/style="[^"]*object-position:/.test(tag)) tag = tag.replace(/object-position:[^";]+/, "object-position:50% 50%");
      }
      return tag;
    }).replace(/<picture\b[^>]*>/, tag => attr(tag, "data-home-id", image.id));
  }).replace(/<img\b[^>]*data-home-bg="([^"]+)"[^>]*>/g, (tag, slot) => media[slot] ? attr(tag, /\bdata-src=/.test(tag) ? "data-src" : "src", media[slot].background) : tag)
    .replace(/<link\b[^>]*data-home-preload="([^"]+)"[^>]*>/g, (tag, kind) => {
      const image = media["hero-0"];
      if (!image) return tag;
      if (kind === "background") return attr(tag, "href", image.background);
      return attr(attr(tag, "href", image.webp.split(" ")[0]), "imagesrcset", image.webp);
    });
}
let template;
function homeTemplate() {
  if (!template) {
    const file = [path.join(process.cwd(), "dist/index.html"), path.join(__dirname, "../dist/index.html"), path.join(__dirname, "../index.html")].find(p => fs.existsSync(p));
    if (!file) throw new Error("Homepage template unavailable");
    template = fs.readFileSync(file, "utf8");
  }
  return template;
}
async function serveHome(req, res) {
  const html = homeTemplate();
  let media = {};
  try { media = publicMedia((await settingsRow()).homepage_media); } catch (error) { console.error(error.message); }
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=0, s-maxage=15, stale-while-revalidate=30");
  res.setHeader("X-Robots-Tag", "index, follow");
  res.end(renderHTML(html, media));
}
module.exports = { UUID, SLOTS, BUCKET, STORAGE_URL, STORAGE_KEY, dimensions, assetPlan, publicImage, publicMedia, settingsRow, renderHTML, serveHome };
