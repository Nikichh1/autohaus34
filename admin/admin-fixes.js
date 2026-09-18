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

/* Global watermark settings and the Settings route. */
(function () {
  "use strict";
  var DEFAULT_SETTINGS = { watermark_enabled: false, watermark_transparency: 75, watermark_size: 34 };
  var cached = null, cachedAt = 0, pending = null, busy = false, logoPromise = null;

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
      watermark_size: Math.max(10, Math.min(60, s))
    };
  }
  function status(text) { var el = document.getElementById("upload-status"); if (el) el.textContent = text; }

  function getSettings(force) {
    if (!force && cached && Date.now() - cachedAt < 30000) return Promise.resolve(cached);
    if (!force && pending) return pending;
    pending = fetch("/api/admin/settings", { credentials: "same-origin", headers: { Accept: "application/json" } })
      .then(function (r) { if (!r.ok) throw new Error("settings"); return r.json(); })
      .then(function (data) { cached = normalize(data.settings); cachedAt = Date.now(); return cached; })
      .catch(function () { cached = Object.assign({}, DEFAULT_SETTINGS); cachedAt = Date.now(); return cached; })
      .finally(function () { pending = null; });
    return pending;
  }

  window.addEventListener("ah:admin-settings", function (event) { cached = normalize(event.detail); cachedAt = Date.now(); });

  function logo() {
    if (logoPromise) return logoPromise;
    logoPromise = new Promise(function (resolve, reject) {
      var image = new Image();
      image.onload = function () { resolve(image); };
      image.onerror = function () { reject(new Error("logo")); };
      image.src = "/autohaus.svg";
    });
    return logoPromise;
  }

  async function watermark(file, transparency, sizePercent) {
    var url = URL.createObjectURL(file);
    var image = new Image();
    try {
      image.src = url;
      await image.decode();
      if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 140000000) throw new Error(tr("Снимката е с неподдържан размер.", "The photo dimensions are not supported."));
      var scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
      var w = Math.max(1, Math.round(image.naturalWidth * scale));
      var h = Math.max(1, Math.round(image.naturalHeight * scale));
      var canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      var ctx = canvas.getContext("2d");
      if (!ctx) throw new Error(tr("Снимката не може да бъде обработена.", "The photo cannot be processed."));
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
      ctx.fillStyle = "#f6f5f1"; ctx.fillRect(0, 0, w, h); ctx.drawImage(image, 0, 0, w, h);
      var mark = await logo();
      var ratio = (mark.naturalWidth || 482) / (mark.naturalHeight || 85);
      var size = Math.max(10, Math.min(60, Number(sizePercent) || 34)) / 100;
      var markW = Math.min(w * size, h * .22 * ratio), markH = markW / ratio;
      ctx.save(); ctx.globalAlpha = Math.max(0, Math.min(1, 1 - transparency / 100));
      ctx.drawImage(mark, (w - markW) / 2, (h - markH) / 2, markW, markH); ctx.restore();
      var blob = await new Promise(function (resolve) { canvas.toBlob(resolve, "image/png"); });
      canvas.width = 1; canvas.height = 1;
      if (!blob) throw new Error(tr("Водният знак не можа да бъде приложен.", "The watermark could not be applied."));
      return new File([blob], String(file.name || "photo").replace(/\.[^.]+$/, "") + "-watermarked.png", { type: "image/png", lastModified: file.lastModified || Date.now() });
    } finally { URL.revokeObjectURL(url); }
  }

  document.addEventListener("change", function (event) {
    var input = event.target;
    if (!input || (input.id !== "image-input" && input.id !== "camera-input")) return;
    if (input.dataset.ahPrepared === "1") { delete input.dataset.ahPrepared; return; }
    if (!input.files || !input.files.length) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (busy) return;
    busy = true;
    var originals = Array.from(input.files);
    (async function () {
      try {
        var cfg = await getSettings(true);
        var files = originals;
        if (cfg.watermark_enabled) {
          files = [];
          for (var i = 0; i < originals.length; i++) {
            status(tr("Воден знак: ", "Watermark: ") + (i + 1) + " / " + originals.length);
            files.push(await watermark(originals[i], cfg.watermark_transparency, cfg.watermark_size));
          }
        }
        var transfer = new DataTransfer();
        files.forEach(function (file) { transfer.items.add(file); });
        input.files = transfer.files;
        input.dataset.ahPrepared = "1";
        input.dispatchEvent(new Event("change", { bubbles: true }));
      } catch (error) {
        console.error(error);
        status(tr("Обработката на снимките не успя. Опитайте отново.", "Photo processing failed. Try again."));
      } finally { busy = false; }
    })();
  }, true);

  function installRoute() {
    var app = window.AH_ADMIN, view = document.getElementById("admin-view");
    if (!app || !view || app.__watermarkSettingsRoute) return;
    app.__watermarkSettingsRoute = true;
    var previous = app.renderExtra;

    function renderSettings() {
      var t = app.t;
      view.innerHTML = '<div class="view-head"><div class="view-title"><p>AutoHaus</p><h1>' + esc(t("Настройки", "Settings")) + '</h1></div></div>' +
        '<section class="panel"><div class="panel-head"><h2>' + esc(t("Воден знак върху снимките", "Photo watermark")) + '</h2></div><div id="ah-settings-body" style="padding:20px;max-width:760px"><p class="muted">' + esc(t("Зареждане…", "Loading…")) + '</p></div></section>';
      var body = document.getElementById("ah-settings-body");
      getSettings(true).then(function (cfg) {
        if (!body || !body.isConnected) return;
        var disabled = app.canWrite ? "" : " disabled";
        body.innerHTML = '<form id="ah-settings-form" style="display:grid;gap:22px">' +
          '<label class="check" style="align-items:flex-start"><input id="ah-watermark-enabled" type="checkbox"' + (cfg.watermark_enabled ? " checked" : "") + disabled + '><span><strong>' + esc(t("Добавяй AutoHaus воден знак автоматично", "Add the AutoHaus watermark automatically")) + '</strong><br><small class="muted">' + esc(t("Прилага се в центъра на всички продуктови снимки. Новите качвания използват същите настройки.", "Applied to the centre of all product images. New uploads use the same settings.")) + '</small></span></label>' +
          '<label class="field" style="max-width:520px"><span>' + esc(t("Прозрачност", "Transparency")) + ' — <b id="ah-watermark-value">' + cfg.watermark_transparency + '%</b></span><input id="ah-watermark-transparency" type="range" min="0" max="100" step="1" value="' + cfg.watermark_transparency + '"' + disabled + '></label>' +
          '<label class="field" style="max-width:520px"><span>' + esc(t("Размер", "Size")) + ' — <b id="ah-watermark-size-value">' + cfg.watermark_size + '%</b></span><input id="ah-watermark-size" type="range" min="10" max="60" step="1" value="' + cfg.watermark_size + '"' + disabled + '></label>' +
          '<p class="muted" style="margin:0">' + esc(t("75% прозрачност и 34% размер са стойностите по подразбиране. Настройките са глобални и важат за всички автомобили.", "75% transparency and 34% size are the defaults. These global settings apply to every vehicle.")) + '</p>' +
          (app.canWrite ? '<div><button class="primary" id="ah-settings-save" type="submit">' + esc(t("Запази настройките", "Save settings")) + '</button></div>' : '') + '<div id="ah-settings-status" class="muted" role="status"></div></form>';
        var range = document.getElementById("ah-watermark-transparency");
        var value = document.getElementById("ah-watermark-value");
        var sizeRange = document.getElementById("ah-watermark-size");
        var sizeValue = document.getElementById("ah-watermark-size-value");
        if (range) range.oninput = function () { value.textContent = range.value + "%"; };
        if (sizeRange) sizeRange.oninput = function () { sizeValue.textContent = sizeRange.value + "%"; };
        var form = document.getElementById("ah-settings-form");
        if (form && app.canWrite) form.onsubmit = async function (event) {
          event.preventDefault();
          var save = document.getElementById("ah-settings-save"), message = document.getElementById("ah-settings-status");
          save.disabled = true; message.textContent = t("Записване…", "Saving…");
          try {
            var response = await fetch("/api/admin/settings", { method: "PATCH", credentials: "same-origin", headers: { Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify({ watermark_enabled: document.getElementById("ah-watermark-enabled").checked, watermark_transparency: Number(range.value), watermark_size: Number(sizeRange.value) }) });
            var data = await response.json().catch(function () { return {}; });
            if (!response.ok) throw new Error(data.error || t("Настройките не бяха записани.", "Settings could not be saved."));
            cached = normalize(data.settings); cachedAt = Date.now();
            window.dispatchEvent(new CustomEvent("ah:admin-settings", { detail: cached }));
            message.textContent = t("Настройките са записани.", "Settings saved.");
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