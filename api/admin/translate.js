"use strict";

const { json, clean, requireAdmin, requireSameOrigin, timedFetch } = require("../../server/admin-lib");

const GOOGLE_TRANSLATE_ENDPOINT = "https://translate.googleapis.com/translate_a/single";

function extract(data) {
  const parts = data && Array.isArray(data[0]) ? data[0] : [];
  return parts.map((part) => Array.isArray(part) && typeof part[0] === "string" ? part[0] : "").join("").trim();
}

async function translate(text, target) {
  const input = String(text || "").trim();
  if (!input) return "";
  const url = GOOGLE_TRANSLATE_ENDPOINT + "?client=gtx&sl=auto&tl=" + encodeURIComponent(target) +
    "&dt=t&q=" + encodeURIComponent(input);
  const response = await timedFetch(url, { method: "GET", headers: { Accept: "application/json" } }, 8000);
  if (!response.ok) throw new Error("translation_http_" + response.status);
  const data = await response.json().catch(() => null);
  const translated = extract(data);
  if (!translated) throw new Error("translation_empty");
  return translated;
}

async function translateLines(lines, target) {
  if (!lines.length) return [];
  const joined = lines.join("\n");
  if (joined.length <= 2800) {
    const translated = await translate(joined, target);
    const split = translated.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (split.length === lines.length) return split;
  }
  return Promise.all(lines.map((line) => translate(line, target)));
}

module.exports = async function handler(req, res) {
  if (!requireSameOrigin(req, res)) return;
  const user = await requireAdmin(req, res);
  if (!user) return json(res, 401, { ok: false, error: "Authentication required" });
  if (user.adminRole === "viewer") return json(res, 403, { ok: false, error: "Your role cannot perform this action." });
  if (req.method !== "POST") return json(res, 405, { ok: false, error: "Method not allowed" });

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const target = body.target === "bg" ? "bg" : "en";
  if (!Array.isArray(body.lines) || body.lines.length > 80 || body.lines.some((line) => typeof line !== "string" || line.length > 2000)) {
    return json(res, 400, { ok: false, error: "Invalid translation input" });
  }
  const lines = body.lines.map((line) => clean(line, 2000)).filter(Boolean);
  if (!lines.length) return json(res, 200, { ok: true, lines: [] });

  try {
    const translated = await translateLines(lines, target);
    if (translated.length !== lines.length) throw new Error("translation_alignment");
    return json(res, 200, { ok: true, lines: translated });
  } catch (err) {
    console.error("Automatic note translation failed", err && err.message || err);
    return json(res, 502, { ok: false, error: target === "en" ? "Автоматичният превод временно не успя. Опитайте отново." : "Automatic translation is temporarily unavailable. Try again.", code: "TRANSLATION_TEMPORARY" });
  }
};
