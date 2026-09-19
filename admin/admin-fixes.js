/* AutoHaus admin polish: defaults, VAT and global image settings. */
(function () {
  "use strict";

  var DEFAULT_NOTES = ["Пълна сервизна история!", "Възможен бартер!", "Възможен лизинг!"];
  var VAT_NOTE = "Цена без начислен 20% ДДС";
  var originalFetch = window.fetch.bind(window);
  var originalConfirm = window.confirm.bind(window);

  function tr(bg, en) { return document.documentElement.lang === "en" ? en : bg; }
  function currentForm() { return document.getElementById("car-form"); }
  function apiUrl(input) {
    try { return new URL(typeof input === "string" ? input : input && input.url, location.href); }
    catch (_) { return null; }
  }
  function isApi(input, path) {
    var url = apiUrl(input);
    return !!url && url.origin === location.origin && url.pathname === path;
  }
  function responseWithJson(response, value) {
    var headers = new Headers(response.headers);
    headers.set("Content-Type", "application/json; charset=utf-8");
    return new Response(JSON.stringify(value), { status: response.status, statusText: response.statusText, headers: headers });
  }

  /* Keep legacy description values internally so older records remain lossless,
     while the visible editor and generator are equipment-only. */
  window.fetch = function (input, init) {
    init = init || {};
    var method = String(init.method || "GET").toUpperCase();

    if (isApi(input, "/api/admin/description") && method === "POST") {
      var bg = document.getElementById("desc-bg");
      var en = document.getElementById("desc-en");
      var keepBg = bg ? bg.value : "";
      var keepEn = en ? en.value : "";
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

    if (!isApi(input, "/api/admin/vehicles")) return originalFetch(input, init);
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
              body.notes.push(vat.dataset.initialChecked === "true" && originalVat ? originalVat : VAT_NOTE);
            }
          }
          next.body = JSON.stringify(body);
        } catch (_) {}
      }
    }
    next.headers = headers;
    return originalFetch(input, next);
  };

  window.confirm = function (message) {
    var text = String(message || "");
    if (/описанието и оборудването/i.test(text) || /description and equipment/i.test(text)) {
      return originalConfirm(tr("Обработката ще замени оборудването. Да продължим?", "Processing will replace the equipment. Continue?"));
    }
    return originalConfirm(message);
  };

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

  function removeSecurityEntry() {
    var button = document.querySelector('.side__nav [data-route="security"]');
    if (button) button.remove();
    if (location.hash.slice(1) === "security" && window.AH_ADMIN && typeof window.AH_ADMIN.go === "function") window.AH_ADMIN.go("dashboard");
  }

  function setText(selector, bg, en) {
    var el = document.querySelector(selector);
    var wanted = tr(bg, en);
    if (el && el.textContent !== wanted) el.textContent = wanted;
  }

  function simplifyEquipmentEditor() {
    var section = document.getElementById("description");
    if (!section) return;
    setText("#description > .section-title h2, #description > h2", "Оборудване", "Equipment");
    var shortcut = document.querySelector('.editor-shortcuts a[data-scroll="description"]');
    if (shortcut) shortcut.textContent = tr("Оборудване", "Equipment");
  }

  function enhanceEditor() {
    var form = currentForm();
    if (!form) return;
    simplifyEquipmentEditor();
    var obsolete = document.getElementById("image-watermark-option");
    if (obsolete) obsolete.remove();

    var notes = form.elements && form.elements.notes;
    var price = form.elements && form.elements.price;
    if (!notes || !price) return;
    var pricePlaceholder = tr("Цена при запитване", "Price on request");
    if (price.placeholder !== pricePlaceholder) price.placeholder = pricePlaceholder;
    if (form.dataset.ahScopedFixes === "1") return;
    form.dataset.ahScopedFixes = "1";

    var isNew = !document.getElementById("delete-car");
    if (isNew && !notes.value.trim()) notes.value = DEFAULT_NOTES.join("\n\n");
    var originalVat = "";
    notes.value = String(notes.value || "").split(/\r?\n/).filter(function (line) {
      if (!originalVat && /ДДС/i.test(line)) { originalVat = line.trim(); return false; }
      return true;
    }).join("\n").replace(/\n{3,}/g, "\n\n").trim();
    form.dataset.ahOriginalVatNote = originalVat;

    var priceLabel = price.closest("label.field");
    if (!priceLabel || !priceLabel.parentNode || priceLabel.parentNode.classList.contains("ah-price-vat")) return;
    var wrapper = document.createElement("div");
    wrapper.className = "ah-price-vat";
    wrapper.style.cssText = "display:grid;gap:8px;align-self:start;min-width:0";
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
    check.append(input, text);
    wrapper.appendChild(check);
  }

  var scheduled = false;
  function refresh() {
    scheduled = false;
    ensureSettingsButton();
    removeSecurityEntry();
    enhanceEditor();
  }
  function scheduleRefresh() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(refresh);
  }

  ensureSettingsButton();
  new MutationObserver(scheduleRefresh).observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("hashchange", scheduleRefresh);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", scheduleRefresh);
  else scheduleRefresh();
})();

/* Global image presentation settings and the Settings route. */
(function () {
  "use strict";
  var DEFAULT_SETTINGS = {
    watermark_enabled: false,
    watermark_transparency: 75,
    watermark_size: 34,
    photo_aspect_ratio: "16:9",
    photo_filter: "none"
  };
  var cached = null, cachedAt = 0, pending = null;

  function tr(bg, en) { return document.documentElement.lang === "en" ? en : bg; }
  function esc(value) { return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) { return ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]; }); }
  function normalize(value) {
    value = value || {};
    var n = Math.round(Number(value.watermark_transparency));
    var s = Math.round(Number(value.watermark_size));
    if (!Number.isFinite(n)) n = 75;
    if (!Number.isFinite(s)) s = 34;
    return {
      watermark_enabled: value.watermark_enabled === true,
      watermark_transparency: Math.max(0, Math.min(100, n)),
      watermark_size: Math.max(10, Math.min(60, s)),
      photo_aspect_ratio: value.photo_aspect_ratio === "16:10" ? "16:10" : "16:9",
      photo_filter: ["none", "bright", "showroom", "contrast"].indexOf(value.photo_filter) >= 0 ? value.photo_filter : "none"
    };
  }

  function getSettings(force) {
    if (!force && cached && Date.now() - cachedAt < 30000) return Promise.resolve(cached);
    if (!force && pending) return pending;
    pending = fetch("/api/admin/settings", { credentials: "same-origin", headers: { Accept: "application/json" }, cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error("settings"); return r.json(); })
      .then(function (data) { cached = normalize(data.settings); cachedAt = Date.now(); return cached; })
      .catch(function () { cached = Object.assign({}, DEFAULT_SETTINGS); cachedAt = Date.now(); return cached; })
      .finally(function () { pending = null; });
    return pending;
  }

  async function saveSettings(patch) {
    var response = await fetch("/api/admin/settings", {
      method: "PATCH",
      credentials: "same-origin",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(patch)
    });
    var data = await response.json().catch(function () { return {}; });
    if (!response.ok) throw new Error(data.error || tr("Настройките не бяха записани.", "Settings could not be saved."));
    cached = normalize(data.settings); cachedAt = Date.now();
    window.dispatchEvent(new CustomEvent("ah:admin-settings", { detail: cached }));
    return cached;
  }

  window.AH_ADMIN_MEDIA_SETTINGS = function (force) { return getSettings(!!force); };
  window.addEventListener("ah:admin-settings", function (event) { cached = normalize(event.detail); cachedAt = Date.now(); });

  function option(value, current, label) {
    return '<option value="' + esc(value) + '"' + (value === current ? " selected" : "") + '>' + esc(label) + '</option>';
  }

  function installRoute() {
    var app = window.AH_ADMIN, view = document.getElementById("admin-view");
    if (!app || !view || app.__watermarkSettingsRoute) return;
    app.__watermarkSettingsRoute = true;
    var previous = app.renderExtra;

    function renderSettings() {
      var t = app.t;
      view.innerHTML =
        '<div class="view-head"><div class="view-title"><p>AutoHaus</p><h1>' + esc(t("Настройки", "Settings")) + '</h1></div></div>' +
        '<section class="panel"><div class="panel-head"><h2>' + esc(t("Воден знак върху снимките", "Photo watermark")) + '</h2></div><div id="ah-watermark-settings" style="padding:20px;max-width:760px"><p class="muted">' + esc(t("Зареждане…", "Loading…")) + '</p></div></section>' +
        '<section class="panel" style="margin-top:20px"><div class="panel-head"><h2>' + esc(t("Формат и обработка на снимките", "Photo format and processing")) + '</h2></div><div id="ah-media-settings" style="padding:20px;max-width:760px"><p class="muted">' + esc(t("Зареждане…", "Loading…")) + '</p></div></section>';

      Promise.resolve(getSettings(true)).then(function (cfg) {
        var watermarkBody = document.getElementById("ah-watermark-settings");
        var mediaBody = document.getElementById("ah-media-settings");
        if (!watermarkBody || !mediaBody || !watermarkBody.isConnected || !mediaBody.isConnected) return;
        var disabled = app.canWrite ? "" : " disabled";

        watermarkBody.innerHTML =
          '<form id="ah-watermark-form" style="display:grid;gap:22px">' +
          '<label class="check" style="align-items:flex-start"><input id="ah-watermark-enabled" type="checkbox"' + (cfg.watermark_enabled ? " checked" : "") + disabled + '><span><strong>' + esc(t("Добавяй AutoHaus воден знак автоматично", "Add the AutoHaus watermark automatically")) + '</strong><br><small class="muted">' + esc(t("Показва се върху продуктовите снимки, без повторно компресиране на файловете.", "Shown on product photos without re-compressing the image files.")) + '</small></span></label>' +
          '<label class="field" style="max-width:520px"><span>' + esc(t("Прозрачност", "Transparency")) + ' — <b id="ah-watermark-value">' + cfg.watermark_transparency + '%</b></span><input id="ah-watermark-transparency" type="range" min="0" max="100" step="1" value="' + cfg.watermark_transparency + '"' + disabled + '></label>' +
          '<label class="field" style="max-width:520px"><span>' + esc(t("Размер", "Size")) + ' — <b id="ah-watermark-size-value">' + cfg.watermark_size + '%</b></span><input id="ah-watermark-size" type="range" min="10" max="60" step="1" value="' + cfg.watermark_size + '"' + disabled + '></label>' +
          (app.canWrite ? '<div><button class="primary" id="ah-watermark-save" type="submit">' + esc(t("Запази водния знак", "Save watermark")) + '</button></div>' : '') +
          '<div id="ah-watermark-status" class="muted" role="status"></div></form>';

        mediaBody.innerHTML =
          '<form id="ah-media-form" style="display:grid;gap:22px">' +
          '<label class="field" style="max-width:520px"><span><strong>' + esc(t("Формат на продуктовите снимки", "Product photo format")) + '</strong></span>' +
          '<select id="ah-photo-ratio"' + disabled + '>' +
          option("16:9", cfg.photo_aspect_ratio, "16:9 · Wide") +
          option("16:10", cfg.photo_aspect_ratio, "16:10 · По-висок кадър") +
          '</select><small class="field-hint">' + esc(t("Прилага се веднага върху всички стари снимки. Новите качвания се изрязват реално до избрания формат.", "Applied immediately to all existing photos. New uploads are physically cropped to the selected format.")) + '</small></label>' +
          '<label class="field" style="max-width:520px"><span><strong>' + esc(t("Филтър за светлина", "Photo lighting filter")) + '</strong></span>' +
          '<select id="ah-photo-filter"' + disabled + '>' +
          option("none", cfg.photo_filter, t("Без филтър", "No filter")) +
          option("bright", cfg.photo_filter, t("Светъл · + светлина", "Bright · more light")) +
          option("showroom", cfg.photo_filter, "Showroom · " + t("светлина + контраст + цвят", "light + contrast + colour")) +
          option("contrast", cfg.photo_filter, t("Контрастен · по-ясни детайли", "Contrast · clearer details")) +
          '</select><small class="field-hint">' + esc(t("Филтърът е глобален и недеструктивен — не създава нови файлове и не забавя изтеглянето на снимките.", "The filter is global and non-destructive — it creates no extra files and does not increase image download size.")) + '</small></label>' +
          '<div style="padding:14px 16px;border:1px solid var(--line);border-radius:8px;background:var(--soft)"><strong style="display:block;margin-bottom:4px">' + esc(t("Бързо зареждане", "Fast loading")) + '</strong><span class="muted">' + esc(t("Старите снимки не се копират или пре-енкодират. Запазваме responsive JPEG/WebP вариантите и прилагаме формата/филтъра при показване.", "Existing photos are not copied or re-encoded. Responsive JPEG/WebP variants stay intact; format and filter are applied when displayed.")) + '</span></div>' +
          (app.canWrite ? '<div><button class="primary" id="ah-media-save" type="submit">' + esc(t("Запази обработката на снимките", "Save photo processing")) + '</button></div>' : '') +
          '<div id="ah-media-status" class="muted" role="status"></div></form>';

        var range = document.getElementById("ah-watermark-transparency");
        var value = document.getElementById("ah-watermark-value");
        var sizeRange = document.getElementById("ah-watermark-size");
        var sizeValue = document.getElementById("ah-watermark-size-value");
        if (range) range.oninput = function () { value.textContent = range.value + "%"; };
        if (sizeRange) sizeRange.oninput = function () { sizeValue.textContent = sizeRange.value + "%"; };

        var watermarkForm = document.getElementById("ah-watermark-form");
        if (watermarkForm && app.canWrite) watermarkForm.onsubmit = async function (event) {
          event.preventDefault();
          var save = document.getElementById("ah-watermark-save");
          var message = document.getElementById("ah-watermark-status");
          save.disabled = true; message.textContent = t("Записване…", "Saving…");
          try {
            await saveSettings({
              watermark_enabled: document.getElementById("ah-watermark-enabled").checked,
              watermark_transparency: Number(range.value),
              watermark_size: Number(sizeRange.value)
            });
            message.textContent = t("Настройките за водния знак са записани.", "Watermark settings saved.");
          } catch (error) { message.textContent = error.message; }
          finally { save.disabled = false; }
        };

        var mediaForm = document.getElementById("ah-media-form");
        if (mediaForm && app.canWrite) mediaForm.onsubmit = async function (event) {
          event.preventDefault();
          var save = document.getElementById("ah-media-save");
          var message = document.getElementById("ah-media-status");
          save.disabled = true; message.textContent = t("Прилагане върху всички снимки…", "Applying to all photos…");
          try {
            await saveSettings({
              photo_aspect_ratio: document.getElementById("ah-photo-ratio").value,
              photo_filter: document.getElementById("ah-photo-filter").value
            });
            message.textContent = t("Форматът и филтърът са активни за всички продуктови снимки.", "Format and filter are active for all product photos.");
          } catch (error) { message.textContent = error.message; }
          finally { save.disabled = false; }
        };
      });
    }

    app.renderExtra = function (route) {
      if (route === "settings") { renderSettings(); return true; }
      return previous ? previous(route) : false;
    };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", installRoute);
  else setTimeout(installRoute, 0);
})();
