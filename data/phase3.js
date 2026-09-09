/* Auto House admin-managed public inventory adapter.
   Runs after the existing phase1/phase2 compatibility modules and before main.js. */
(function () {
  "use strict";
  var D = document;
  var managedBySlug = {};
  var currentLang = (function () {
    try { return localStorage.getItem("ah-lang") === "en" ? "en" : "bg"; }
    catch (_) { return "bg"; }
  })();

  function loadManagedInventory() {
    var xhr = new XMLHttpRequest();
    try {
      xhr.open("GET", "/api/public/vehicles?v=20260909-admin1", false);
      xhr.setRequestHeader("Accept", "application/json");
      xhr.send(null);
      if (xhr.status < 200 || xhr.status >= 300) return;
      var data = JSON.parse(xhr.responseText || "{}");
      if (!data || data.authoritative !== true || !Array.isArray(data.vehicles)) return;
      var target = window.AH_VEHICLES || (window.AH_VEHICLES = []);
      target.splice.apply(target, [0, target.length].concat(data.vehicles));
      data.vehicles.forEach(function (v) { managedBySlug[v.id] = v; });
      window.AH_MANAGED_VEHICLES = managedBySlug;
    } catch (err) {
      /* Static inventory remains the source when the managed backend is not available. */
      console.warn("Auto House managed inventory unavailable; using static fallback.");
    }
  }

  function variantsFor(v, index) {
    var images = v && Array.isArray(v.managed_images) ? v.managed_images : [];
    var img = images[index] || {};
    return img.variants || {};
  }

  function patchPicture(picture, variants) {
    if (!picture || !variants || !variants.jpg1280) return;
    if (picture.getAttribute("data-ah-managed-image") === variants.jpg1280) return;
    picture.setAttribute("data-ah-managed-image", variants.jpg1280);
    var source = picture.querySelector('source[type="image/webp"]');
    var img = picture.querySelector("img");
    if (source && variants.webp400 && variants.webp800 && variants.webp1280) {
      source.setAttribute("srcset", variants.webp400 + " 400w, " + variants.webp800 + " 800w, " + variants.webp1280 + " 1280w");
      source.removeAttribute("data-srcset");
    }
    if (img) {
      if (variants.jpg400 && variants.jpg800 && variants.jpg1280) {
        img.setAttribute("srcset", variants.jpg400 + " 400w, " + variants.jpg800 + " 800w, " + variants.jpg1280 + " 1280w");
      }
      img.setAttribute("src", variants.jpg800 || variants.jpg1280);
      img.removeAttribute("data-src");
      img.removeAttribute("data-srcset");
    }
  }

  function patchCard(card) {
    if (!card || !card.getAttribute) return;
    var slug = card.getAttribute("data-id");
    var v = managedBySlug[slug];
    if (!v) return;
    var variants = variantsFor(v, 0);
    if (variants.jpg1280) patchPicture(card.querySelector("picture"), variants);
  }

  function currentVehicle() {
    var id = new URLSearchParams(location.search).get("id");
    return id ? managedBySlug[id] : null;
  }

  function renderDescription(v) {
    var deq = D.getElementById("deq-sec");
    if (!deq || !v) return;
    var text = currentLang === "en" ? v.description_en : v.description_bg;
    var existing = D.getElementById("managed-description");
    if (!text) { if (existing) existing.remove(); return; }
    if (!existing) {
      existing = D.createElement("section");
      existing.className = "dsec";
      existing.id = "managed-description";
      deq.parentNode.insertBefore(existing, deq);
    }
    existing.innerHTML = '<h2 class="dsec__h">' + (currentLang === "en" ? "Description" : "Описание") + '</h2>' +
      '<div class="dprose"><p></p></div>';
    existing.querySelector("p").textContent = text;
  }

  function renderEquipment(v) {
    if (!v) return;
    var bg = Array.isArray(v.equipment_bg) ? v.equipment_bg : [];
    var en = Array.isArray(v.equipment_en) ? v.equipment_en : [];
    var list = currentLang === "en" && en.length === bg.length ? en : bg;
    if (!list.length) return;
    var sec = D.getElementById("deq-sec"), ul = D.getElementById("deq"), count = D.getElementById("deq-n");
    if (!sec || !ul) return;
    ul.innerHTML = list.map(function (line) {
      var m = String(line).match(/^([0-9A-Za-zА-Яа-я]{1,6})\s*[–—-]\s*(.+)$/);
      if (m) return '<li class="deq-i"><span class="deq-c">' + esc(m[1]) + '</span><span>' + esc(m[2]) + '</span></li>';
      return '<li class="deq-i"><span class="deq-c" aria-hidden="true"></span><span>' + esc(line) + '</span></li>';
    }).join("");
    if (count) count.textContent = list.length ? "· " + list.length : "";
    sec.removeAttribute("hidden");
  }

  function patchVehicle() {
    var v = currentVehicle();
    if (!v) return;
    var gal = D.getElementById("dgal");
    if (gal) {
      var frames = gal.querySelectorAll(".dgal__f");
      for (var i = 0; i < frames.length; i++) {
        var index = Number(frames[i].getAttribute("data-i"));
        var variants = variantsFor(v, index);
        if (variants.jpg1280) {
          patchPicture(frames[i].querySelector("picture"), variants);
          frames[i].setAttribute("href", variants.jpg1280);
        }
      }
    }
    renderDescription(v);
    renderEquipment(v);
  }

  function esc(value) {
    return String(value == null ? "" : value).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function process(root) {
    if (!root) return;
    if (root.nodeType === 1 && root.classList && root.classList.contains("lc")) patchCard(root);
    if (root.querySelectorAll) {
      var cards = root.querySelectorAll(".lc");
      for (var i = 0; i < cards.length; i++) patchCard(cards[i]);
    }
    patchVehicle();
  }

  loadManagedInventory();
  if (D.body) {
    process(D.body);
    new MutationObserver(function (records) {
      for (var i = 0; i < records.length; i++) {
        for (var j = 0; j < records[i].addedNodes.length; j++) process(records[i].addedNodes[j]);
      }
      patchVehicle();
    }).observe(D.body, { childList: true, subtree: true });
  }

  window.addEventListener("ah:languagechange", function (e) {
    currentLang = e && e.detail && e.detail.lang === "en" ? "en" : "bg";
    patchVehicle();
  });
})();
