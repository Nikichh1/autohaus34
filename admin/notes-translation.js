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
      var controller = new AbortController();
      var timer;
      var timeout = new Promise(function (resolve) {
        timer = setTimeout(function () { controller.abort(); resolve({ pending: true, retryAfter: 3500 }); }, 12000);
      });
      var request = baseFetch("/api/admin/description?action=translate", {
        method: "POST",
        credentials: "same-origin",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ target: "en", lines: batch }),
        signal: controller.signal
      }).then(function (response) {
        return response.json().catch(function () { return {}; }).then(function (data) {
          if (!response.ok || !data || data.ok !== true || !Array.isArray(data.lines) || data.lines.length !== batch.length) {
            return { pending: true, retryAfter: 3500 };
          }
          if (!data.pending) {
            batch.forEach(function (line, index) {
              var translated = String(data.lines[index] || "").trim();
              if (translated) cache[line] = translated;
            });
            saveCache();
          }
          return {
            pending: !!data.pending,
            retryAfter: Math.max(1500, Math.min(15000, Number(data.retry_after_ms) || 3500)),
            lines: data.lines
          };
        });
      }).catch(function () {
        return { pending: true, retryAfter: 3500 };
      });
      pending[requestKey] = Promise.race([request, timeout]).finally(function () {
        clearTimeout(timer); delete pending[requestKey];
      });
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
      return Promise.resolve({
        lines: units.map(function (unit) { return cache[unit] || unit; }),
        pending: false,
        retryAfter: 0
      });
    }

    var batches = [];
    for (var i = 0; i < missing.length; i += 60) batches.push(missing.slice(i, i + 60));
    return Promise.all(batches.map(requestBatch)).then(function (results) {
      var pendingAny = results.some(function (result) { return result && result.pending; });
      var translatedByLine = Object.create(null);
      results.forEach(function (result, batchIndex) {
        var batch = batches[batchIndex];
        var values = result && Array.isArray(result.lines) ? result.lines : [];
        batch.forEach(function (line, index) {
          translatedByLine[line] = cache[line] || String(values[index] || "").trim() || line;
        });
      });
      return {
        lines: units.map(function (unit) { return cache[unit] || translatedByLine[unit] || unit; }),
        pending: pendingAny,
        retryAfter: results.reduce(function (max, result) {
          return Math.max(max, Number(result && result.retryAfter) || 0);
        }, 0) || 3500
      };
    });
  }

  function translateList(value) {
    var lines = normalizeLines(value);
    if (!lines.length) return Promise.resolve({ lines: [], pending: false, retryAfter: 0 });
    var parts = [];
    var map = [];
    lines.forEach(function (line) {
      var chunks = splitLong(line, 1800);
      map.push({ start: parts.length, count: chunks.length });
      parts.push.apply(parts, chunks);
    });
    return translateMissing(parts).then(function (result) {
      return {
        lines: map.map(function (item) {
          return result.lines.slice(item.start, item.start + item.count).join(" ").trim();
        }),
        pending: result.pending,
        retryAfter: result.retryAfter
      };
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

  function seedLineCache(sourceValue, targetValue) {
    var sourceLines = normalizeLines(sourceValue);
    var targetLines = normalizeLines(targetValue);
    if (!sourceLines.length || sourceLines.length !== targetLines.length) return;
    sourceLines.forEach(function (line, index) {
      var translated = String(targetLines[index] || "").trim();
      if (translated && translated !== line) cache[line] = translated;
    });
    saveCache();
  }

  function bindPair(sourceId, targetId, key, listMode) {
    var source = document.getElementById(sourceId);
    var target = document.getElementById(targetId);
    if (!source || !target || source.dataset.ahAutoTranslate === "1") return;

    target.readOnly = true;
    target.tabIndex = -1;
    bindPairByElements(source, target, key);
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
    var form = source.closest && source.closest("form");
    if (!form || form.dataset.recovered !== "1") seedLineCache(source.value, target.value);
    source.dataset.ahAutoTranslate = "1";
    var timer = 0;
    var version = 0;
    var retries = 0;
    function run() {
      if (!source.isConnected) return;
      var current = ++version;
      var raw = source.value;
      if (!source.value.trim()) {
        target.value = "";
        setStatus(key, "");
        return;
      }
      setStatus(key, "Превеждане…");
      translateList(raw).then(function (result) {
        if (current !== version || !source.isConnected || source.value !== raw) return;
        if (result.pending) {
          setStatus(key, retries < 2 ? "English preview се дообработва автоматично…" : "Преводът е временно недостъпен. Опитайте запис отново след малко.", retries >= 2);
          clearTimeout(timer);
          if (retries++ < 2) timer = setTimeout(run, result.retryAfter || 3500);
        } else {
          target.value = result.lines.join("\n");
          setStatus(key, "English preview е обновен.");
        }
      }).catch(function () {
        if (current !== version || !source.isConnected) return;
        setStatus(key, "Преводът е временно недостъпен. Опитайте запис отново след малко.", true);
      });
    }
    source.addEventListener("input", function () {
      version++; retries = 0;
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
      if (values.some(function (value) { return value.pending; })) {
        var error = new Error("Преводът е временно недостъпен. Текстът е запазен на този екран. Опитайте запис отново след малко.");
        error.code = "TRANSLATION_UNAVAILABLE";
        throw error;
      }
      body.notes_en = values[0].lines;
      body.equipment_en = values[1].lines;
      var next = Object.assign({}, init, { body: JSON.stringify(body) });
      // A failed write may already have reached the server. Never retry it
      // implicitly, and never save Bulgarian fallback text as English.
      return baseFetch(input, next);
    });
  };

  loadCache();
  var observer = new MutationObserver(bindAll);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bindAll);
  else bindAll();
})();
