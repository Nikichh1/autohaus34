/* AutoHaus automatic Bulgarian -> English translation for admin fields.
   Bulgarian is the only editable source. English previews are read-only and
   every vehicle save regenerates English from the Bulgarian source. */
(function () {
  "use strict";

  var baseFetch = window.fetch.bind(window);
  var CACHE_KEY = "autohaus-auto-translation-v2";
  var cache = Object.create(null);
  var pending = Object.create(null);

  var KNOWN = {
    "Пълна сервизна история!": "Full service history!",
    "Пълна сервизна история": "Full service history",
    "Възможен бартер!": "Part-exchange available!",
    "Възможен бартер": "Part-exchange available",
    "Възможен лизинг!": "Leasing available!",
    "Възможен лизинг": "Leasing available",
    "Брокерски оглед": "Broker inspection",
    "Брокерски оглед!": "Broker inspection!",
    "Цена без начислен 20% ДДС": "Price excluding 20% VAT",
    "Цена без начислен 20% ДДС!": "Price excluding 20% VAT!"
  };

  function loadCache() {
    try {
      var stored = JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");
      if (stored && typeof stored === "object") cache = stored;
    } catch (_) {}
    Object.keys(KNOWN).forEach(function (key) { cache[key] = KNOWN[key]; });
  }

  function saveCache() {
    var keys = Object.keys(cache);
    if (keys.length > 800) {
      keys.slice(0, keys.length - 800).forEach(function (key) {
        if (!Object.prototype.hasOwnProperty.call(KNOWN, key)) delete cache[key];
      });
    }
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch (_) {}
  }

  function apiUrl(input) {
    try { return new URL(typeof input === "string" ? input : input && input.url, location.href); }
    catch (_) { return null; }
  }

  function errorResponse(message) {
    return new Response(JSON.stringify({
      ok: false,
      error: message || "Автоматичният превод временно не успя. Опитайте отново.",
      code: "AUTO_TRANSLATION_REQUIRED"
    }), {
      status: 422,
      headers: { "Content-Type": "application/json; charset=utf-8" }
    });
  }

  function normalizeLines(value) {
    var source = Array.isArray(value) ? value : String(value || "").split(/\r?\n/);
    return source.map(function (line) { return String(line || "").trim(); }).filter(Boolean);
  }

  function splitLong(value, max) {
    var text = String(value || "").trim();
    if (!text) return [];
    if (text.length <= max) return [text];
    var out = [];
    while (text.length > max) {
      var cut = text.lastIndexOf(" ", max);
      if (cut < Math.floor(max * 0.6)) cut = max;
      out.push(text.slice(0, cut).trim());
      text = text.slice(cut).trim();
    }
    if (text) out.push(text);
    return out;
  }

  function requestBatch(batch) {
    var requestKey = JSON.stringify(batch);
    if (!pending[requestKey]) {
      pending[requestKey] = baseFetch("/api/admin/description?action=translate", {
        method: "POST",
        credentials: "same-origin",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ target: "en", lines: batch })
      }).then(function (response) {
        return response.json().catch(function () { return {}; }).then(function (data) {
          if (!response.ok || !data || data.ok !== true || !Array.isArray(data.lines) || data.lines.length !== batch.length) {
            throw new Error(data && data.error || "Автоматичният превод временно не успя. Опитайте отново.");
          }
          batch.forEach(function (line, index) {
            var translated = String(data.lines[index] || "").trim();
            if (!translated) throw new Error("Английският превод не е пълен.");
            cache[line] = translated;
          });
          saveCache();
          return true;
        });
      }).finally(function () { delete pending[requestKey]; });
    }
    return pending[requestKey];
  }

  function translateMissing(units) {
    var missing = [];
    var seen = Object.create(null);
    units.forEach(function (unit) {
      if (!cache[unit] && !seen[unit]) {
        seen[unit] = true;
        missing.push(unit);
      }
    });
    if (!missing.length) {
      return Promise.resolve(units.map(function (unit) { return cache[unit] || unit; }));
    }

    var batches = [];
    for (var i = 0; i < missing.length; i += 60) batches.push(missing.slice(i, i + 60));
    return Promise.all(batches.map(requestBatch)).then(function () {
      return units.map(function (unit) { return cache[unit] || unit; });
    });
  }

  function translateList(value) {
    var lines = normalizeLines(value);
    if (!lines.length) return Promise.resolve([]);
    var parts = [];
    var map = [];
    lines.forEach(function (line) {
      var chunks = splitLong(line, 1800);
      map.push({ start: parts.length, count: chunks.length });
      parts.push.apply(parts, chunks);
    });
    return translateMissing(parts).then(function (translated) {
      return map.map(function (item) {
        return translated.slice(item.start, item.start + item.count).join(" ").trim();
      });
    });
  }

  function translateText(value) {
    var raw = String(value || "");
    if (!raw.trim()) return Promise.resolve("");
    var rows = raw.replace(/\r/g, "").split("\n");
    var parts = [];
    var map = [];
    rows.forEach(function (row) {
      if (!row.trim()) {
        map.push({ blank: true });
        return;
      }
      var chunks = splitLong(row, 1800);
      map.push({ start: parts.length, count: chunks.length });
      parts.push.apply(parts, chunks);
    });
    return translateMissing(parts).then(function (translated) {
      return map.map(function (item) {
        if (item.blank) return "";
        return translated.slice(item.start, item.start + item.count).join(" ").trim();
      }).join("\n");
    });
  }

  function statusFor(key) {
    return document.querySelector('[data-auto-translate-status="' + key + '"]');
  }

  function setStatus(key, text, error) {
    var el = statusFor(key);
    if (!el) return;
    el.textContent = text || "";
    el.classList.toggle("is-error", !!error);
  }

  function bindPair(sourceId, targetId, key, listMode) {
    var source = document.getElementById(sourceId);
    var target = document.getElementById(targetId);
    if (!source || !target || source.dataset.ahAutoTranslate === "1") return;

    source.dataset.ahAutoTranslate = "1";
    target.readOnly = true;
    target.tabIndex = -1;
    var timer = 0;
    var version = 0;

    function run() {
      var current = ++version;
      var raw = source.value;
      if (!String(raw || "").trim()) {
        target.value = "";
        setStatus(key, "");
        return;
      }
      setStatus(key, "Превеждане…");
      var request = listMode ? translateList(raw).then(function (lines) { return lines.join("\n"); }) : translateText(raw);
      request.then(function (translated) {
        if (current !== version || !source.isConnected) return;
        target.value = translated;
        setStatus(key, "English preview е обновен.");
      }).catch(function (error) {
        if (current !== version || !source.isConnected) return;
        setStatus(key, error && error.message || "Преводът временно не успя.", true);
      });
    }

    source.addEventListener("input", function () {
      clearTimeout(timer);
      setStatus(key, "Подготовка на превода…");
      timer = setTimeout(run, 260);
    });
    setTimeout(run, 0);
  }

  function ensureNotesPreview(textarea) {
    var label = textarea && textarea.closest && textarea.closest("label.field");
    if (!label) return null;
    var wrap = label.querySelector(".ah-note-translation-preview");
    if (wrap) return wrap.querySelector("textarea");

    wrap = document.createElement("div");
    wrap.className = "ah-note-translation-preview";
    var title = document.createElement("strong");
    title.textContent = "English preview";
    var preview = document.createElement("textarea");
    preview.className = "ah-note-translation-preview__box";
    preview.readOnly = true;
    preview.tabIndex = -1;
    preview.rows = Math.max(3, Number(textarea.rows) || 3);
    preview.lang = "en";
    var status = document.createElement("small");
    status.className = "field-hint";
    status.setAttribute("data-auto-translate-status", "notes");
    wrap.appendChild(title);
    wrap.appendChild(preview);
    wrap.appendChild(status);
    label.appendChild(wrap);
    return preview;
  }

  function bindNotes() {
    var form = document.getElementById("car-form");
    var source = form && form.elements && form.elements.notes;
    if (!source || source.dataset.ahAutoTranslate === "1") return;
    var target = document.getElementById("notes-en-preview") || ensureNotesPreview(source);
    if (!target) return;
    target.id = target.id || "notes-en-preview";
    bindPairByElements(source, target, "notes");
  }

  function bindPairByElements(source, target, key) {
    if (!source || !target || source.dataset.ahAutoTranslate === "1") return;
    source.dataset.ahAutoTranslate = "1";
    var timer = 0;
    var version = 0;
    function run() {
      var current = ++version;
      if (!source.value.trim()) {
        target.value = "";
        setStatus(key, "");
        return;
      }
      setStatus(key, "Превеждане…");
      translateList(source.value).then(function (lines) {
        if (current !== version || !source.isConnected) return;
        target.value = lines.join("\n");
        setStatus(key, "English preview е обновен.");
      }).catch(function (error) {
        if (current !== version || !source.isConnected) return;
        setStatus(key, error && error.message || "Преводът временно не успя.", true);
      });
    }
    source.addEventListener("input", function () {
      clearTimeout(timer);
      setStatus(key, "Подготовка на превода…");
      timer = setTimeout(run, 260);
    });
    setTimeout(run, 0);
  }

  function bindAll() {
    bindPair("equipment-bg", "equipment-en", "equipment", true);
    bindNotes();
  }

  window.fetch = function (input, init) {
    init = init || {};
    var url = apiUrl(input);
    var method = String(init.method || "GET").toUpperCase();
    var isVehicleWrite = url && url.origin === location.origin && url.pathname === "/api/admin/vehicles" &&
      (method === "POST" || method === "PATCH" || method === "PUT") && typeof init.body === "string";
    if (!isVehicleWrite) return baseFetch(input, init);

    var body;
    try { body = JSON.parse(init.body); } catch (_) { return baseFetch(input, init); }
    var hasTranslationSources = Array.isArray(body.notes) || Array.isArray(body.equipment_bg);
    if (!hasTranslationSources) return baseFetch(input, init);

    return Promise.all([
      translateList(body.notes || []),
      translateList(body.equipment_bg || [])
    ]).then(function (values) {
      body.notes_en = values[0];
      body.equipment_en = values[1];
      var next = Object.assign({}, init, { body: JSON.stringify(body) });
      return baseFetch(input, next);
    }).catch(function (error) {
      return errorResponse(error && error.message);
    });
  };

  loadCache();
  var observer = new MutationObserver(bindAll);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bindAll);
  else bindAll();
})();
