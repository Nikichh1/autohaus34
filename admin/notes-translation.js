/* AutoHaus automatic note translation.
   The admin is Bulgarian-only. Bulgarian notes are the source of truth and a
   live read-only English preview is kept beside them for the public EN site. */
(function () {
  "use strict";

  /* The admin no longer has a language switch. Clear any old preference before
     admin.js reads it so a browser that was previously set to EN opens in BG. */
  try { localStorage.removeItem("ah-admin-language"); } catch (_) {}
  document.documentElement.lang = "bg";

  var baseFetch = window.fetch.bind(window);
  var CACHE_KEY = "autohaus-note-translation-v2";
  var cache = Object.create(null);
  var pending = Object.create(null);
  var bindObserver;

  /* Current AutoHaus note vocabulary is deterministic and should never depend
     on an external translation service. Unknown future notes still use the
     server translation endpoint and are cached once translated. */
  var KNOWN = {
    "Автомобил с 6+1 места": "6+1-seat vehicle",
    "Автомобил с удължено междуосие Long Wheelbase (LWB)": "Long Wheelbase (LWB) vehicle",
    "Автомобилът е с електроника и компоненти за повишаване на мощността до 800 к.с.!": "Electronics and components fitted to increase power to 800 hp!",
    "Автомобилът е цялостно облепен в предпазно фолио с матиращ ефект!": "Fully wrapped in protective film with a matte effect!",
    "Автомобилът е цялостно облепен с предпазно фолио в светло сив цвят!": "Fully wrapped in light-grey protective film!",
    "Автомобилът е цялостно фолиран в сив мат.": "Fully wrapped in matte grey film.",
    "Автомобилът е цялостно фолиран с предпазно фолио черен мат!": "Fully wrapped in matte-black protective film!",
    "Автомобиълт е облепен с безцветно предпазно фолио!": "The vehicle is covered with clear protective film!",
    "Възможен бартер!": "Part-exchange available!",
    "Възможен лизинг!": "Leasing available!",
    "Добавен екстериорен пакет от G63 AMG!": "G63 AMG exterior package added!",
    "Добавена е спортна изпускателна система MILLTEK Sport!": "MILLTEK Sport exhaust system added!",
    "Проверка на кола!": "Car inspection available!",
    "Пълна сервизна история!": "Full service history!",
    "Сертификат N1 за товарен автомобил!": "N1 commercial-vehicle certificate!",
    "Удължена фабрична гаранция до 01.2031 г. или 200 000 км.": "Extended factory warranty until 01/2031 or 200,000 km.",
    "Удължена фабрична гаранция до 03.2027 г. или 200 000 км.!": "Extended factory warranty until 03/2027 or 200,000 km!",
    "Удължена фабрична гаранция до 5 години от първа регистрация или 200 000 км.!": "Extended factory warranty for up to 5 years from first registration or 200,000 km!",
    "Фабрична гаранция до 07.2026 г. или 200 000 км.!": "Factory warranty until 07/2026 or 200,000 km!",
    "Фабрично нов автомобил!": "Brand-new vehicle!",
    "Цена без начислен 20% ДДС": "Price excluding 20% VAT",
    "Цена без начислен 20% ДДС!": "Price excluding 20% VAT!"
  };

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
            throw new Error(data && data.error || "Автоматичният превод за новия ред временно не е наличен.");
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
        throw new Error("Английският превод не е пълен.");
      }
      return translated;
    });
  }

  /* Translation is enrichment, never a reason to lose an admin edit. For the
     current vocabulary this path is fully local. If a brand-new sentence and
     the translation service both fail, save the Bulgarian edit and keep the
     existing English value until translation is available again. */
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
      return baseFetch(input, Object.assign({}, init, { body: JSON.stringify(body) }));
    }).catch(function () {
      return baseFetch(input, init);
    });
  };

  function ensureUI(textarea) {
    var label = textarea && textarea.closest && textarea.closest("label.field");
    if (!label) return {};
    var status = label.querySelector(".ah-note-translation-status");
    if (!status) {
      status = document.createElement("small");
      status.className = "field-hint ah-note-translation-status";
      status.setAttribute("role", "status");
      status.style.cssText = "display:block;margin-top:7px;min-height:1.2em";
      label.appendChild(status);
    }

    var preview = label.parentNode && label.parentNode.querySelector(":scope > .ah-note-preview");
    if (!preview && label.parentNode) {
      preview = document.createElement("div");
      preview.className = "field ah-note-preview";
      preview.style.cssText = "margin-top:14px";
      preview.innerHTML = '<span style="display:block;margin-bottom:8px;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase">Преглед на английски · автоматичен</span>' +
        '<textarea class="ah-note-preview-box" readonly spellcheck="false" aria-label="Преглед на бележките на английски" style="width:100%;min-height:132px;resize:vertical;background:#f5f5f3;color:#222;border:1px solid #aaa;padding:12px 14px;font:inherit;line-height:1.5"></textarea>';
      label.insertAdjacentElement("afterend", preview);
    }
    return { status: status, box: preview && preview.querySelector(".ah-note-preview-box") };
  }

  function bindNotes() {
    var form = document.getElementById("car-form");
    var textarea = form && form.elements && form.elements.notes;
    if (!textarea || textarea.dataset.ahAutoTranslate === "1") return;
    textarea.dataset.ahAutoTranslate = "1";
    var ui = ensureUI(textarea);
    var status = ui.status, box = ui.box;
    var timer = 0, sequence = 0;

    function renderKnown(lines) {
      if (!box) return;
      box.value = lines.map(function (line) { return cache[line] || "…"; }).join("\n");
    }

    function run() {
      var version = ++sequence;
      var lines = lineList(textarea.value);
      if (!lines.length) {
        if (status) status.textContent = "";
        if (box) box.value = "";
        return;
      }
      renderKnown(lines);
      var hasMissing = lines.some(function (line) { return !cache[line]; });
      if (status) status.textContent = hasMissing ? "Превеждане на новия текст…" : "Английският преглед е готов.";
      translateNotes(lines).then(function (translated) {
        if (version !== sequence || !textarea.isConnected) return;
        if (box) box.value = translated.join("\n");
        if (status) status.textContent = "Английският преглед е готов.";
      }).catch(function (error) {
        if (version !== sequence || !textarea.isConnected) return;
        if (status) status.textContent = error.message;
      });
    }

    textarea.addEventListener("input", function () {
      clearTimeout(timer);
      var lines = lineList(textarea.value);
      renderKnown(lines);
      if (status) status.textContent = "Подготовка на английския преглед…";
      timer = setTimeout(run, 180);
    });
    setTimeout(run, 0);
  }

  loadCache();
  bindObserver = new MutationObserver(function () { bindNotes(); });
  bindObserver.observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bindNotes);
  else bindNotes();
})();
