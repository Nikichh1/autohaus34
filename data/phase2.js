/* Auto House — vehicle, inquiry, contact and footer refresh. */
(function () {
  "use strict";

  var D = document;
  var currentLang = (function () {
    try { return localStorage.getItem("ah-lang") === "en" ? "en" : "bg"; }
    catch (_) { return "bg"; }
  })();

  window.AH_CONFIG = Object.assign({}, window.AH_CONFIG || {}, {
    endpoint: "/api/inquiry",
    email: "autohousesell@gmail.com",
    expert: "Иван Манев"
  });

  function text(el, bg, en) {
    if (!el) return el;
    el.setAttribute("data-ah-bg", bg);
    el.setAttribute("data-ah-en", en);
    el.textContent = currentLang === "en" ? en : bg;
    return el;
  }

  function applyBi(root) {
    if (!root || !root.querySelectorAll) return;
    var items = root.querySelectorAll("[data-ah-bg][data-ah-en]");
    for (var i = 0; i < items.length; i++) {
      var el = items[i];
      el.textContent = currentLang === "en" ? el.getAttribute("data-ah-en") : el.getAttribute("data-ah-bg");
    }
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function prettyPhone(p) {
    var m = String(p || "").match(/^\+359(\d{3})(\d{3})(\d{3})$/);
    return m ? "+359 " + m[1] + " " + m[2] + " " + m[3] : p;
  }

  function injectStyles() {
    if (D.getElementById("ah-phase2-styles")) return;
    var s = D.createElement("style");
    s.id = "ah-phase2-styles";
    s.textContent = [
      ".nav .tel{display:none!important}",
      ".ft,.ft p,.ft-meta,.ft-meta p,.ft-meta a,.ft-social a{color:rgba(255,255,255,.72)!important}",
      ".ft-social a{transition:color .16s ease,opacity .16s ease;opacity:.9}",
      ".ft-social a:hover,.ft-social a:focus-visible,.ft-meta a:hover,.ft-meta a:focus-visible{color:#fff!important;opacity:1}",
      ".ft-social svg{fill:currentColor!important;color:inherit!important}",
      ".ctc__mapbox{margin:0 0 28px;border:1px solid rgba(255,255,255,.16);background:#e8e5df;overflow:hidden}",
      ".ctc__mapframe{display:block;width:100%;height:clamp(220px,34vh,320px);border:0;background:#e8e5df}",
      ".ctc__mapmeta{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 16px;background:#111;color:#fff}",
      ".ctc__mapmeta strong{font-size:14px;font-weight:600;letter-spacing:.02em}",
      ".ctc__maplink{color:#fff!important;text-decoration:none;font-size:12px;font-weight:600;letter-spacing:.04em}",
      ".ctc__maplink:hover,.ctc__maplink:focus-visible{text-decoration:underline;text-underline-offset:4px}",
      ".dinq{margin-top:24px}",
      ".dinq__grid{display:grid;grid-template-columns:1fr;gap:12px;margin-bottom:12px}",
      ".dinq__field{display:grid;gap:7px}",
      ".dinq__label{font-size:12px;line-height:16px;color:var(--ink-3)}",
      ".dinq__input{width:100%;min-height:46px;border:1px solid var(--line-2);background:#fff;color:var(--ink);padding:11px 12px;font:inherit}",
      ".dinq__input:focus,.dask:focus{outline:1px solid var(--ink);outline-offset:1px}",
      ".dinq__status{min-height:20px;margin-top:12px;font-size:12px;line-height:18px;color:var(--ink-3)}",
      ".dinq__status.is-ok{color:#356340}",
      ".dinq__status.is-error{color:#8b2f2f}",
      ".dinq__trap{position:absolute!important;left:-10000px!important;width:1px!important;height:1px!important;overflow:hidden!important}",
      ".dseller--clean{grid-template-columns:minmax(0,1fr) auto!important}",
      ".dseller--clean .dseller__acts{align-self:center}",
      ".dseller__mail{word-break:break-word}",
      "@media(min-width:700px){.dinq__grid{grid-template-columns:repeat(3,minmax(0,1fr))}}",
      "@media(max-width:699px){.ctc__mapmeta{align-items:flex-start;flex-direction:column;gap:8px}.dseller--clean{grid-template-columns:1fr!important}.dseller--clean .dseller__acts{align-self:start}}"
    ].join("\n");
    D.head.appendChild(s);
  }

  function patchHead() {
    if (/AutoHaus Пловдив|Auto House Пловдив/.test(D.title)) {
      D.title = D.title.replace(/AutoHaus Пловдив|Auto House Пловдив/g, "Auto House");
    }
    var md = D.querySelector('meta[name="description"]');
    if (md) {
      var v = md.getAttribute("content") || "";
      if (/AutoHaus Пловдив|Auto House Пловдив/.test(v)) {
        md.setAttribute("content", v.replace(/AutoHaus Пловдив|Auto House Пловдив/g, "Auto House"));
      }
    }
  }

  function removeHeaderPhone() {
    var phones = D.querySelectorAll("header.nav .tel, header a[href='tel:+359884777147']");
    for (var i = 0; i < phones.length; i++) {
      if (phones[i].closest("header")) phones[i].remove();
    }
  }

  var MAP_SRC = "https://www.openstreetmap.org/export/embed.html?bbox=24.7587165%2C42.1127165%2C24.7887165%2C42.1287165&layer=mapnik&marker=42.1207165%2C24.7737244";
  var MAP_LINK = "https://www.google.com/maps/search/?api=1&query=42.1207165%2C24.7737244";

  function loadContactMap() {
    var frames = D.querySelectorAll(".ctc__mapframe[data-map-src]");
    for (var i = 0; i < frames.length; i++) {
      if (!frames[i].getAttribute("src")) frames[i].setAttribute("src", frames[i].getAttribute("data-map-src"));
    }
  }

  function patchContactPanel(panel) {
    panel = panel || D.getElementById("ctc");
    if (!panel || panel.getAttribute("data-ah-contact2") === "1") return;
    panel.setAttribute("data-ah-contact2", "1");

    var scroll = panel.querySelector(".ctc__scroll");
    if (!scroll) return;

    var eyebrow = scroll.querySelector(".ctc__eyebrow");
    if (eyebrow) eyebrow.remove();
    var visuals = scroll.querySelectorAll(".ctc__visual,.ctc__photo,.ctc__media");
    for (var i = 0; i < visuals.length; i++) visuals[i].remove();

    var oldGo = scroll.querySelector(".ctc__where .ctc__go");
    if (oldGo) oldGo.remove();

    if (!scroll.querySelector(".ctc__mapbox")) {
      var box = D.createElement("div");
      box.className = "ctc__mapbox";
      box.innerHTML =
        '<iframe class="ctc__mapframe" title="Auto House map" loading="lazy" referrerpolicy="no-referrer-when-downgrade" data-map-src="' + MAP_SRC + '"></iframe>' +
        '<div class="ctc__mapmeta"><strong>Auto House</strong>' +
        '<a class="ctc__maplink" href="' + MAP_LINK + '" target="_blank" rel="noopener" data-ah-bg="Отвори в Google Maps" data-ah-en="Open in Google Maps">Отвори в Google Maps</a></div>';
      scroll.insertBefore(box, scroll.firstChild);
    }

    var office = scroll.querySelectorAll(".ctc__k");
    for (var j = 0; j < office.length; j++) {
      var t = office[j].textContent.replace(/\s+/g, " ").trim();
      if (t === "Офис" || t === "Office" || t === "Администрация" || t === "Administration") {
        text(office[j], "Администрация", "Administration");
      }
    }
    applyBi(scroll);
  }

  function recordForPage() {
    var id = new URLSearchParams(location.search).get("id");
    var all = window.AH_VEHICLES || [];
    for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
    return null;
  }

  function setStatus(el, kind, bg, en) {
    if (!el) return;
    el.classList.remove("is-ok", "is-error");
    if (kind) el.classList.add(kind === "ok" ? "is-ok" : "is-error");
    el.textContent = currentLang === "en" ? en : bg;
  }

  function bindVehicleInquiry(form, v) {
    if (!form || form.getAttribute("data-bound") === "1") return;
    form.setAttribute("data-bound", "1");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var status = form.querySelector(".dinq__status");
      var btn = form.querySelector("button[type='submit']");
      var name = form.elements.name.value.trim();
      var phone = form.elements.phone.value.trim();
      var email = form.elements.email.value.trim();
      var message = form.elements.message.value.trim();
      var website = form.elements.website.value.trim();

      if (!name || !message || (!phone && !email)) {
        setStatus(status, "error",
          "Попълнете име, въпрос и поне телефон или имейл.",
          "Enter your name, enquiry and at least a phone number or email.");
        return;
      }
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setStatus(status, "error", "Проверете имейл адреса.", "Please check the email address.");
        return;
      }

      btn.disabled = true;
      btn.textContent = currentLang === "en" ? "Sending…" : "Изпращане…";
      setStatus(status, "", "", "");

      fetch((window.AH_CONFIG && window.AH_CONFIG.endpoint) || "/api/inquiry", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({
          kind: "vehicle",
          language: currentLang,
          website: website,
          page: location.href,
          vehicle: v ? { id: v.id, ref: v.ref, name: v.full, price: v.price } : null,
          contact: { name: name, phone: phone, email: email },
          message: message
        })
      }).then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json().catch(function () { return { ok: true }; });
      }).then(function () {
        form.reset();
        setStatus(status, "ok",
          "Запитването е изпратено успешно.",
          "Your enquiry was sent successfully.");
      }).catch(function () {
        setStatus(status, "error",
          "Не успяхме да изпратим запитването. Опитайте отново или се обадете на Иван Манев.",
          "We couldn't send your enquiry. Please try again or call Ivan Manev.");
      }).then(function () {
        btn.disabled = false;
        text(btn, "Изпрати", "Send");
      });
    });
  }

  function patchVehiclePage() {
    var root = D.getElementById("vd");
    if (!root || !root.children.length || root.getAttribute("data-ah-vehicle2") === "1") return;
    var v = recordForPage();
    if (!v) return;
    root.setAttribute("data-ah-vehicle2", "1");

    var galleryActions = root.querySelector(".dgal-bar__l");
    if (galleryActions) galleryActions.remove();
    var place = root.querySelector(".dtitle__place");
    if (place) place.remove();
    var related = root.querySelector(".dmore-sec");
    if (related) related.remove();

    var oldForm = root.querySelector("form[action='concierge.html']");
    var section = oldForm ? oldForm.closest(".dsec") : null;
    if (section) {
      var phone = (window.AH_CONFIG && window.AH_CONFIG.expertPhone) || "+359884777045";
      section.id = "vehicle-inquiry";
      section.innerHTML =
        '<h2 class="dsec__h" data-ah-bg="Запитване" data-ah-en="Enquiry">Запитване</h2>' +
        '<div class="dseller dseller--clean">' +
          '<div><p class="dseller__n">Иван Манев</p></div>' +
          '<div class="dseller__acts">' +
            '<a href="tel:' + esc(phone) + '">' + esc(prettyPhone(phone)) + '</a>' +
            '<a class="dseller__mail" href="mailto:autohousesell@gmail.com">autohousesell@gmail.com</a>' +
          '</div>' +
        '</div>' +
        '<form class="dinq" id="vehicle-inquiry-form" novalidate>' +
          '<div class="dinq__grid">' +
            '<label class="dinq__field"><span class="dinq__label" data-ah-bg="Име" data-ah-en="Name">Име</span><input class="dinq__input" name="name" autocomplete="name" maxlength="120" required></label>' +
            '<label class="dinq__field"><span class="dinq__label" data-ah-bg="Телефон" data-ah-en="Phone">Телефон</span><input class="dinq__input" name="phone" autocomplete="tel" inputmode="tel" maxlength="60"></label>' +
            '<label class="dinq__field"><span class="dinq__label" data-ah-bg="Имейл" data-ah-en="Email">Имейл</span><input class="dinq__input" name="email" type="email" autocomplete="email" maxlength="180"></label>' +
          '</div>' +
          '<label class="dinq__field"><span class="dinq__label" data-ah-bg="Вашето запитване" data-ah-en="Your enquiry">Вашето запитване</span>' +
            '<textarea class="dask" name="message" rows="4" maxlength="4000" required data-ah-placeholder-bg="Напишете въпроса си за този автомобил…" data-ah-placeholder-en="Write your question about this vehicle…" placeholder="Напишете въпроса си за този автомобил…"></textarea></label>' +
          '<label class="dinq__trap" aria-hidden="true">Website<input name="website" tabindex="-1" autocomplete="off"></label>' +
          '<button class="btn-primary" type="submit" style="margin-top:16px" data-ah-bg="Изпрати" data-ah-en="Send">Изпрати</button>' +
          '<p class="dinq__status" role="status" aria-live="polite"></p>' +
        '</form>';
      bindVehicleInquiry(section.querySelector("#vehicle-inquiry-form"), v);
    }

    var rail = root.querySelector(".drail");
    if (rail) {
      var mainAction = rail.querySelector(".btn-primary");
      if (mainAction) {
        mainAction.setAttribute("href", "#vehicle-inquiry");
        text(mainAction, "Запитване", "Enquiry");
      }
      var ghost = rail.querySelector(".btn-ghost");
      if (ghost) ghost.remove();
      var fn = rail.querySelector(".drail__fn");
      if (fn) fn.remove();
    }

    var mobile = D.getElementById("dbar");
    if (mobile) {
      var mobileAction = mobile.querySelector(".btn-primary");
      if (mobileAction) {
        mobileAction.setAttribute("href", "#vehicle-inquiry");
        text(mobileAction, "Запитване", "Enquiry");
      }
    }

    applyBi(root);
    applyPlaceholders(root);
    normalizeTree(root);
    patchHead();
  }

  function applyPlaceholders(root) {
    if (!root || !root.querySelectorAll) return;
    var fields = root.querySelectorAll("[data-ah-placeholder-bg][data-ah-placeholder-en]");
    for (var i = 0; i < fields.length; i++) {
      fields[i].setAttribute("placeholder", currentLang === "en"
        ? fields[i].getAttribute("data-ah-placeholder-en")
        : fields[i].getAttribute("data-ah-placeholder-bg"));
    }
  }

  function normalizeTextNode(node) {
    if (!node || node.nodeType !== 3 || !node.parentNode) return;
    if (/^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA|CODE)$/.test(node.parentNode.nodeName)) return;
    var raw = node.nodeValue;
    var t = raw.replace(/[\s\u00a0]+/g, " ").trim();
    if (!t) return;
    var out = null;
    if (t === "AutoHaus Пловдив" || t === "Auto House Пловдив") out = "Auto House";
    else if (/^Виж всички\s+\d+\s+кад(ър|ъра)$/i.test(t)) out = "Виж всички";
    else if (/^(See|View) all\s+\d+\s+frames?$/i.test(t)) out = "See all";
    if (out) node.nodeValue = /^\s*/.exec(raw)[0] + out + /\s*$/.exec(raw)[0];
  }

  function normalizeTree(root) {
    if (!root) return;
    if (root.nodeType === 3) { normalizeTextNode(root); return; }
    if (!root.querySelectorAll) return;
    var walker = D.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    var n;
    while ((n = walker.nextNode())) normalizeTextNode(n);
  }

  function process(root) {
    normalizeTree(root || D.body);
    patchHead();
    removeHeaderPhone();
    patchContactPanel();
    patchVehiclePage();
    applyBi(D.body);
    applyPlaceholders(D.body);
  }

  injectStyles();
  process(D.body);

  D.addEventListener("click", function (e) {
    var trigger = e.target && e.target.closest ? e.target.closest("[data-contact]") : null;
    if (trigger) loadContactMap();
  }, true);

  var ctc = D.getElementById("ctc");
  if (ctc) {
    new MutationObserver(function () {
      if (ctc.getAttribute("aria-hidden") === "false" || ctc.classList.contains("is-open")) loadContactMap();
    }).observe(ctc, { attributes: true, attributeFilter: ["aria-hidden", "class"] });
  }

  new MutationObserver(function (records) {
    for (var i = 0; i < records.length; i++) {
      var r = records[i];
      if (r.type === "characterData") normalizeTextNode(r.target);
      else for (var j = 0; j < r.addedNodes.length; j++) normalizeTree(r.addedNodes[j]);
    }
    patchVehiclePage();
    patchHead();
    removeHeaderPhone();
  }).observe(D.body, { childList: true, subtree: true, characterData: true });

  window.addEventListener("ah:languagechange", function (e) {
    currentLang = e && e.detail && e.detail.lang === "en" ? "en" : "bg";
    applyBi(D.body);
    applyPlaceholders(D.body);
    patchHead();
  });
})();
