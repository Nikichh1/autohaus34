/* Auto House admin — zero-cost local description processor.
   Uses Chrome built-in AI (Gemini Nano) + Translator API entirely on-device.
   No API key and no vehicle text is sent to OpenAI/Google servers. */
(function () {
  "use strict";

  var D = document;

  var OUTPUT_SCHEMA = {
    type: "object",
    additionalProperties: false,
    properties: {
      description_en: { type: "string" },
      equipment_en: { type: "array", items: { type: "string" } },
      review_notes_en: { type: "array", items: { type: "string" } }
    },
    required: ["description_en", "equipment_en", "review_notes_en"]
  };

  function setNote(message, isError) {
    var note = D.getElementById("processor-note");
    if (!note) return;
    note.textContent = message;
    note.classList.toggle("is-error", !!isError);
  }

  function setButton(busy, label) {
    var btn = D.getElementById("process-description");
    if (!btn) return;
    btn.disabled = !!busy;
    btn.textContent = label || (busy ? "Обработване…" : "Обработи");
  }

  function setDirty() {
    var form = D.getElementById("car-form");
    if (form) form.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function putResult(result) {
    var bg = D.getElementById("desc-bg"), en = D.getElementById("desc-en");
    var eqBg = D.getElementById("equipment-bg"), eqEn = D.getElementById("equipment-en");
    if (bg) bg.value = result.description_bg || "";
    if (en) en.value = result.description_en || "";
    if (eqBg) eqBg.value = (result.equipment_bg || []).join("\n");
    if (eqEn) eqEn.value = (result.equipment_en || []).join("\n");
    var review = D.getElementById("review-notes");
    if (review) {
      var notes = result.review_notes || [];
      review.innerHTML = notes.length
        ? '<div class="review-alert"><strong>За проверка:</strong><br>' + notes.map(escapeHtml).join("<br>") + "</div>"
        : "";
    }
    setDirty();
  }

  function escapeHtml(value) {
    return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function vehicleContext() {
    var form = D.getElementById("car-form");
    if (!form) return {};
    function val(name) { return form.elements[name] ? form.elements[name].value.trim() : ""; }
    return {
      brand: val("make"), model: val("model"), body_type: val("body_type"), colour: val("colour"),
      transmission: val("transmission"), fuel: val("fuel"), mileage: val("mileage"),
      registration_year: val("first_registration_year"), registration_month: val("first_registration_month"),
      horsepower: val("horsepower"), price: val("price")
    };
  }

  function normalizeSource(raw) {
    return String(raw || "")
      .replace(/\r\n?/g, "\n")
      .replace(/[\t\u00a0]+/g, " ")
      .replace(/ {2,}/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  async function detectLanguage(text) {
    if ("LanguageDetector" in self) {
      try {
        var availability = await LanguageDetector.availability();
        if (availability !== "unavailable") {
          var detector = await LanguageDetector.create();
          var results = await detector.detect(text.slice(0, 6000));
          if (results && results[0] && results[0].confidence >= 0.45) return results[0].detectedLanguage;
        }
      } catch (_) {}
    }
    return /[А-Яа-я]/.test(text) ? "bg" : "en";
  }

  async function makeTranslator(sourceLanguage, targetLanguage, statusText) {
    if (sourceLanguage === targetLanguage) return null;
    if (!("Translator" in self)) throw new Error("Локалният Chrome преводач не е наличен на този браузър.");
    var availability = await Translator.availability({ sourceLanguage: sourceLanguage, targetLanguage: targetLanguage });
    if (availability === "unavailable") throw new Error("Chrome не поддържа локален превод " + sourceLanguage + " → " + targetLanguage + ".");
    setNote(statusText || "Подготовка на локалния преводач…", false);
    return Translator.create({
      sourceLanguage: sourceLanguage,
      targetLanguage: targetLanguage,
      monitor: function (m) {
        m.addEventListener("downloadprogress", function (e) {
          setNote("Сваляне на локалния преводач… " + Math.round(e.loaded * 100) + "%", false);
        });
      }
    });
  }

  async function translateMany(translator, values) {
    if (!translator) return values.slice();
    var out = [];
    for (var i = 0; i < values.length; i++) out.push(await translator.translate(values[i]));
    return out;
  }

  function parseModelJson(value) {
    if (value && typeof value === "object") return value;
    var text = String(value || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    return JSON.parse(text);
  }

  async function localAI(raw, context) {
    if (!("LanguageModel" in self)) throw new Error("LOCAL_AI_UNAVAILABLE");

    var sourceLanguage = await detectLanguage(raw);
    var sourceEnglish = raw;
    if (sourceLanguage !== "en") {
      var toEnglish = await makeTranslator(sourceLanguage, "en", "Превод на източника локално…");
      sourceEnglish = await toEnglish.translate(raw);
    }

    var options = {
      expectedInputs: [{ type: "text", languages: ["en"] }],
      expectedOutputs: [{ type: "text", languages: ["en"] }]
    };
    var availability = await LanguageModel.availability(options);
    if (availability === "unavailable") throw new Error("LOCAL_AI_UNAVAILABLE");

    setNote(availability === "downloadable" || availability === "downloading"
      ? "Сваляне на локалния AI модел…" : "Локална AI обработка…", false);

    var session = await LanguageModel.create(Object.assign({}, options, {
      monitor: function (m) {
        m.addEventListener("downloadprogress", function (e) {
          setNote("Сваляне на локалния AI модел… " + Math.round(e.loaded * 100) + "%", false);
        });
      }
    }));

    var prompt = [
      "Clean and structure this vehicle listing for a professional Auto House inventory.",
      "STRICT RULE: use only facts explicitly present in SOURCE or KNOWN DATA. Never infer, invent, embellish or assume equipment, history, condition, warranty, ownership, service or specifications.",
      "Remove website navigation, seller promotion, phone numbers, contact details, duplicate lines and obvious formatting noise.",
      "Keep OEM equipment codes exactly as written. Keep different facts separate. Deduplicate only clear duplicates.",
      "description_en: short professional English prose using only explicit facts.",
      "equipment_en: clean equipment/options, one factual item per array entry.",
      "review_notes_en: only ambiguities or suspicious source conflicts that a human should verify.",
      "KNOWN DATA: " + JSON.stringify(context),
      "SOURCE:\n" + sourceEnglish
    ].join("\n\n");

    var answer;
    try {
      answer = await session.prompt(prompt, { responseConstraint: OUTPUT_SCHEMA });
    } catch (_) {
      answer = await session.prompt(prompt + "\n\nReturn ONLY valid JSON matching: " + JSON.stringify(OUTPUT_SCHEMA));
    }
    var parsed = parseModelJson(answer);
    if (!Array.isArray(parsed.equipment_en) || !Array.isArray(parsed.review_notes_en)) throw new Error("Локалният AI върна невалиден резултат.");

    setNote("Локален превод към български…", false);
    var toBulgarian = await makeTranslator("en", "bg", "Локален превод към български…");
    var descriptionBg = parsed.description_en ? await toBulgarian.translate(parsed.description_en) : "";
    var equipmentBg = await translateMany(toBulgarian, parsed.equipment_en);
    var reviewBg = await translateMany(toBulgarian, parsed.review_notes_en);

    return {
      description_bg: descriptionBg,
      description_en: parsed.description_en || "",
      equipment_bg: equipmentBg,
      equipment_en: parsed.equipment_en,
      review_notes: reviewBg
    };
  }

  function basicLines(raw) {
    var seen = Object.create(null);
    return raw.split(/\n+/).map(function (line) {
      return line.replace(/^[-•·–—\s]+/, "").replace(/\s+/g, " ").trim();
    }).filter(function (line) {
      if (!line || line.length < 3) return false;
      if (/https?:\/\/|www\.|@|тел\.?|phone|contact|facebook|instagram|cookie|privacy/i.test(line)) return false;
      if (/^[+\d][\d\s().-]{7,}$/.test(line)) return false;
      var key = line.toLowerCase();
      if (seen[key]) return false;
      seen[key] = true;
      return true;
    }).slice(0, 250);
  }

  async function fallbackCleaner(raw) {
    var sourceLanguage = await detectLanguage(raw);
    var cleaned = basicLines(raw);
    var bg = [], en = [];

    if (sourceLanguage === "bg") {
      bg = cleaned;
      try {
        var toEn = await makeTranslator("bg", "en", "Локален превод…");
        en = await translateMany(toEn, cleaned);
      } catch (_) { en = cleaned.slice(); }
    } else {
      en = cleaned;
      try {
        var toBg = await makeTranslator(sourceLanguage, "bg", "Локален превод…");
        bg = await translateMany(toBg, cleaned);
      } catch (_) { bg = cleaned.slice(); }
    }

    return {
      description_bg: "",
      description_en: "",
      equipment_bg: bg,
      equipment_en: en,
      review_notes: ["Локалният генеративен AI не е наличен на това устройство. Направено е само безопасно почистване и превод — прегледайте текста преди запис."]
    };
  }

  async function processLocal() {
    var source = D.getElementById("source-text");
    if (!source || source.value.trim().length < 10) {
      setNote("Поставете текст за обработка.", true);
      return;
    }
    setButton(true, "Обработване…");
    setNote("Подготовка на локалния AI…", false);
    var raw = normalizeSource(source.value);
    try {
      var result;
      try { result = await localAI(raw, vehicleContext()); }
      catch (err) {
        if (err && err.message !== "LOCAL_AI_UNAVAILABLE") throw err;
        setNote("AI моделът не е наличен · използвам безплатно почистване…", false);
        result = await fallbackCleaner(raw);
      }
      putResult(result);
      setNote("Готово · прегледайте и запишете · 0 лв.", false);
    } catch (err) {
      setNote(err && err.message ? err.message : "Локалната обработка не успя.", true);
    } finally {
      setButton(false, "Обработи");
    }
  }

  /* Capture the click before admin.js' old server/API handler. */
  D.addEventListener("click", function (e) {
    var target = e.target && e.target.closest ? e.target.closest("#process-description") : null;
    if (!target) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    processLocal();
  }, true);

  window.AutoHouseLocalAI = { process: processLocal };
})();
