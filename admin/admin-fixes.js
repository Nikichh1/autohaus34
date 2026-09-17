/* Scoped AutoHaus admin polish: defaults, VAT, equipment-only UI and global image settings. */
(function () {
  "use strict";

  var DEFAULT_NOTES = [
    "Пълна сервизна история!",
    "Възможен бартер!",
    "Възможен лизинг!"
  ];
  var VAT_NOTE = "Цена без начислен 20% ДДС";
  var originalFetch = window.fetch.bind(window);

  function tr(bg, en) {
    return document.documentElement.lang === "en" ? en : bg;
  }

  function apiUrl(input) {
    try {
      var raw = typeof input === "string" ? input : input && input.url;
      return new URL(raw, location.href);
    } catch (_) { return null; }
  }

  function vehicleApi(input) {
    var url = apiUrl(input);
    return !!url && url.origin === location.origin && url.pathname === "/api/admin/vehicles";
  }

  function descriptionApi(input) {
    var url = apiUrl(input);
    return !!url && url.origin === location.origin && url.pathname === "/api/admin/description";
  }

  function currentForm() { return document.getElementById("car-form"); }

  function responseWithJson(response, value) {
    var headers = new Headers(response.headers);
    headers.set("Content-Type", "application/json; charset=utf-8");
    return new Response(JSON.stringify(value), {
      status: response.status,
      statusText: response.statusText,
      headers: headers
    });
  }

  window.fetch = function (input, init) {
    init = init || {};
    var method = String(init.method || "GET").toUpperCase();

    /* The core editor still expects description fields internally. Keep their
       stored values intact while the visible workflow is equipment-only. */
    if (descriptionApi(input) && method === "POST") {
      var formAtRequest = currentForm();
      var keepBg = formAtRequest && document.getElementById("desc-bg") ? document.getElementById("desc-bg").value : "";
      var keepEn = formAtRequest && document.getElementById("desc-en") ? document.getElementById("desc-en").value : "";
      return originalFetch(input, init).then(function (response) {
        if (!response.ok) return response;
        return response.clone().json().then(function (data) {
          if (data && data.result) {
            data.result.description_bg = keepBg;
            data.result.description_en = keepEn;
          }
          return responseWithJson(response, data);
        }).catch(function () { return response; });
      });
    }

    if (!vehicleApi(input)) return originalFetch(input, init);

    var next = Object.assign({}, init);
    var headers = new Headers(init.headers || {});
    if (method === "DELETE") {
      if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
      next.headers = headers;
      return originalFetch(input, next);
    }

    if ((method === "POST" || method === "PATCH" || method === "PUT") && typeof init.body === "string") {
      var form = currentForm();
      var vat = form && form.elements && form.elements.show_price_without_vat;
      if (vat) {
        try {
          var body = JSON.parse(init.body);
          if (Array.isArray(body.notes)) {
            body.notes = body.notes.filter(function (note) { return !/ДДС/i.test(String(note || "")); });
            if (vat.checked) {
              var originalVat = form.dataset.ahOriginalVatNote || "";
              var initiallyChecked = vat.dataset.initialChecked === "true";
              body.notes.push(initiallyChecked && originalVat ? originalVat : VAT_NOTE);
            }
          }
          next.body = JSON.stringify(body);
        } catch (_) {}
      }
    }

    next.headers = headers;
    return originalFetch(input, next);
  };

  function removeSecurityEntry() {
    var button = document.querySelector('.side__nav [data-route="security"]');
    if (button) button.remove();
    if (location.hash.slice(1) === "security" && window.AH_ADMIN && typeof window.AH_ADMIN.go === "function") {
      window.AH_ADMIN.go("dashboard");
    }
  }

  function setText(selector, bg, en) {
    var el = document.querySelector(selector);
    if (el) el.textContent = tr(bg, en);
  }

  function simplifyEquipmentEditor(form) {
    var section = document.getElementById("description");
    if (!section) return;

    setText("#description > h2", "Оборудване", "Equipment");
    setText("#description-generator > summary", "Генериране на оборудване от поставен текст (по избор)", "Generate equipment from pasted text (optional)");
    setText("#source-help", "Поставете списък или текст с оборудването. Системата ще го подреди и преведе на български и английски. Изходният текст не се показва на сайта.", "Paste an equipment list or source text. It will be structured and translated into Bulgarian and English. The source text is not shown on the website.");
    setText('#description-generator label.field > span', "Поставете оригиналното оборудване тук", "Paste the original equipment here");
    var source = document.getElementById("source-text");
    if (source) source.placeholder = tr("Напр. кодове и списък с оборудване…", "For example: option codes and equipment list…");
    setText("#process-description", "Генерирай оборудване BG + EN", "Generate equipment BG + EN");
    setText("#processor-note", "Резултатът ще попълни оборудването на двата езика по-долу. Проверете го преди запис.", "The result will fill the equipment in both languages below. Review it before saving.");
    setText(".processor-results .workflow-heading", "Оборудване за сайта", "Website equipment");
    var resultHint = section.querySelector(".processor-results > .field-hint");
    if (resultHint) resultHint.textContent = tr("Редактирайте оборудването директно или използвайте генерирането по-горе. Проверете BG и EN преди запис.", "Edit the equipment directly or use the generator above. Check BG and EN before saving.");

    ["desc-bg", "desc-en"].forEach(function (id) {
      var area = document.getElementById(id);
      var label = area && area.closest("label.field");
      if (label) {
        label.hidden = true;
        label.setAttribute("aria-hidden", "true");
      }
    });

    var shortcut = document.querySelector('.editor-shortcuts a[data-scroll="description"]');
    if (shortcut) shortcut.textContent = tr("Оборудване", "Equipment");
  }

  function enhanceEditor() {
    var form = currentForm();
    if (!form) return;

    simplifyEquipmentEditor(form);
    var oldWatermark = document.getElementById("image-watermark-option");
    if (oldWatermark) oldWatermark.remove();

    var notes = form.elements && form.elements.notes;
    var price = form.elements && form.elements.price;
    if (!notes || !price) return;
    price.placeholder = tr("Цена при запитване", "Price on request");

    if (form.dataset.ahScopedFixes === "1") return;
    form.dataset.ahScopedFixes = "1";
    var isNew = !document.getElementById("delete-car");
    if (isNew && !notes.value.trim()) notes.value = DEFAULT_NOTES.join("\n\n");

    var noteLines = String(notes.value || "").split(/\r?\n/);
    var originalVat = "";
    var cleanNotes = noteLines.filter(function (line) {
      if (!originalVat && /ДДС/i.test(line)) { originalVat = line.trim(); return false; }
      return true;
    });
    notes.value = cleanNotes.join("\n").replace(/\n{3,}/g, "\n\n").trim();
    form.dataset.ahOriginalVatNote = originalVat;

    var priceLabel = price.closest("label.field");
    if (!priceLabel || !priceLabel.parentNode || priceLabel.parentNode.classList.contains("ah-price-vat")) return;
    var wrapper = document.createElement("div");
    wrapper.className = "ah-price-vat";
    wrapper.style.display = "grid";
    wrapper.style.gap = "8px";
    wrapper.style.alignSelf = "start";
    wrapper.style.minWidth = "0";
    priceLabel.parentNode.insertBefore(wrapper, priceLabel);
    wrapper.appendChild(priceLabel);

    var check = document.createElement("label");
    check.className = "check";
    check.style.alignSelf = "start";
    var input = document.createElement("input");
    input.type = "checkbox";
    input.name = "show_price_without_vat";
    input.checked = isNew ? true : !!originalVat;
    input.dataset.initialChecked = String(input.checked);
    var text = document.createElement("span");
    text.textContent = tr(VAT_NOTE, "Price excluding 20% VAT");
    check.appendChild(input);
    check.appendChild(text);
    wrapper.appendChild(check);

    var pairedField = wrapper.nextElementSibling;
    if (pairedField && pairedField.classList.contains("field")) pairedField.style.alignSelf = "start";
  }

  function ensureSettingsButton() {
    var nav = document.querySelector(".side__nav");
    if (!nav || nav.querySelector('[data-route="settings"]')) return;
    var button = document.createElement("button");
    button.type = "button";
    button.dataset.route = "settings";
    button.dataset.bg = "Настройки";
    button.dataset.en = "Settings";
    button.textContent = tr("Настройки", "Settings");
    nav.appendChild(button);
  }

  function refreshScopedFixes() {
    ensureSettingsButton();
    removeSecurityEntry();
    enhanceEditor();
  }

  ensureSettingsButton();
  var observer = new MutationObserver(refreshScopedFixes);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("hashchange", removeSecurityEntry);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", refreshScopedFixes);
  else refreshScopedFixes();
})();

/* Global watermark settings. There is deliberately no per-product checkbox:
   every upload reads the shared Settings value before it enters the normal
   responsive image pipeline. */
(function () {
  "use strict";

  var DEFAULT_SETTINGS = { watermark_enabled: false, watermark_transparency: 75 };
  var settings = null;
  var settingsPromise = null;
  var settingsAt = 0;
  var watermarkBusy = false;
  var logoPromise = null;

  function tr(bg, en) { return document.documentElement.lang === "en" ? en : bg; }
  function esc(value) { return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) { return ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[c]; }); }

  function setStatus(message) {
    var status = document.getElementById("upload-status");
    if (status) status.textContent = message;
  }

  function normalizedSettings(value) {
    value = value || {};
    var transparency = Math.round(Number(value.watermark_transparency));
    if (!Number.isFinite(transparency)) transparency = 75;
    return {
      watermark_enabled: value.watermark_enabled === true,
      watermark_transparency: Math.max(0, Math.min(100, transparency))
    };
  }

  async function getSettings(force) {
    if (!force && settings && Date.now() - settingsAt < 30000) return settings;
    if (!force && settingsPromise) return settingsPromise;
    settingsPromise = fetch("/api/admin/settings", { credentials: "same-origin", headers: { Accept: "application/json" } })
      .then(function (response) { return response.ok ? response.json() : Promise.reject(new Error("settings")); })
      .then(function (data) {
        settings = normalizedSettings(data.settings);
        settingsAt = Date.now();
        return settings;
      }).catch(function () {
        settings = Object.assign({}, DEFAULT_SETTINGS);
        settingsAt = Date.now();
        return settings;
      }).finally(function () { settingsPromise = null; });
    return settingsPromise;
  }

  window.addEventListener("ah:admin-settings", function (event) {
    settings = normalizedSettings(event.detail || {});
    settingsAt = Date.now();
  });

  function loadLogo() {
    if (logoPromise) return logoPromise;
    logoPromise = new Promise(function (resolve, reject) {
      var logo = new Image();
      logo.onload = function () { resolve(logo); };
      logo.onerror = function () { reject(new Error("AutoHaus logo could not be loaded")); };
      logo.src = "/autohaus.svg";
    });
    return logoPromise;
  }

  async function watermarkFile(file, transparency) {
    var url = URL.createObjectURL(file);
    var image = new Image();
    try {
      image.src = url;
      await image.decode();
      if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 140000000) {
        throw new Error(tr("Снимката е с неподдържан размер.", "The photo dimensions are not supported."));
      }

      var scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
      var width = Math.max(1, Math.round(image.naturalWidth * scale));
      var height = Math.max(1, Math.round(image.naturalHeight * scale));
      var canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      var ctx = canvas.getContext("2d");
      if (!ctx) throw new Error(tr("Браузърът не може да обработи снимката.", "The browser cannot process this photo."));
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.fillStyle = "#f6f5f1";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(image, 0, 0, width, height);

      var logo = await loadLogo();
      var ratio = (logo.naturalWidth || 482) / (logo.naturalHeight || 85);
      var logoWidth = Math.min(width * 0.34, height * 0.14 * ratio);
      var logoHeight = logoWidth / ratio;
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, 1 - transparency / 100));
      ctx.drawImage(logo, (width - logoWidth) / 2, (height - logoHeight) / 2, logoWidth, logoHeight);
      ctx.restore();

      var blob = await new Promise(function (resolve) { canvas.toBlob(resolve, "image/png"); });
      canvas.width = 1; canvas.height = 1;
      if (!blob) throw new Error(tr("Водният знак не можа да бъде приложен.", "The watermark could not be applied."));
      var stem = String(file.name || "photo").replace(/\.[^.]+$/, "");
      return new File([blob], stem + "-watermarked.png", { type: "image/png", lastModified: file.lastModified || Date.now() });
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  document.addEventListener("change", function (event) {
    var target = event.target;
    if (!target || (target.id !== "image-input" && target.id !== "camera-input")) return;
    if (target.dataset.ahPrepared === "1") {
      delete target.dataset.ahPrepared;
      return;
    }
    if (!target.files || !target.files.length) return;

    /* Always pause the core handler for the first event. This lets the global
       setting arrive before any file can enter the uploader. */
    event.preventDefault();
    event.stopImmediatePropagation();
    if (watermarkBusy) return;
    watermarkBusy = true;
    var sourceFiles = Array.from(target.files);

    (async function () {
      try {
        var current = await getSettings(true);
        var prepared = sourceFiles;
        if (current.watermark_enabled) {
          prepared = [];
          for (var i = 0; i < sourceFiles.length; i++) {
            setStatus(tr("Воден знак: ", "Watermark: ") + (i + 1) + " / " + sourceFiles.length);
            prepared.push(await watermarkFile(sourceFiles[i], current.watermark_transparency));
          }
        }
        var transfer = new DataTransfer();
        prepared.forEach(function (file) { transfer.items.add(file); });
        target.files = transfer.files;
        target.dataset.ahPrepared = "1";
        target.dispatchEvent(new Event("change", { bubbles: true }));
      } catch (error) {
        console.error(error);
        setStatus(tr("Снимките не са качени, защото обработката не успя. Опитайте отново.", "The photos were not uploaded because processing failed. Try again."));
      } finally {
        watermarkBusy = false;
      }
    })();
  }, true);

  /* The settings route is added before admin.js binds the sidebar. At
     DOMContentLoaded advanced.js has already installed its own extra routes,
     so wrap rather than replace that renderer. */
  function installSettingsRoute() {
    var app = window.AH_ADMIN;
    var view = document.getElementById("admin-view");
    if (!app || !view || app.__settingsInstalled) return;
    app.__settingsInstalled = true;
    var previous = app.renderExtra;

    function settingsPage() {
      var t = app.t;
      view.innerHTML = '<div class="view-head"><div class="view-title"><p>AutoHaus</p><h1>' + esc(t("Настройки", "Settings")) + '</h1></div></div>' +
        '<section class="panel"><div class="panel-head"><h2>' + esc(t("Воден знак върху снимките", "Photo watermark")) + '</h2></div>' +
        '<div id="ah-settings-body" style="padding:20px;max-width:760px"><p class="muted">' + esc(t("Зареждане…", "Loading…")) + '</p></div></section>';
      var body = document.getElementById("ah-settings-body");
      getSettings(true).then(function (value) {
        if (!body || !body.isConnected) return;
        var disabled = app.canWrite ? "" : " disabled";
        body.innerHTML = '<form id="ah-settings-form" style="display:grid;gap:22px">' +
          '<label class="check" style="align-items:flex-start"><input id="ah-watermark-enabled" type="checkbox"' + (value.watermark_enabled ? " checked" : "") + disabled + '><span><strong>' +
          esc(t("Добавяй AutoHaus воден знак автоматично", "Add the AutoHaus watermark automatically")) + '</strong><br><small class="muted">' +
          esc(t("При включване се прилага в центъра на всяка нова продуктова снимка преди оптимизацията.", "When enabled, it is applied to the centre of every newly uploaded product image before optimization.")) + '</small></span></label>' +
          '<label class="field" style="max-width:520px"><span>' + esc(t("Прозрачност", "Transparency")) + ' — <b id="ah-watermark-value">' + value.watermark_transparency + '%</b></span>' +
          '<input id="ah-watermark-transparency" type="range" min="0" max="100" step="1" value="' + value.watermark_transparency + '"' + disabled + '></label>' +
          '<p class="muted" style="margin:0">' + esc(t("75% е стойността по подразбиране. Настройката е глобална и важи за всички автомобили.", "75% is the default. This is a global setting and applies to every vehicle.")) + '</p>' +
          (app.canWrite ? '<div><button class="primary" type="submit" id="ah-settings-save">' + esc(t("Запази настройките", "Save settings")) + '</button></div>' : '') +
          '<div id="ah-settings-status" class="muted" role="status"></div></form>';
        var range = document.getElementById("ah-watermark-transparency");
        var valueLabel = document.getElementById("ah-watermark-value");
        if (range) range.oninput = function () { valueLabel.textContent = range.value + "%"; };
        var form = document.getElementById("ah-settings-form");
        if (form && app.canWrite) form.onsubmit = async function (event) {
          event.preventDefault();
          var save = document.getElementById("ah-settings-save");
          var status = document.getElementById("ah-settings-status");
          save.disabled = true;
          status.textContent = t("Записване…", "Saving…");
          try {
            var response = await fetch("/api/admin/settings", {
              method: "PATCH", credentials: "same-origin",
              headers: { Accept: "application/json", "Content-Type": "application/json" },
              body: JSON.stringify({
                watermark_enabled: document.getElementById("ah-watermark-enabled").checked,
                watermark_transparency: Number(range.value)
              })
            });
            var data = await response.json().catch(function () { return {}; });
            if (!response.ok) throw new Error(data.error || t("Настройките не бяха записани.", "Settings could not be saved."));
            settings = normalizedSettings(data.settings);
            settingsAt = Date.now();
            window.dispatchEvent(new CustomEvent("ah:admin-settings", { detail: settings }));
            status.textContent = t("Настройките са записани.", "Settings saved.");
          } catch (error) {
            status.textContent = error.message;
          } finally { save.disabled = false; }
        };
      });
    }

    app.renderExtra = function (route) {
      if (route === "settings") { settingsPage(); return true; }
      return previous ? previous(route) : false;
    };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", installSettingsRoute);
  else setTimeout(installSettingsRoute, 0);
})();
