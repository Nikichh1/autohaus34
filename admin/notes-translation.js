/* AutoHaus automatic note translation.
   Bulgarian notes remain the editor source of truth; English is prepared while
   the user types and is guaranteed again immediately before a vehicle save. */
(function () {
  "use strict";

  var baseFetch = window.fetch.bind(window);
  var CACHE_KEY = "autohaus-note-translation-v1";
  var cache = Object.create(null);
  var pending = Object.create(null);
  var bindObserver;

  var KNOWN = {
    "Пълна сервизна история!": "Full service history!",
    "Възможен бартер!": "Part-exchange available!",
    "Възможен лизинг!": "Leasing available!",
    "Цена без начислен 20% ДДС": "Price excluding 20% VAT",
    "Цена без начислен 20% ДДС!": "Price excluding 20% VAT!"
  };

  function tr(bg, en) { return document.documentElement.lang === "en" ? en : bg; }
  function lineList(value) {
    var source = Array.isArray(value) ? value : String(value || "").split(/\r?\n/);
    return source.map(function (line) { return String(line || "").trim(); }).filter(Boolean);
  }
  function loadCache() {
    try {
      var stored = JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");
      if (stored && typeof stored === "object") cache = stored;
    } catch (_) {}
    Object.keys(KNOWN).forEach(function (key) { cache[key] = KNOWN[key]; });
  }
  function saveCache() {
    var keys = Object.keys(cache);
    if (keys.length > 500) keys.slice(0, keys.length - 500).forEach(function (key) { if (!KNOWN[key]) delete cache[key]; });
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch (_) {}
  }
  function apiUrl(input) {
    try { return new URL(typeof input === "string" ? input : input && input.url, location.href); }
    catch (_) { return null; }
  }
  function errorResponse(message) {
    return new Response(JSON.stringify({ ok: false, error: message, code: "NOTES_TRANSLATION_REQUIRED" }), {
      status: 422,
      headers: { "Content-Type": "application/json; charset=utf-8" }
    });
  }

  function translateMissing(lines) {
    var missing = [];
    var seen = Object.create(null);
    lines.forEach(function (line) {
      if (!cache[line] && !seen[line]) { seen[line] = true; missing.push(line); }
    });
    if (!missing.length) return Promise.resolve(lines.map(function (line) { return cache[line] || line; }));

    var requestKey = JSON.stringify(missing);
    if (!pending[requestKey]) {
      pending[requestKey] = baseFetch("/api/admin/description?action=translate", {
        method: "POST",
        credentials: "same-origin",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ target: "en", lines: missing })
      }).then(function (response) {
        return response.json().catch(function () { return {}; }).then(function (data) {
          if (!response.ok || !data || data.ok !== true || !Array.isArray(data.lines) || data.lines.length !== missing.length) {
            throw new Error(data && data.error || tr("Автоматичният превод временно не успя.", "Automatic translation is temporarily unavailable."));
          }
          missing.forEach(function (line, index) { cache[line] = String(data.lines[index] || "").trim(); });
          saveCache();
          return true;
        });
      }).finally(function () { delete pending[requestKey]; });
    }
    return pending[requestKey].then(function () { return lines.map(function (line) { return cache[line] || line; }); });
  }

  function translateNotes(value) {
    var lines = lineList(value);
    if (!lines.length) return Promise.resolve([]);
    return translateMissing(lines).then(function (translated) {
      if (translated.length !== lines.length || translated.some(function (line) { return !String(line || "").trim(); })) {
        throw new Error(tr("Английският превод не е пълен.", "The English translation is incomplete."));
      }
      return translated;
    });
  }

  /* This wrapper is installed BEFORE admin-fixes.js. The later VAT wrapper
     therefore edits the Bulgarian note array first, then reaches us, so the
     English array always matches exactly what will actually be saved. */
  window.fetch = function (input, init) {
    init = init || {};
    var url = apiUrl(input);
    var method = String(init.method || "GET").toUpperCase();
    var isVehicleWrite = url && url.origin === location.origin && url.pathname === "/api/admin/vehicles" &&
      (method === "POST" || method === "PATCH" || method === "PUT") && typeof init.body === "string";
    if (!isVehicleWrite) return baseFetch(input, init);

    var body;
    try { body = JSON.parse(init.body); } catch (_) { return baseFetch(input, init); }
    if (!Array.isArray(body.notes)) return baseFetch(input, init);

    return translateNotes(body.notes).then(function (notesEn) {
      body.notes_en = notesEn;
      var next = Object.assign({}, init, { body: JSON.stringify(body) });
      return baseFetch(input, next);
    }).catch(function (error) {
      return errorResponse(error && error.message || tr("Автоматичният превод временно не успя.", "Automatic translation is temporarily unavailable."));
    });
  };

  function ensureStatus(textarea) {
    var label = textarea && textarea.closest && textarea.closest("label.field");
    if (!label) return null;
    var status = label.querySelector(".ah-note-translation-status");
    if (status) return status;
    status = document.createElement("small");
    status.className = "field-hint ah-note-translation-status";
    status.setAttribute("role", "status");
    status.style.cssText = "display:block;margin-top:7px;min-height:1.2em";
    label.appendChild(status);
    return status;
  }

  function bindNotes() {
    var form = document.getElementById("car-form");
    var textarea = form && form.elements && form.elements.notes;
    if (!textarea || textarea.dataset.ahAutoTranslate === "1") return;
    textarea.dataset.ahAutoTranslate = "1";
    var status = ensureStatus(textarea);
    var timer = 0, sequence = 0;

    function run() {
      var version = ++sequence;
      var lines = lineList(textarea.value);
      if (!lines.length) { if (status) status.textContent = ""; return; }
      if (status) status.textContent = tr("Превеждане на английски…", "Preparing English translation…");
      translateNotes(lines).then(function () {
        if (version !== sequence || !textarea.isConnected) return;
        if (status) status.textContent = tr("Английският превод е готов.", "English translation ready.");
      }).catch(function (error) {
        if (version !== sequence || !textarea.isConnected) return;
        if (status) status.textContent = error.message;
      });
    }

    textarea.addEventListener("input", function () {
      clearTimeout(timer);
      if (status) status.textContent = tr("Подготовка на превода…", "Preparing translation…");
      timer = setTimeout(run, 220);
    });
    setTimeout(run, 0);
  }

  loadCache();
  bindObserver = new MutationObserver(function () { bindNotes(); });
  bindObserver.observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bindNotes);
  else bindNotes();
})();
