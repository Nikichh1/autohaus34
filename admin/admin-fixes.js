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
    photo_filter: "none",
    photo_filter_strength: 35,
    desktop_gallery_scale: 84,
    scroll_header_style: "compact",
    landing_standard_header: true,
    landing_standard_header_sticky: false,
    landing_original_after_scroll: true,
    product_standard_header: true,
    product_standard_header_sticky: true,
    product_original_header: false
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
    var strength = Math.round(Number(value.photo_filter_strength));
    if (!Number.isFinite(strength)) strength = 35;
    var galleryScale = Math.round(Number(value.desktop_gallery_scale));
    if (!Number.isFinite(galleryScale)) galleryScale = 84;
    return {
      watermark_enabled: value.watermark_enabled === true,
      watermark_transparency: Math.max(0, Math.min(100, n)),
      watermark_size: Math.max(10, Math.min(60, s)),
      photo_aspect_ratio: value.photo_aspect_ratio === "16:10" ? "16:10" : "16:9",
      photo_filter: ["none", "balanced", "showroom"].indexOf(value.photo_filter) >= 0 ? value.photo_filter : "none",
      photo_filter_strength: Math.max(0, Math.min(100, strength)),
      desktop_gallery_scale: Math.max(70, Math.min(100, galleryScale)),
      scroll_header_style: value.scroll_header_style === "autohaus_original" ? "autohaus_original" : "compact",
      landing_standard_header: value.landing_standard_header !== false,
      landing_standard_header_sticky: value.landing_standard_header_sticky === true,
      landing_original_after_scroll: value.landing_original_after_scroll !== false,
      product_standard_header: value.product_standard_header !== false,
      product_standard_header_sticky: value.product_standard_header_sticky !== false,
      product_original_header: value.product_original_header === true
    };
  }

  function photoPreset(name, strength) {
    var k = Math.sqrt(Math.max(0, Math.min(100, Number(strength) || 0)) / 100);
    var presets = {
      none: { brightness: 1, contrast: 1, saturate: 1, vignette: 0 },
      balanced: { brightness: 1 - .09 * k, contrast: 1 + .12 * k, saturate: 1 + .18 * k, vignette: .28 * k },
      showroom: { brightness: 1 - .14 * k, contrast: 1 + .18 * k, saturate: 1 + .26 * k, vignette: .38 * k }
    };
    return presets[name] || presets.none;
  }
  function applyAdminPhotoPresentation(cfg) {
    cfg = normalize(cfg);
    var p = photoPreset(cfg.photo_filter, cfg.photo_filter_strength);
    document.documentElement.style.setProperty("--ah-admin-photo-ratio", cfg.photo_aspect_ratio === "16:10" ? "16 / 10" : "16 / 9");
    document.documentElement.style.setProperty("--ah-admin-photo-brightness", String(p.brightness));
    document.documentElement.style.setProperty("--ah-admin-photo-contrast", String(p.contrast));
    document.documentElement.style.setProperty("--ah-admin-photo-saturate", String(p.saturate));
    document.documentElement.style.setProperty("--ah-admin-photo-vignette-opacity", String(p.vignette));
  }

  function getSettings(force) {
    if (!force && cached && Date.now() - cachedAt < 30000) return Promise.resolve(cached);
    if (!force && pending) return pending;
    pending = fetch("/api/admin/settings", { credentials: "same-origin", headers: { Accept: "application/json" }, cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error("settings"); return r.json(); })
      .then(function (data) { cached = normalize(data.settings); cachedAt = Date.now(); applyAdminPhotoPresentation(cached); return cached; })
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
    cached = normalize(data.settings); cachedAt = Date.now(); applyAdminPhotoPresentation(cached);
    /* Keep the public-page first-paint cache in sync immediately after an
       admin change. No network or reload is needed for the next vehicle page. */
    try {
      localStorage.setItem("autohaus-photo-presentation-v1", JSON.stringify({
        v: 1,
        at: Date.now(),
        settings: cached
      }));
    } catch (_) {}
    window.dispatchEvent(new CustomEvent("ah:admin-settings", { detail: cached }));
    return cached;
  }

  window.AH_ADMIN_MEDIA_SETTINGS = function (force) { return getSettings(!!force); };
  window.addEventListener("ah:admin-settings", function (event) { cached = normalize(event.detail); cachedAt = Date.now(); applyAdminPhotoPresentation(cached); });

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
        '<section class="panel" style="margin-top:20px"><div class="panel-head"><h2>' + esc(t("Формат и обработка на снимките", "Photo format and processing")) + '</h2></div><div id="ah-media-settings" style="padding:20px;max-width:760px"><p class="muted">' + esc(t("Зареждане…", "Loading…")) + '</p></div></section>' +
        '<section class="panel" style="margin-top:20px"><div class="panel-head"><h2>' + esc(t("Хедър на сайта", "Site header")) + '</h2></div><div id="ah-header-settings" style="padding:20px;max-width:920px"><p class="muted">' + esc(t("Зареждане…", "Loading…")) + '</p></div></section>';

      Promise.resolve(getSettings(true)).then(function (cfg) {
        var watermarkBody = document.getElementById("ah-watermark-settings");
        var mediaBody = document.getElementById("ah-media-settings");
        var headerBody = document.getElementById("ah-header-settings");
        if (!watermarkBody || !mediaBody || !headerBody || !watermarkBody.isConnected || !mediaBody.isConnected || !headerBody.isConnected) return;
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
          option("16:9", cfg.photo_aspect_ratio, "16:9") +
          option("16:10", cfg.photo_aspect_ratio, "16:10") +
          '</select></label>' +
          '<label class="field" style="max-width:520px"><span><strong>' + esc(t("Филтър за снимките", "Photo filter")) + '</strong></span>' +
          '<select id="ah-photo-filter"' + disabled + '>' +
          option("none", cfg.photo_filter, t("Без", "None")) +
          option("balanced", cfg.photo_filter, "Balanced") +
          option("showroom", cfg.photo_filter, "Showroom") +
          '</select></label>' +
          '<label class="field" style="max-width:520px"><span>' + esc(t("Сила на филтъра", "Filter strength")) + ' — <b id="ah-photo-filter-strength-value">' + cfg.photo_filter_strength + '%</b></span>' +
          '<input id="ah-photo-filter-strength" type="range" min="0" max="100" step="1" value="' + cfg.photo_filter_strength + '"' + disabled + '></label>' +
          '<label class="field" style="max-width:520px"><span>' + esc(t("Размер на галерията на компютър", "Desktop gallery size")) + ' — <b id="ah-desktop-gallery-scale-value">' + cfg.desktop_gallery_scale + '%</b></span>' +
          '<input id="ah-desktop-gallery-scale" type="range" min="70" max="100" step="1" value="' + cfg.desktop_gallery_scale + '"' + disabled + '></label>' +
          (app.canWrite ? '<div><button class="primary" id="ah-media-save" type="submit">' + esc(t("Запази обработката на снимките", "Save photo processing")) + '</button></div>' : '') +
          '<div id="ah-media-status" class="muted" role="status"></div></form>';

        headerBody.innerHTML =
          '<form id="ah-header-form" class="ah-header-settings-form">' +
          '<p class="muted ah-header-settings-intro">' + esc(t("Стилът и поведението могат да се настройват отделно за началната и продуктовата страница.", "Header style and behavior can be configured separately for the landing and vehicle pages.")) + '</p>' +
          '<div class="ah-header-style-grid" role="radiogroup" aria-label="' + esc(t("Стил на хедъра", "Header style")) + '">' +
            '<label class="ah-header-style-card' + (cfg.scroll_header_style === "compact" ? " is-selected" : "") + '">' +
              '<input type="radio" name="scroll_header_style" value="compact"' + (cfg.scroll_header_style === "compact" ? " checked" : "") + disabled + '>' +
              '<span class="ah-header-style-preview ah-header-style-preview--compact"><i class="ah-mini-compact"><b></b><em></em></i></span>' +
              '<span class="ah-header-style-copy"><strong>' + esc(t("Компактен", "Compact")) + '</strong><small>' + esc(t("Сегашният минимален геометричен хедър.", "The current minimal geometric header.")) + '</small></span>' +
            '</label>' +
            '<label class="ah-header-style-card' + (cfg.scroll_header_style === "autohaus_original" ? " is-selected" : "") + '">' +
              '<input type="radio" name="scroll_header_style" value="autohaus_original"' + (cfg.scroll_header_style === "autohaus_original" ? " checked" : "") + disabled + '>' +
              '<span class="ah-header-style-preview ah-header-style-preview--original"><i class="ah-mini-original"><img src="/autohaus.svg" alt=""></i></span>' +
              '<span class="ah-header-style-copy"><strong>' + esc(t("AutoHaus Original", "AutoHaus Original")) + '</strong><small>' + esc(t("Клинът по оригиналния autohaus.bg, леко намален.", "The original autohaus.bg wedge, slightly reduced.")) + '</small></span>' +
            '</label>' +
          '</div>' +
          '<div class="ah-header-behavior-grid">' +
            '<fieldset class="ah-header-behavior"><legend>' + esc(t("Начална страница", "Landing page")) + '</legend>' +
              '<label class="check"><input id="ah-landing-standard" type="checkbox"' + (cfg.landing_standard_header ? " checked" : "") + disabled + '><span><strong>' + esc(t("Показвай стандартния хедър", "Show standard header")) + '</strong><small class="muted">' + esc(t("Хедърът, който е върху hero секцията.", "The header shown over the hero section.")) + '</small></span></label>' +
              '<label class="check"><input id="ah-landing-sticky" type="checkbox"' + (cfg.landing_standard_header_sticky ? " checked" : "") + disabled + '><span><strong>' + esc(t("Остави стандартния хедър sticky", "Keep standard header sticky")) + '</strong><small class="muted">' + esc(t("Ако е включено, той остава видим при скрол.", "When enabled, it remains visible while scrolling.")) + '</small></span></label>' +
              '<label class="check"><input id="ah-landing-original-scroll" type="checkbox"' + (cfg.landing_original_after_scroll ? " checked" : "") + disabled + '><span><strong>' + esc(t("Показвай AutoHaus Original след скрол", "Show AutoHaus Original after scroll")) + '</strong><small class="muted">' + esc(t("Работи при избран стил AutoHaus Original. При sticky стандартен хедър клинът не се наслагва върху него.", "Used with AutoHaus Original. A sticky standard header takes priority so the two never overlap.")) + '</small></span></label>' +
            '</fieldset>' +
            '<fieldset class="ah-header-behavior"><legend>' + esc(t("Продуктова страница", "Vehicle page")) + '</legend>' +
              '<label class="check"><input id="ah-product-standard" type="checkbox"' + (cfg.product_standard_header ? " checked" : "") + disabled + '><span><strong>' + esc(t("Показвай стандартния продуктов хедър", "Show standard vehicle header")) + '</strong></span></label>' +
              '<label class="check"><input id="ah-product-sticky" type="checkbox"' + (cfg.product_standard_header_sticky ? " checked" : "") + disabled + '><span><strong>' + esc(t("Остави продуктовия хедър sticky", "Keep vehicle header sticky")) + '</strong></span></label>' +
              '<label class="check"><input id="ah-product-original" type="checkbox"' + (cfg.product_original_header ? " checked" : "") + disabled + '><span><strong>' + esc(t("Използвай AutoHaus Original на продуктовата страница", "Use AutoHaus Original on vehicle pages")) + '</strong><small class="muted">' + esc(t("Когато е включено, клинът замества стандартния продуктов хедър.", "When enabled, the wedge replaces the standard vehicle header.")) + '</small></span></label>' +
            '</fieldset>' +
          '</div>' +
          (app.canWrite ? '<div><button class="primary" id="ah-header-save" type="submit">' + esc(t("Запази хедъра", "Save header")) + '</button></div>' : '') +
          '<div id="ah-header-status" class="muted" role="status"></div></form>';

        var range = document.getElementById("ah-watermark-transparency");
        var value = document.getElementById("ah-watermark-value");
        var sizeRange = document.getElementById("ah-watermark-size");
        var sizeValue = document.getElementById("ah-watermark-size-value");
        if (range) range.oninput = function () { value.textContent = range.value + "%"; };
        if (sizeRange) sizeRange.oninput = function () { sizeValue.textContent = sizeRange.value + "%"; };
        var filterStrength = document.getElementById("ah-photo-filter-strength");
        var filterStrengthValue = document.getElementById("ah-photo-filter-strength-value");
        if (filterStrength) filterStrength.oninput = function () { filterStrengthValue.textContent = filterStrength.value + "%"; };
        var desktopGalleryScale = document.getElementById("ah-desktop-gallery-scale");
        var desktopGalleryScaleValue = document.getElementById("ah-desktop-gallery-scale-value");
        if (desktopGalleryScale) desktopGalleryScale.oninput = function () { desktopGalleryScaleValue.textContent = desktopGalleryScale.value + "%"; };

        document.querySelectorAll('.ah-header-style-card input[name="scroll_header_style"]').forEach(function (radio) {
          radio.onchange = function () {
            document.querySelectorAll(".ah-header-style-card").forEach(function (card) {
              var input = card.querySelector('input[name="scroll_header_style"]');
              card.classList.toggle("is-selected", !!input && input.checked);
            });
          };
        });

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
              photo_filter: document.getElementById("ah-photo-filter").value,
              photo_filter_strength: Number(document.getElementById("ah-photo-filter-strength").value),
              desktop_gallery_scale: Number(document.getElementById("ah-desktop-gallery-scale").value)
            });
            message.textContent = t("Форматът и филтърът са активни за всички продуктови снимки.", "Format and filter are active for all product photos.");
          } catch (error) { message.textContent = error.message; }
          finally { save.disabled = false; }
        };

        var headerForm = document.getElementById("ah-header-form");
        if (headerForm && app.canWrite) headerForm.onsubmit = async function (event) {
          event.preventDefault();
          var save = document.getElementById("ah-header-save");
          var message = document.getElementById("ah-header-status");
          var selected = headerForm.querySelector('input[name="scroll_header_style"]:checked');
          save.disabled = true; message.textContent = t("Записване…", "Saving…");
          try {
            await saveSettings({
              scroll_header_style: selected ? selected.value : "compact",
              landing_standard_header: document.getElementById("ah-landing-standard").checked,
              landing_standard_header_sticky: document.getElementById("ah-landing-sticky").checked,
              landing_original_after_scroll: document.getElementById("ah-landing-original-scroll").checked,
              product_standard_header: document.getElementById("ah-product-standard").checked,
              product_standard_header_sticky: document.getElementById("ah-product-sticky").checked,
              product_original_header: document.getElementById("ah-product-original").checked
            });
            message.textContent = t("Настройките за хедъра са записани.", "Header settings saved.");
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
