/* Auto House admin AI router.
   Server Gemini is primary so the workflow works on iPhone, Android and desktop.
   Chrome on-device AI remains a zero-cost fallback when available. */
(function () {
  "use strict";

  var D = document;
  var busy = false;

  function note(message, error) {
    var el = D.getElementById("processor-note");
    if (!el) return;
    el.textContent = message;
    el.classList.toggle("is-error", !!error);
  }

  function button(on) {
    var el = D.getElementById("process-description");
    if (!el) return;
    el.disabled = !!on;
    el.textContent = on ? "Обработване…" : "Обработи";
  }

  function vehicle() {
    var form = D.getElementById("car-form");
    if (!form) return {};
    function value(name) { return form.elements[name] ? form.elements[name].value.trim() : ""; }
    return {
      make: value("make"),
      model: value("model"),
      body_type: value("body_type"),
      colour: value("colour"),
      transmission: value("transmission"),
      fuel: value("fuel"),
      mileage: value("mileage"),
      first_registration_year: value("first_registration_year"),
      first_registration_month: value("first_registration_month"),
      horsepower: value("horsepower"),
      price: value("price")
    };
  }

  function escapeHtml(value) {
    return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function put(result, provider) {
    function set(id, value) { var el = D.getElementById(id); if (el) el.value = value || ""; }
    set("desc-bg", result.description_bg);
    set("desc-en", result.description_en);
    set("equipment-bg", (result.equipment_bg || []).join("\n"));
    set("equipment-en", (result.equipment_en || []).join("\n"));

    var review = D.getElementById("review-notes");
    var notes = result.review_notes || [];
    if (review) review.innerHTML = notes.length
      ? '<div class="review-alert"><strong>За проверка:</strong><br>' + notes.map(escapeHtml).join("<br>") + "</div>"
      : "";

    var form = D.getElementById("car-form");
    if (form) form.dispatchEvent(new Event("input", { bubbles: true }));
    note("Готово · " + (provider === "gemini" ? "AI API" : "локален fallback") + " · прегледайте и запишете", false);
  }

  function requestServer(source) {
    return fetch("/api/admin/description", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ source: source, vehicle: vehicle() })
    }).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (data) {
        if (response.status === 401) {
          location.replace("/admin/login.html");
          throw new Error("Authentication required");
        }
        if (!response.ok) {
          var err = new Error(data.error || "AI обработката не успя");
          err.code = data.code || "AI_ERROR";
          err.status = response.status;
          throw err;
        }
        return data;
      });
    });
  }

  function fallback(error) {
    if (window.AutoHouseLocalAI && typeof window.AutoHouseLocalAI.process === "function") {
      note(error && error.code === "AI_FREE_QUOTA"
        ? "Free AI лимитът е достигнат · пробвам локален fallback…"
        : "Online AI не е наличен · пробвам локален fallback…", false);
      busy = false;
      button(false);
      window.AutoHouseLocalAI.process();
      return;
    }
    throw error;
  }

  function process() {
    if (busy) return;
    var source = D.getElementById("source-text");
    if (!source || source.value.trim().length < 10) {
      note("Поставете текст за обработка.", true);
      return;
    }

    busy = true;
    button(true);
    note("AI обработка…", false);

    requestServer(source.value.trim()).then(function (data) {
      put(data.result || {}, data.provider || "gemini");
    }).catch(function (error) {
      try { fallback(error); }
      catch (finalError) {
        note(finalError && finalError.message ? finalError.message : "AI обработката не успя.", true);
      }
    }).then(function () {
      if (busy) {
        busy = false;
        button(false);
      }
    });
  }

  /* Loaded before local-ai.js/admin.js, so this owns the primary action. */
  D.addEventListener("click", function (event) {
    var target = event.target && event.target.closest ? event.target.closest("#process-description") : null;
    if (!target) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    process();
  }, true);

  window.AutoHouseAI = { process: process };
})();
