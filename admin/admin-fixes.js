/* Scoped AutoHaus admin fixes: defaults, VAT note control, DELETE headers and menu cleanup. */
(function () {
  "use strict";

  var DEFAULT_NOTES = [
    "Пълна сервизна история!",
    "Възможен бартер!",
    "Възможен лизинг!"
  ];
  var VAT_NOTE = "Цена без начислен 20% ДДС";
  var originalFetch = window.fetch.bind(window);

  function vehicleApi(input) {
    try {
      var raw = typeof input === "string" ? input : input && input.url;
      var url = new URL(raw, location.href);
      return url.origin === location.origin && url.pathname === "/api/admin/vehicles";
    } catch (_) { return false; }
  }

  function currentForm() { return document.getElementById("car-form"); }

  window.fetch = function (input, init) {
    init = init || {};
    if (!vehicleApi(input)) return originalFetch(input, init);

    var method = String(init.method || "GET").toUpperCase();
    var next = Object.assign({}, init);
    var headers = new Headers(init.headers || {});

    // The admin backend requires JSON content type on every write request.
    // Core deleteCar sends no body, so add the missing header here.
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
        } catch (_) { /* Leave the original request untouched if it is not JSON. */ }
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

  function enhanceEditor() {
    var form = currentForm();
    if (!form || form.dataset.ahScopedFixes === "1") return;

    var notes = form.elements && form.elements.notes;
    var price = form.elements && form.elements.price;
    if (!notes || !price) return;

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
    if (!priceLabel || !priceLabel.parentNode) return;

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
    text.textContent = window.AH_ADMIN && window.AH_ADMIN.t
      ? window.AH_ADMIN.t(VAT_NOTE, "Price excluding 20% VAT")
      : VAT_NOTE;
    check.appendChild(input);
    check.appendChild(text);
    wrapper.appendChild(check);

    // The VAT control makes the left grid cell taller. Prevent its paired field
    // (normally mileage) from stretching vertically to that taller row.
    var pairedField = wrapper.nextElementSibling;
    if (pairedField && pairedField.classList.contains("field")) pairedField.style.alignSelf = "start";
  }

  function refreshScopedFixes() {
    removeSecurityEntry();
    enhanceEditor();
  }

  var observer = new MutationObserver(refreshScopedFixes);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("hashchange", removeSecurityEntry);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", refreshScopedFixes);
  else refreshScopedFixes();
})();

/* Optional photo watermark. It runs before the existing upload pipeline, so
   the normal 1600px master + responsive JPEG/WebP variants remain the only
   stored files. The original AutoHaus SVG is composited in the centre at
   25% opacity (75% transparent) only when the editor checkbox is enabled. */
(function () {
  "use strict";

  var watermarkEnabled = false;
  var watermarkBusy = false;
  var logoPromise = null;

  function tr(bg, en) {
    return document.documentElement.lang === "en" ? en : bg;
  }

  function setStatus(message) {
    var status = document.getElementById("upload-status");
    if (status) status.textContent = message;
  }

  function ensureWatermarkControl() {
    var dropzone = document.getElementById("dropzone");
    if (!dropzone || dropzone.querySelector("#image-watermark-option")) return;
    var actions = dropzone.querySelector(".upload-actions");
    if (!actions) return;

    var label = document.createElement("label");
    label.className = "check ah-image-watermark";
    label.id = "image-watermark-option";
    label.style.display = "flex";
    label.style.alignItems = "flex-start";
    label.style.gap = "9px";
    label.style.marginTop = "12px";
    label.style.maxWidth = "560px";

    var input = document.createElement("input");
    input.type = "checkbox";
    input.id = "image-watermark";
    input.checked = watermarkEnabled;
    input.disabled = watermarkBusy;

    var copy = document.createElement("span");
    copy.textContent = tr(
      "Добави воден знак AutoHaus в центъра (75% прозрачен)",
      "Add centered AutoHaus watermark (75% transparent)"
    );

    label.appendChild(input);
    label.appendChild(copy);
    actions.insertAdjacentElement("afterend", label);
  }

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

  async function watermarkFile(file) {
    var url = URL.createObjectURL(file);
    var image = new Image();
    try {
      image.src = url;
      await image.decode();
      if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 140000000) {
        throw new Error(tr("Снимката е с неподдържан размер.", "The photo dimensions are not supported."));
      }

      // Match the existing admin master size before watermarking. This avoids
      // allocating a second full-resolution 4000px+ canvas and never upscales.
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
      ctx.globalAlpha = 0.25;
      ctx.drawImage(logo, (width - logoWidth) / 2, (height - logoHeight) / 2, logoWidth, logoHeight);
      ctx.restore();

      var blob = await new Promise(function (resolve) { canvas.toBlob(resolve, "image/png"); });
      canvas.width = 1;
      canvas.height = 1;
      if (!blob) throw new Error(tr("Водният знак не можа да бъде приложен.", "The watermark could not be applied."));
      var stem = String(file.name || "photo").replace(/\.[^.]+$/, "");
      return new File([blob], stem + "-watermarked.png", { type: "image/png", lastModified: file.lastModified || Date.now() });
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  document.addEventListener("change", async function (event) {
    var target = event.target;
    if (target && target.id === "image-watermark") {
      watermarkEnabled = !!target.checked;
      return;
    }
    if (!target || (target.id !== "image-input" && target.id !== "camera-input")) return;

    // The synthetic change below is the hand-off to admin.js after all files
    // have been watermarked. Do not intercept that second event.
    if (target.dataset.ahWatermarked === "1") {
      delete target.dataset.ahWatermarked;
      return;
    }
    if (!watermarkEnabled || !target.files || !target.files.length) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    if (watermarkBusy) return;
    watermarkBusy = true;
    var checkbox = document.getElementById("image-watermark");
    if (checkbox) checkbox.disabled = true;

    try {
      var sourceFiles = Array.from(target.files);
      var prepared = [];
      for (var i = 0; i < sourceFiles.length; i++) {
        setStatus(tr("Воден знак: ", "Watermark: ") + (i + 1) + " / " + sourceFiles.length);
        prepared.push(await watermarkFile(sourceFiles[i]));
      }
      var transfer = new DataTransfer();
      prepared.forEach(function (file) { transfer.items.add(file); });
      target.files = transfer.files;
      target.dataset.ahWatermarked = "1";
      target.dispatchEvent(new Event("change", { bubbles: true }));
    } catch (error) {
      console.error(error);
      setStatus(tr(
        "Снимките не са качени, защото водният знак не можа да бъде приложен. Опитайте отново или изключете отметката.",
        "The photos were not uploaded because the watermark could not be applied. Try again or disable the checkbox."
      ));
    } finally {
      watermarkBusy = false;
      checkbox = document.getElementById("image-watermark");
      if (checkbox) checkbox.disabled = false;
    }
  }, true);

  var observer = new MutationObserver(ensureWatermarkControl);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ensureWatermarkControl);
  else ensureWatermarkControl();
})();
