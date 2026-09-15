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
