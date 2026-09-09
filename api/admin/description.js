"use strict";

const { json, clean, env, requireAdmin } = require("../../server/admin-lib");

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    description_bg: { type: "string" },
    description_en: { type: "string" },
    equipment_bg: { type: "array", items: { type: "string" } },
    equipment_en: { type: "array", items: { type: "string" } },
    review_notes: { type: "array", items: { type: "string" } }
  },
  required: ["description_bg", "description_en", "equipment_bg", "equipment_en", "review_notes"]
};

function outputText(data) {
  if (typeof data.output_text === "string") return data.output_text;
  const out = [];
  (data.output || []).forEach((item) => {
    (item.content || []).forEach((part) => {
      if (part.type === "output_text" && part.text) out.push(part.text);
    });
  });
  return out.join("\n");
}

module.exports = async function handler(req, res) {
  const user = await requireAdmin(req, res);
  if (!user) return json(res, 401, { ok: false, error: "Authentication required" });
  if (req.method !== "POST") return json(res, 405, { ok: false, error: "Method not allowed" });

  const apiKey = env("OPENAI_API_KEY");
  const model = env("OPENAI_MODEL") || "gpt-5";
  if (!apiKey) return json(res, 503, { ok: false, error: "OPENAI_API_KEY is not configured" });

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const raw = clean(body.source, 30000);
  if (raw.length < 10) return json(res, 400, { ok: false, error: "Paste a vehicle description or equipment list first." });

  const known = body.vehicle && typeof body.vehicle === "object" ? body.vehicle : {};
  const context = {
    brand: clean(known.make, 120),
    model: clean(known.model, 220),
    year: known.first_registration_year || null,
    fuel: clean(known.fuel, 40),
    transmission: clean(known.transmission, 40),
    mileage: known.mileage == null ? null : Number(known.mileage),
    horsepower: known.horsepower == null ? null : Number(known.horsepower),
    colour: clean(known.colour, 120)
  };

  const instructions = [
    "You clean and structure vehicle listing text for Auto House.",
    "Absolute rule: preserve factual information from SOURCE and KNOWN STRUCTURED DATA, and never invent, infer or embellish a specification, option, condition, history, warranty, ownership claim or feature.",
    "If a fact is ambiguous, omit it from the polished description and mention the ambiguity briefly in review_notes.",
    "Remove source-site boilerplate, duplicated lines, phone numbers, seller promotion, navigation fragments and obvious formatting noise.",
    "Keep equipment codes exactly when present. Deduplicate only exact or clearly duplicate entries; do not merge two different facts.",
    "description_bg must be concise professional Bulgarian prose made only from explicit facts. description_en must faithfully translate the same facts into English.",
    "equipment_bg and equipment_en must be line-for-line aligned arrays with the same number and order of items. Bulgarian is the primary cleaned equipment list; English is its faithful translation.",
    "Do not translate brand/model names, OEM option codes, trim names or product names unless there is a conventional localized form.",
    "The result is reviewed by a human before saving."
  ].join("\n");

  try {
    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        store: false,
        input: [
          { role: "system", content: [{ type: "input_text", text: instructions }] },
          { role: "user", content: [{ type: "input_text", text: "KNOWN STRUCTURED DATA:\n" + JSON.stringify(context) + "\n\nSOURCE:\n" + raw }] }
        ],
        text: {
          format: {
            type: "json_schema",
            name: "vehicle_description",
            strict: true,
            schema: SCHEMA
          }
        }
      })
    });

    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      console.error("OpenAI description error", r.status, data && data.error);
      return json(res, 502, { ok: false, error: "Description processing failed" });
    }

    const text = outputText(data);
    let parsed;
    try { parsed = JSON.parse(text); }
    catch (_) { return json(res, 502, { ok: false, error: "AI returned an invalid structured result" }); }

    if (!Array.isArray(parsed.equipment_bg) || !Array.isArray(parsed.equipment_en) || parsed.equipment_bg.length !== parsed.equipment_en.length) {
      return json(res, 502, { ok: false, error: "AI returned misaligned translations" });
    }

    return json(res, 200, { ok: true, result: parsed, model });
  } catch (err) {
    console.error("Description processor failed", err);
    return json(res, 502, { ok: false, error: "Description service unavailable" });
  }
};
