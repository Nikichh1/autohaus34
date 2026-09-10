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
  if (marker < 0) return "";
  const tail = html.slice(marker, html.indexOf("</article>", marker) > marker ? html.indexOf("</article>", marker) : undefined);
  const paragraphs = [];
  const re = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  let m;
  while ((m = re.exec(tail))) {
    const t = text(m[1]);
    if (t.length >= 20 && !/^(Име|Телефон|Имейл)\b/.test(t)) paragraphs.push(t);
  }
  return paragraphs.sort((a,b) => b.length - a.length)[0] || "";
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
  const full = t["Марка и модел"] || text((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1]) || (existing && existing.full_name) || slug;
  const parts = splitMake(full, existing);
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

  const sourceUnchanged = existing && existing.description_source === sourceText;
  const equipmentEn = sourceUnchanged && Array.isArray(existing.equipment_en) ? existing.equipment_en : [];
  const descriptionEn = sourceUnchanged ? (existing.description_en || "") : "";

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
    description_bg: split.notes.join("\n"),
    description_en: descriptionEn,
    description_source: sourceText,
    description_review_notes: [],
    equipment_bg: split.equipment,
    equipment_en: equipmentEn.length === split.equipment.length ? equipmentEn : [],
    images,
    source_url: ORIGIN + "/car/" + slug + "/",
    published: true,
    sort_order: Number(sortOrder) || 0
  };
}

async function fetchVehicle(slug, existing, sortOrder) {
  if (!/^[a-z0-9-]{1,180}$/.test(slug)) throw new Error("Invalid vehicle slug");
  const html = await fetchHtml(ORIGIN + "/car/" + slug + "/");
  return parseVehicle(slug, html, existing, sortOrder);
}

module.exports = { ARCHIVE, discoverLiveCars, fetchVehicle, parseVehicle, discoverFromHtml };
