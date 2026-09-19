"use strict";

const { timedFetch } = require("./admin-lib");

const ORIGIN = "https://autohaus.bg";
const ARCHIVE = ORIGIN + "/car/";
const MONTHS = {
  "януари":1,"февруари":2,"март":3,"април":4,"май":5,"юни":6,
  "юли":7,"август":8,"септември":9,"октомври":10,"ноември":11,"декември":12
};
const KNOWN_MAKES = [
  "Mercedes-Maybach","Mercedes-AMG","Mercedes-Benz","Rolls-Royce","Land Rover",
  "Volkswagen","Maserati","Porsche","Ferrari","Cadillac","Bentley","Toyota",
  "Jaguar","Skoda","Mazda","Audi","BMW"
];

function decodeEntities(value) {
  return String(value || "")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#8211;|&#x2013;/gi, "–")
    .replace(/&#8212;|&#x2014;/gi, "—")
    .replace(/&#8220;|&#x201c;/gi, "“")
    .replace(/&#8221;|&#x201d;/gi, "”")
    .replace(/&#(\d+);/g, (_, n) => {
      const code = Number(n); return Number.isFinite(code) ? String.fromCodePoint(code) : _;
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => {
      const code = parseInt(n, 16); return Number.isFinite(code) ? String.fromCodePoint(code) : _;
    });
}

function text(value) {
  return decodeEntities(String(value || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " "))
    .replace(/\r/g, "")
    .replace(/[\t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function fetchHtml(url) {
  const r = await timedFetch(url, {
    method: "GET",
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": "AutoHaus inventory sync/1.0"
    }
  }, 15000);
  if (!r.ok) throw new Error("AutoHaus returned HTTP " + r.status);
  return r.text();
}

function discoverFromHtml(html) {
  const seen = new Set(), cars = [];
  const re = /(?:https:\/\/autohaus\.bg)?\/car\/([a-z0-9-]+)\//gi;
  let m;
  while ((m = re.exec(html))) {
    const slug = m[1].toLowerCase();
    if (!seen.has(slug)) { seen.add(slug); cars.push(slug); }
  }
  return cars;
}

async function discoverLiveCars() {
  const html = await fetchHtml(ARCHIVE);
  const slugs = discoverFromHtml(html);
  if (slugs.length < 20) throw new Error("AutoHaus archive returned an implausibly small inventory");
  return slugs;
}

function extractTable(html) {
  const table = (html.match(/<div[^>]+class=["'][^"']*table-resp[^"']*["'][^>]*>[\s\S]*?<table[^>]*>([\s\S]*?)<\/table>/i) || [])[1] || "";
  const out = {};
  const rowRe = /<tr[^>]*>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>[\s\S]*?<\/tr>/gi;
  let m;
  while ((m = rowRe.exec(table))) {
    const key = text(m[1]).replace(/:$/, "").trim();
    const val = text(m[2]).trim();
    if (key) out[key] = val;
  }
  return out;
}

function splitMake(full, existing) {
  const normalized = String(full || "").trim();
  for (const make of KNOWN_MAKES) {
    if (normalized.toLowerCase().startsWith(make.toLowerCase() + " ")) {
      return { make, model: normalized.slice(make.length).trim() };
    }
  }
  if (existing && existing.make && normalized.toLowerCase().startsWith(String(existing.make).toLowerCase())) {
    return { make: existing.make, model: normalized.slice(String(existing.make).length).trim() };
  }
  if (/^A6 Allroad 55 TDI/i.test(normalized)) return { make: "Audi", model: normalized };
  const parts = normalized.split(/\s+/);
  return { make: parts.shift() || "", model: parts.join(" ") };
}

function parseNumber(value) {
  const digits = String(value || "").replace(/[^0-9]/g, "");
  return digits ? Number(digits) : null;
}

function parseRegistration(value) {
  const s = String(value || "").toLowerCase();
  if (!s || /без първа регистрация|нерегистриран/.test(s)) return { year:null, month:null, unregistered:true };
  const year = (s.match(/(19|20)\d{2}/) || [])[0];
  let month = null;
  Object.keys(MONTHS).some(k => s.includes(k) && (month = MONTHS[k]));
  return { year: year ? Number(year) : null, month, unregistered:false };
}

function parseFuel(value) {
  const s = String(value || "").toLowerCase();
  if (s.includes("plug-in")) return "phev";
  if (s.includes("хибрид")) return "hybrid";
  if (s.includes("електр")) return "ev";
  if (s.includes("дизел")) return "diesel";
  if (s.includes("бенз")) return "petrol";
  return "";
}

function parseTransmission(value) {
  const s = String(value || "").toLowerCase();
  if (s.includes("ръчна")) return "manual";
  if (s.includes("автомат")) return "auto";
  return "";
}

function extractImages(html) {
  const gallery = (html.match(/<ul[^>]+id=["']lightSlider["'][^>]*>([\s\S]*?)<\/ul>/i) || [])[1] || "";
  const seen = new Set(), urls = [];
  const re = /(?:data-src|src)=["'](https:\/\/autohaus\.bg\/wp-content\/uploads\/[^"']+?\.(?:jpe?g|png|webp))(?:\?[^"']*)?["']/gi;
  let m;
  while ((m = re.exec(gallery))) {
    const url = m[1].replace(/-\d+x\d+(?=\.(?:jpe?g|png|webp)$)/i, "");
    if (!seen.has(url)) { seen.add(url); urls.push(url); }
  }
  return urls.slice(0, 80);
}

function extractListingText(html) {
  const marker = html.search(/class=["'][^"']*right-part[^"']*content-part[^"']*["']/i);
  if (marker < 0) throw new Error("Listing description is missing");
  const start = html.lastIndexOf("<div", marker), tags = /<\/?div\b[^>]*>/gi;
  tags.lastIndex = start; let depth = 0, match, end = -1;
  while ((match = tags.exec(html))) { depth += /^<\//.test(match[0]) ? -1 : 1; if (!depth) { end = match.index; break; } }
  if (end < 0) throw new Error("Incomplete listing description");
  const source = text(html.slice(html.indexOf(">", start) + 1, end)
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<div[^>]*class=["'][^"']*dkpdf[^"']*["'][^>]*>[\s\S]*?<\/div>/gi, "")
    .replace(/<\/(?:p|li)>/gi, "\n"));
  if (/casino|betting|bonus attractif/i.test(source)) throw new Error("Unrelated source content rejected");
  return source;
}

function splitListingLines(sourceText) {
  const lines = String(sourceText || "").split(/\n+/).map(s => s.trim()).filter(Boolean);
  const notes = [], equipment = [];
  lines.forEach((line, index) => {
    const note = index < 10 && (
      /!\s*$/.test(line) || /^(Цена без|Възможен|Пълна сервизна|Фабрично нов|Удължена фабрична гаранция|Автомобилът е|Автомоби)/i.test(line)
    );
    (note ? notes : equipment).push(line);
  });
  return { lines, notes, equipment };
}

function inferChapter(full, fuel, existing) {
  if (existing && existing.chapter) return existing.chapter;
  const s = String(full || "").toLowerCase();
  if (/maybach|guard|vip|extended|long|lwb|s 600|s 580/.test(s)) return "chauffeur";
  if (/amg|m3|m5|m8|rs\d|turbo s|gt r|targa|carrera|ferrari/.test(s)) return "performance";
  if (/land cruiser|g 350|g 400|g 450|g 500|g 55|g 63|tundra|discovery/.test(s)) return "utility";
  if (["ev","hybrid","phev"].includes(fuel)) return "electrified";
  if (/420 sel|r1100|diamond series/.test(s)) return "classic";
  return "saloon";
}

function parseVehicle(slug, html, existing, sortOrder) {
  const t = extractTable(html);
  let full = t["Марка и модел"] || text((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1]) || (existing && existing.full_name) || slug;
  const parts = splitMake(full, existing);
  full = parts.make + " " + parts.model;
  const reg = parseRegistration(t["Регистрация"] || "");
  const fuel = parseFuel(t["Тип двигател"] || t["Гориво"] || "") || (existing && existing.fuel) || "";
  const transmission = parseTransmission(t["Трансмисия"] || "") || (existing && existing.transmission) || "";
  const sourceText = extractListingText(html);
  const split = splitListingLines(sourceText);
  const images = extractImages(html).map((url, i) => ({
    id: slug + "-source-" + (i + 1), public_id: "", original: url,
    width: null, height: null, legacy: true, position: i, variants: {}
  }));
  if (!images.length) throw new Error("No gallery images found for " + slug);

  const key = s => decodeEntities(s).replace(/^[-–—•]\s*/, "").replace(/[!.,;\s]+/g, "").toLowerCase();
  const translations = new Map();
  if (existing) (existing.equipment_bg || []).forEach((line, i) => { if ((existing.equipment_en || [])[i]) translations.set(key(line), existing.equipment_en[i]); });
  const equipmentEn = split.equipment.map(line => translations.get(key(line)) || (!/[А-Яа-я]/.test(line) ? line : ""));
  const translated = equipmentEn.every(Boolean);

  return {
    slug,
    ref: (existing && existing.ref) || "",
    make: parts.make,
    model: parts.model,
    full_name: full,
    body_type: (existing && existing.body_type) || "",
    colour: t["Цвят"] || (existing && existing.colour) || "",
    transmission,
    fuel,
    mileage: parseNumber(t["Пробег"]),
    first_registration_year: reg.year,
    first_registration_month: reg.month,
    unregistered: reg.unregistered,
    horsepower: parseNumber(t["Мощност"]),
    price: /on request|при запитване/i.test(t["Цена"] || "") ? null : parseNumber(t["Цена"]),
    chapter: inferChapter(full, fuel, existing),
    tags: existing && Array.isArray(existing.tags) ? existing.tags : [],
    notes: split.notes,
    description_bg: (existing && existing.description_bg) || "",
    description_en: (existing && existing.description_en) || "",
    description_source: sourceText,
    description_review_notes: [],
    equipment_bg: split.equipment,
    equipment_en: translated ? equipmentEn : [],
    images,
    source_url: ORIGIN + "/car/" + slug + "/",
    published: !!(existing && existing.published && translated),
    sort_order: Number(sortOrder) || 0
  };
}

async function fetchVehicle(slug, existing, sortOrder) {
  if (!/^[a-z0-9-]{1,180}$/.test(slug)) throw new Error("Invalid vehicle slug");
  const html = await fetchHtml(ORIGIN + "/car/" + slug + "/");
  return parseVehicle(slug, html, existing, sortOrder);
}

/* One-time ownership migration helpers. Public build credentials can only
   write to a temporary staging table and a temporary Storage prefix. */
const MIG_URL = "https://ajoiqomflplhadyhxvfe.supabase.co";
const MIG_KEY = "sb_publishable_gBEUBrOjT_JsBRjAnGL9PQ_ra-1hY0g";
const MIG_BUCKET = "vehicle-images";
const MIG_PREFIX = "owned-mig-8f31d9c20b7a4ed0/";
const MIGRATION_LIVE_SLUGS = Object.freeze([
  "m550d-xdrive",
  "rr-sport-p525-autobio",
  "escalade-600-premium",
  "caddy-maxi-2-0-tdi-comfortline",
  "maybach-s-580-4matic-7",
  "avensis-1-6",
  "rr-p530-autobiography-2",
  "rs6-4-0-tfsi-quattro-2",
  "amg-gt-63-s-e-performance",
  "a6-e-tron-avant-performance",
  "rs6-4-0-tfsi-quattro",
  "maybach-gls-600-4matic-8",
  "g-350-bluetec-3",
  "maybach-s-680-4matic",
  "g-400-d-amg-3",
  "760i-protection-xdrive",
  "g-63-amg-11",
  "maybach-gls-600-4matic-7",
  "amalfi-f169m",
  "911-targa-4-gts",
  "g-63-amg-10",
  "s-600-guard-b7-vr9",
  "tundra-3-5-4x4-limited-trd",
  "rr-sport-sdv6",
  "maybach-s-600-guard-vr9",
  "s-350-d-l-amg",
  "rr-4-4-sdv8-autobiography",
  "maybach-s-600-guard-vr10",
  "rs6-4-0-v8-tfsi-quattro",
  "gls-580-4matic-amg-6",
  "ix-m60",
  "a6-allroad-3-0-bitdi-quattro",
  "panamera-turbo-sport-turismo",
  "tt-rs-coupe-2-5-tfsi-quattro",
  "a6-allroad-3-0-tdi-quattro-13",
  "s8-4-0-tfsi-quattro-7",
  "land-cruiser-200-v8-4",
  "a8l-6-3-w12-fsi-quattro-security",
  "granturismo-mc",
  "mazda-6-skyactiv-g-2-0-2",
  "e-350-bt-4matic-edition-e",
  "sprinter-516-cdi-freezer",
  "530d-xdrive-touring-lci",
  "s-63-amg-l-4matic-7",
  "rr-sport-p525-v8",
  "grancabrio",
  "land-cruiser-150-2-8d",
  "911-turbo-s-coupe-4",
  "x5-xdrive30d-4",
  "s-560-l-4matic-amg-6",
  "cayenne-s-3",
  "x5-xdrive30d-m-sport-2",
  "x5-xdrive40e-iperformance",
  "rr-sport-d350-autobiography",
  "s-580-l-4matic",
  "land-cruiser-70-hardtop-lx",
  "m550i-xdrive-g30-lci",
  "g-450-d",
  "a6-allroad-3-0-bitdi-quattro-2",
  "glc-250-d-4matic-amg-2",
  "m850i-xdrive-coupe-3",
  "r-1100-rt",
  "x5-m50i-xdrive",
  "levante-v6-q4",
  "cayenne-turbo-8",
  "s-500-l-4matic-amg-17",
  "g-500-amg-11",
  "panamera-turbo-s-e-hybrid-4",
  "g-55-amg-2",
  "x-250-d-4matic-power-edition",
  "911-carrera-4s-coupe-2",
  "lr-discovery-4-sdv6-landmark",
  "amg-gt-r-pro",
  "530d-gran-turismo",
  "amg-s-63-4matic-brabus",
  "mercedes-benz-g-350-d-professional",
  "s-63-l-amg-4matic",
  "gl-63-amg-4matic",
  "continental-gt-diamond-series",
  "sl-350",
  "v-300-d-4m-long-vip",
  "v-300-d-4matic-vip",
  "g-350-cdi-amg-cabrio",
  "sl-63-amg-3",
  "420-sel",
  "rs6-5-0-v10-tfsi-quattro"
]);

function migHeaders(extra) {
  return Object.assign({ apikey: MIG_KEY, "Content-Type": "application/json" }, extra || {});
}
function migPath(value) {
  return String(value).split("/").map(encodeURIComponent).join("/");
}
async function migStage(row) {
  const r = await timedFetch(MIG_URL + "/rest/v1/autohaus_migration_stage?on_conflict=slug", {
    method: "POST",
    headers: migHeaders({ Prefer: "resolution=merge-duplicates,return=minimal" }),
    body: JSON.stringify({ slug: row.slug, payload: row, created_at: new Date().toISOString() })
  }, 15000);
  if (!r.ok) {
    const detail = await r.text().catch(() => "");
    throw new Error("Staging write failed " + r.status + " " + detail.slice(0, 240));
  }
}

function migExt(url, contentType) {
  const m = String(url || "").match(/\.([a-z0-9]+)(?:\?|$)/i);
  let ext = m ? m[1].toLowerCase() : "";
  if (ext === "jpeg") ext = "jpg";
  if (!["jpg", "png", "webp"].includes(ext)) {
    ext = /png/i.test(contentType) ? "png" : /webp/i.test(contentType) ? "webp" : "jpg";
  }
  return ext;
}

async function migCopyImage(slug, source, index) {
  const src = await timedFetch(source, {
    method: "GET",
    headers: { Accept: "image/avif,image/webp,image/*,*/*;q=0.8", "User-Agent": "AutoHaus media migration/1.0" }
  }, 30000);
  if (!src.ok) throw new Error(slug + " image " + (index + 1) + " source HTTP " + src.status);
  const type = src.headers.get("content-type") || "image/jpeg";
  if (!/^image\//i.test(type)) throw new Error(slug + " image " + (index + 1) + " is not an image");
  const bytes = await src.arrayBuffer();
  if (!bytes.byteLength || bytes.byteLength > 45 * 1024 * 1024) throw new Error(slug + " image " + (index + 1) + " invalid size");

  const objectPath = MIG_PREFIX + slug + "/" + String(index + 1).padStart(2, "0") + "." + migExt(source, type);
  const upload = await timedFetch(MIG_URL + "/storage/v1/object/" + MIG_BUCKET + "/" + migPath(objectPath), {
    method: "POST",
    headers: { apikey: MIG_KEY, "Content-Type": type, "x-upsert": "true", "cache-control": "31536000" },
    body: bytes
  }, 30000);
  if (!upload.ok) {
    const detail = await upload.text().catch(() => "");
    throw new Error(slug + " image " + (index + 1) + " upload HTTP " + upload.status + " " + detail.slice(0, 180));
  }

  return {
    id: slug + "-owned-" + (index + 1),
    public_id: objectPath,
    original: MIG_URL + "/storage/v1/object/public/" + MIG_BUCKET + "/" + migPath(objectPath),
    source_original: source,
    width: null, height: null, legacy: false, embedded_watermark: false,
    position: index, variants: {}
  };
}

async function migCopyImages(slug, sourceImages) {
  const sources = (sourceImages || []).map(image => image && image.original).filter(Boolean);
  if (!sources.length) throw new Error("No source images for " + slug);
  const out = new Array(sources.length);
  let cursor = 0;
  async function worker() {
    while (cursor < sources.length) {
      const i = cursor++;
      out[i] = await migCopyImage(slug, sources[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(3, sources.length) }, worker));
  return out;
}

async function migExisting(slug) {
  const url = MIG_URL + "/rest/v1/vehicles?slug=eq." + encodeURIComponent(slug) + "&select=*";
  const r = await timedFetch(url, { method: "GET", headers: migHeaders() }, 15000);
  if (!r.ok) return null;
  const data = await r.json().catch(() => []);
  return Array.isArray(data) && data[0] ? data[0] : null;
}

async function migStageVehicle(slug, sortOrder) {
  const existing = await migExisting(slug);
  const row = await fetchVehicle(slug, existing, sortOrder);
  row.images = await migCopyImages(slug, row.images);
  row.notes_en = existing && Array.isArray(existing.notes_en) ? existing.notes_en : [];
  row.published = true;
  row.sort_order = sortOrder;
  await migStage(row);
  return { slug, images: row.images.length };
}

async function migAlreadyStaged() {
  const r = await timedFetch(MIG_URL + "/rest/v1/autohaus_migration_stage?select=slug", {
    method: "GET", headers: migHeaders()
  }, 15000);
  if (!r.ok) throw new Error("Could not read migration staging progress: " + r.status);
  const rows = await r.json().catch(() => []);
  return new Set((Array.isArray(rows) ? rows : []).map(row => row && row.slug).filter(Boolean));
}

async function runOwnershipStaging() {
  /* One-time ownership migration is pinned to the live archive snapshot
     verified on 2026-09-20. The origin's /car/ response is cached differently
     by region and returned an older inventory from Vercel, so discovery is not
     authoritative for this transfer. Individual vehicle pages are still
     fetched live and must succeed before they are staged. */
  const live = MIGRATION_LIVE_SLUGS.slice();
  if (live.length !== 86) throw new Error("Invalid pinned migration inventory");
  const done = await migAlreadyStaged();
  const pending = live.map((slug, index) => ({ slug, sortOrder:index + 1 })).filter(item => !done.has(item.slug));
  console.log("AutoHaus ownership staging: " + live.length + " live vehicles; " + pending.length + " remaining");

  if (!pending.length) {
    console.log("AutoHaus ownership staging already complete");
    return live.length;
  }

  let cursor = 0;
  async function worker() {
    while (cursor < pending.length) {
      const item = pending[cursor++];
      const result = await migStageVehicle(item.slug, item.sortOrder);
      console.log("  staged " + item.sortOrder + "/" + live.length + " " + result.slug + " (" + result.images + " images)");
    }
  }
  await Promise.all([worker(), worker()]);
  console.log("AutoHaus ownership staging complete");
  return live.length;
}

module.exports = { ARCHIVE, discoverLiveCars, fetchVehicle, parseVehicle, discoverFromHtml, runOwnershipStaging };
