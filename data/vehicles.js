/* Auto House — scoped landing/navigation/listing refresh.
   This file keeps the existing inventory source intact in vehicles.base.js,
   applies the requested UI changes before main.js initializes, and refines
   runtime-rendered listing cards without changing unrelated architecture. */
(function () {
  "use strict";

  var D = document;
  var REFRESH_VERSION = "20260909a";

  /* Load the original inventory synchronously because main.js is the next
     ordered script and expects window.AH_VEHICLES to exist immediately. */
  (function loadInventory() {
    var xhr = new XMLHttpRequest();
    try {
      xhr.open("GET", "data/vehicles.base.js?v=" + REFRESH_VERSION, false);
      xhr.send(null);
      if ((xhr.status >= 200 && xhr.status < 300) || xhr.status === 0) {
        (0, eval)(xhr.responseText + "\n//# sourceURL=data/vehicles.base.js");
      } else {
        throw new Error("HTTP " + xhr.status);
      }
    } catch (err) {
      console.error("Auto House inventory failed to load", err);
      window.AH_VEHICLES = window.AH_VEHICLES || [];
    }
  })();

  var VEHICLES = window.AH_VEHICLES || [];
  var VEHICLE_BY_ID = {};
  for (var vi = 0; vi < VEHICLES.length; vi++) VEHICLE_BY_ID[VEHICLES[vi].id] = VEHICLES[vi];

  function savedLang() {
    try { return localStorage.getItem("ah-lang") === "en" ? "en" : "bg"; }
    catch (_) { return "bg"; }
  }
  var currentLang = savedLang();

  function mark(el, bg, en) {
    if (!el) return el;
    el.setAttribute("data-ah-bg", bg);
    el.setAttribute("data-ah-en", en);
    el.textContent = currentLang === "en" ? en : bg;
    return el;
  }

  function translateMarked(root) {
    if (!root) return;
    var items = [];
    if (root.nodeType === 1 && root.hasAttribute && root.hasAttribute("data-ah-bg")) items.push(root);
    if (root.querySelectorAll) {
      var found = root.querySelectorAll("[data-ah-bg][data-ah-en]");
      for (var i = 0; i < found.length; i++) items.push(found[i]);
    }
    for (var j = 0; j < items.length; j++) {
      var el = items[j];
      var value = currentLang === "en" ? el.getAttribute("data-ah-en") : el.getAttribute("data-ah-bg");
      if (el.textContent !== value) el.textContent = value;
    }
  }

  function navHref(hash) {
    var path = (location.pathname || "").split("/").pop();
    var landing = !path || path === "index.html";
    return (landing ? "" : "index.html") + hash;
  }

  function patchNavigation() {
    var desktop = D.querySelector(".hd-links");
    if (desktop) {
      desktop.innerHTML =
        '<li><a class="lnk" href="' + navHref("#zastrahovki") + '"><span data-ah-bg="Застраховки" data-ah-en="Insurance">Застраховки</span></a></li>' +
        '<li><a class="lnk" href="' + navHref("#lizing") + '"><span data-ah-bg="Лизинг" data-ah-en="Leasing">Лизинг</span></a></li>' +
        '<li><a class="lnk" href="' + navHref("#servis") + '"><span data-ah-bg="Сервиз" data-ah-en="Service">Сервиз</span></a></li>' +
        '<li><a class="lnk" href="legal.html#imprint" data-contact><span data-ah-bg="Контакти" data-ah-en="Contacts">Контакти</span></a></li>';
    }

    var mobile = D.querySelector(".mob nav");
    if (mobile) {
      mobile.innerHTML =
        '<a href="' + navHref("#avtomobili") + '" data-ah-bg="Автомобили" data-ah-en="Vehicles">Автомобили</a>' +
        '<a href="' + navHref("#zastrahovki") + '" data-ah-bg="Застраховки" data-ah-en="Insurance">Застраховки</a>' +
        '<a href="' + navHref("#lizing") + '" data-ah-bg="Лизинг" data-ah-en="Leasing">Лизинг</a>' +
        '<a href="' + navHref("#servis") + '" data-ah-bg="Сервиз" data-ah-en="Service">Сервиз</a>' +
        '<a href="' + navHref("#care") + '" data-ah-bg="Auto Spa" data-ah-en="Auto Spa">Auto Spa</a>' +
        '<a href="' + navHref("#cafe") + '" data-ah-bg="Кафе бар" data-ah-en="Cafe bar">Кафе бар</a>' +
        '<a href="legal.html" data-ah-bg="Политика" data-ah-en="Policy">Политика</a>' +
        '<a href="legal.html#imprint" data-contact data-ah-bg="Контакти" data-ah-en="Contacts">Контакти</a>' +
        '<a href="concierge.html" data-ah-bg="Запитване" data-ah-en="Enquiry">Запитване</a>';
    }

    var headerCta = D.querySelector(".hd-zone--end .btn[href*='concierge'] .btn__label");
    if (headerCta) mark(headerCta, "Запитване", "Enquiry");
    translateMarked(D.body);
  }

  function patchHero() {
    var stage = D.querySelector(".stage#top");
    if (!stage) return;
    stage.setAttribute("aria-label", "Auto House");
    stage.innerHTML = String.raw`
      <div class="stage-pag">
        <span class="pag-pos"><span class="sr-only" id="pag-cur-a11y">Кадър 1 от 5</span><span class="cnt" id="pag-cur" aria-hidden="true"><span class="cnt-d"><span>1</span></span></span><i class="pag-sep" aria-hidden="true"></i><span class="pag-tot" id="pag-tot" aria-hidden="true">5</span></span>
        <input class="pag-range" id="pag-range" type="range" min="1" max="5" value="1" step="1" aria-label="Кадър">
        <button class="btn btn--s btn--tertiary pag-btn" id="pag-prev" aria-label="Предишен"><svg class="ic" viewBox="0 0 16 16" aria-hidden="true"><use href="#ic-chev-l"/></svg></button>
        <button class="btn btn--s btn--tertiary pag-btn" id="pag-next" aria-label="Следващ"><svg class="ic" viewBox="0 0 16 16" aria-hidden="true"><use href="#ic-chev-r"/></svg></button>
      </div>

      <div class="stage-item is-active" data-i="0">
        <div class="stage-bg"><img width="320" height="161" decoding="async" alt="" aria-hidden="true" fetchpriority="high" src="img/outside_autohaus-320.jpg"></div>
        <div class="stage-box"><div class="stage-frame">
          <div class="stage-media">
            <picture><source type="image/webp" srcset="img/outside_autohaus-768.webp 768w, img/outside_autohaus-1280.webp 1280w, img/outside_autohaus-1920.webp 1920w" sizes="(min-width:1920px) 88vw, (min-width:768px) 92vw, 100vw"><img width="1280" height="645" decoding="async" sizes="(min-width:1920px) 88vw, (min-width:768px) 92vw, 100vw" alt="Сградата на AutoHaus през деня" fetchpriority="high" src="img/outside_autohaus-1280.jpg" srcset="img/outside_autohaus-768.jpg 768w, img/outside_autohaus-1280.jpg 1280w, img/outside_autohaus-1920.jpg 1920w" style="object-position:20% 50%"></picture>
            <div class="grad grad--t" aria-hidden="true"></div><div class="grad grad--b" aria-hidden="true"></div>
          </div>
          <div class="stage-content">
            <div class="stage-text"><h1 class="h3" data-ah-bg="Auto House" data-ah-en="Auto House">Auto House</h1></div>
            <div class="btn-group btn-group--stage"><a class="btn btn--l btn--primary" href="#avtomobili" data-catalog><span class="btn__label" data-ah-bg="Автомобили" data-ah-en="Vehicles">Автомобили</span></a></div>
          </div>
        </div></div>
      </div>

      <div class="stage-item" data-i="1">
        <div class="stage-bg"><img width="320" height="233" decoding="async" alt="" aria-hidden="true" loading="lazy" data-src="img/indoor_cars-320.jpg"></div>
        <div class="stage-box"><div class="stage-frame">
          <div class="stage-media">
            <picture><source type="image/webp" data-srcset="img/indoor_cars-768.webp 768w, img/indoor_cars-1280.webp 1280w, img/indoor_cars-1920.webp 1920w" sizes="(min-width:1920px) 88vw, (min-width:768px) 92vw, 100vw"><img width="1280" height="934" decoding="async" sizes="(min-width:1920px) 88vw, (min-width:768px) 92vw, 100vw" alt="Автомобили в шоурума на AutoHaus" loading="lazy" data-src="img/indoor_cars-1280.jpg" data-srcset="img/indoor_cars-768.jpg 768w, img/indoor_cars-1280.jpg 1280w, img/indoor_cars-1920.jpg 1920w" style="object-position:50% 50%"></picture>
            <div class="grad grad--t" aria-hidden="true"></div><div class="grad grad--b" aria-hidden="true"></div>
          </div>
          <div class="stage-content">
            <div class="stage-text"><h2 class="h3" data-ah-bg="Шоурум" data-ah-en="Showroom">Шоурум</h2></div>
            <div class="btn-group btn-group--stage"><a class="btn btn--l btn--primary" href="#avtomobili" data-catalog><span class="btn__label" data-ah-bg="Автомобили" data-ah-en="Vehicles">Автомобили</span></a></div>
          </div>
        </div></div>
      </div>

      <div class="stage-item" data-i="2">
        <div class="stage-bg"><img width="320" height="320" decoding="async" alt="" aria-hidden="true" loading="lazy" data-src="img/autospa_night-400.jpg"></div>
        <div class="stage-box"><div class="stage-frame">
          <div class="stage-media">
            <picture><source type="image/webp" data-srcset="img/autospa_night-400.webp 400w, img/autospa_night-800.webp 800w, img/autospa_night-1080.webp 1080w" sizes="(min-width:1920px) 88vw, (min-width:768px) 92vw, 100vw"><img width="1080" height="1080" decoding="async" sizes="(min-width:1920px) 88vw, (min-width:768px) 92vw, 100vw" alt="Auto Spa" loading="lazy" data-src="img/autospa_night-800.jpg" data-srcset="img/autospa_night-400.jpg 400w, img/autospa_night-800.jpg 800w, img/autospa_night-1080.jpg 1080w" style="object-position:40% 50%"></picture>
            <div class="grad grad--t" aria-hidden="true"></div><div class="grad grad--b" aria-hidden="true"></div>
          </div>
          <div class="stage-content">
            <div class="stage-text"><h2 class="h3" data-ah-bg="Auto Spa" data-ah-en="Auto Spa">Auto Spa</h2></div>
            <div class="btn-group btn-group--stage"><a class="btn btn--l btn--primary" href="#avtomobili" data-catalog><span class="btn__label" data-ah-bg="Автомобили" data-ah-en="Vehicles">Автомобили</span></a></div>
          </div>
        </div></div>
      </div>

      <div class="stage-item" data-i="3">
        <div class="stage-bg"><img width="400" height="250" decoding="async" alt="" aria-hidden="true" loading="lazy" data-src="img/v/2026-07_1-16-400.jpg"></div>
        <div class="stage-box"><div class="stage-frame">
          <div class="stage-media">
            <picture><source type="image/webp" data-srcset="img/v/2026-07_1-16-400.webp 400w, img/v/2026-07_1-16-800.webp 800w, img/v/2026-07_1-16-1280.webp 1280w" sizes="(min-width:1920px) 88vw, (min-width:768px) 92vw, 100vw"><img width="1280" height="800" decoding="async" sizes="(min-width:1920px) 88vw, (min-width:768px) 92vw, 100vw" alt="Сервиз AutoHaus" loading="lazy" data-src="img/v/2026-07_1-16-800.jpg" data-srcset="img/v/2026-07_1-16-400.jpg 400w, img/v/2026-07_1-16-800.jpg 800w, img/v/2026-07_1-16-1280.jpg 1280w" style="object-position:50% 50%"></picture>
            <div class="grad grad--t" aria-hidden="true"></div><div class="grad grad--b" aria-hidden="true"></div>
          </div>
          <div class="stage-content">
            <div class="stage-text"><h2 class="h3" data-ah-bg="Сервиз" data-ah-en="Service">Сервиз</h2></div>
            <div class="btn-group btn-group--stage"><a class="btn btn--l btn--primary" href="#avtomobili" data-catalog><span class="btn__label" data-ah-bg="Автомобили" data-ah-en="Vehicles">Автомобили</span></a></div>
          </div>
        </div></div>
      </div>

      <div class="stage-item" data-i="4">
        <div class="stage-bg"><img width="320" height="320" decoding="async" alt="" aria-hidden="true" loading="lazy" data-src="img/coffee_bar-new-320.jpg"></div>
        <div class="stage-box"><div class="stage-frame">
          <div class="stage-media">
            <picture><source type="image/webp" data-srcset="img/coffee_bar-new-320.webp 320w, img/coffee_bar-new-768.webp 768w, img/coffee_bar-new-1280.webp 1280w" sizes="(min-width:1920px) 88vw, (min-width:768px) 92vw, 100vw"><img width="1280" height="1280" decoding="async" sizes="(min-width:1920px) 88vw, (min-width:768px) 92vw, 100vw" alt="Кафе бар AutoHaus" loading="lazy" data-src="img/coffee_bar-new-768.jpg" data-srcset="img/coffee_bar-new-320.jpg 320w, img/coffee_bar-new-768.jpg 768w, img/coffee_bar-new-1280.jpg 1280w" style="object-position:50% 50%"></picture>
            <div class="grad grad--t" aria-hidden="true"></div><div class="grad grad--b" aria-hidden="true"></div>
          </div>
          <div class="stage-content"><div class="stage-text"><h2 class="h3" data-ah-bg="Кафе бар" data-ah-en="Cafe bar">Кафе бар</h2></div></div>
        </div></div>
      </div>`;
    translateMarked(stage);
  }

  function serviceCard(kind) {
    if (kind === "leasing") {
      return String.raw`<div class="wcard">
        <span class="wcard-photo"><picture><source type="image/webp" srcset="img/three-cars-400.webp 400w, img/three-cars-800.webp 800w, img/three-cars-1280.webp 1280w" sizes="(min-width:1440px) 30vw, (min-width:768px) 40vw, 76vw"><img loading="lazy" decoding="async" width="800" height="1067" src="img/three-cars-800.jpg" srcset="img/three-cars-400.jpg 400w, img/three-cars-800.jpg 800w, img/three-cars-1280.jpg 1280w" sizes="(min-width:1440px) 30vw, (min-width:768px) 40vw, 76vw" alt="Три автомобила в шоурума на AutoHaus"></picture></span>
        <span class="wcard-text"><span class="wcard-label" data-ah-bg="Финансиране" data-ah-en="Financing">Финансиране</span><a class="wcard-anchor" href="#cw-lizing" aria-expanded="false" aria-controls="cw-lizing"><span class="h6 wcard-h" data-ah-bg="Лизинг" data-ah-en="Leasing">Лизинг</span></a><span class="body-s wcard-body" data-ah-bg="Лизинг при покупка на автомобил." data-ah-en="Leasing for a vehicle purchase.">Лизинг при покупка на автомобил.</span></span>
      </div><div class="wcard-panel" id="cw-lizing" role="group" aria-label="Лизинг"><div class="wcard-panel-in">
        <button type="button" class="btn btn--l btn--tertiary wcard-close"><svg class="ic" viewBox="0 0 18 18" aria-hidden="true"><use href="#ic-x"/></svg><span class="btn__label" data-ah-bg="Затвори" data-ah-en="Close">Затвори</span></button>
        <div class="wcard-scroll"><h3 class="wcard-panel-h" data-ah-bg="Лизинг" data-ah-en="Leasing">Лизинг</h3><div class="body-s"><p data-ah-bg="Условията за лизинг се уточняват индивидуално при запитване." data-ah-en="Leasing terms are confirmed individually on enquiry.">Условията за лизинг се уточняват индивидуално при запитване.</p></div></div>
        <div class="btn-group wcard-cta"><a class="btn btn--s btn--primary" href="concierge.html?intent=other"><span class="btn__label" data-ah-bg="Запитване" data-ah-en="Enquiry">Запитване</span></a></div>
      </div></div>`;
    }
    return String.raw`<div class="wcard">
      <span class="wcard-photo"><picture><source type="image/webp" srcset="img/autohaus_inside-320.webp 320w, img/autohaus_inside-768.webp 768w, img/autohaus_inside-1280.webp 1280w" sizes="(min-width:1440px) 30vw, (min-width:768px) 40vw, 76vw"><img loading="lazy" decoding="async" width="800" height="800" src="img/autohaus_inside-768.jpg" srcset="img/autohaus_inside-320.jpg 320w, img/autohaus_inside-768.jpg 768w, img/autohaus_inside-1280.jpg 1280w" sizes="(min-width:1440px) 30vw, (min-width:768px) 40vw, 76vw" alt="Шоурум AutoHaus"></picture></span>
      <span class="wcard-text"><span class="wcard-label" data-ah-bg="Покритие" data-ah-en="Insurance">Покритие</span><a class="wcard-anchor" href="#cw-zastrahovki" aria-expanded="false" aria-controls="cw-zastrahovki"><span class="h6 wcard-h" data-ah-bg="Застраховки" data-ah-en="Insurance">Застраховки</span></a><span class="body-s wcard-body" data-ah-bg="Застраховане при покупка на автомобил." data-ah-en="Insurance for a vehicle purchase.">Застраховане при покупка на автомобил.</span></span>
    </div><div class="wcard-panel" id="cw-zastrahovki" role="group" aria-label="Застраховки"><div class="wcard-panel-in">
      <button type="button" class="btn btn--l btn--tertiary wcard-close"><svg class="ic" viewBox="0 0 18 18" aria-hidden="true"><use href="#ic-x"/></svg><span class="btn__label" data-ah-bg="Затвори" data-ah-en="Close">Затвори</span></button>
      <div class="wcard-scroll"><h3 class="wcard-panel-h" data-ah-bg="Застраховки" data-ah-en="Insurance">Застраховки</h3><div class="body-s"><p data-ah-bg="Условията за застраховане се уточняват индивидуално при запитване." data-ah-en="Insurance terms are confirmed individually on enquiry.">Условията за застраховане се уточняват индивидуално при запитване.</p></div></div>
      <div class="btn-group wcard-cta"><a class="btn btn--s btn--primary" href="concierge.html?intent=other"><span class="btn__label" data-ah-bg="Запитване" data-ah-en="Enquiry">Запитване</span></a></div>
    </div></div>`;
  }

  function patchLanding() {
    var stage = D.querySelector(".stage#top");
    if (!stage) return;

    D.title = "Auto House";
    var meta = D.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", "Auto House");

    patchHero();

    var heading = D.querySelector("#avtomobili .csec__h, .csec__h");
    if (heading && /Колекцията|The collection/i.test(heading.textContent.trim())) mark(heading, "Автомобили", "Vehicles");

    var lizing = D.getElementById("lizing");
    if (lizing) {
      lizing.setAttribute("style", "--i:2");
      lizing.innerHTML = serviceCard("leasing");
      if (!D.getElementById("zastrahovki")) {
        var insurance = D.createElement("div");
        insurance.className = "wcard-item";
        insurance.id = "zastrahovki";
        insurance.setAttribute("style", "--i:3");
        insurance.innerHTML = serviceCard("insurance");
        lizing.parentNode.insertBefore(insurance, lizing.nextSibling);
      }
    }
    var cafe = D.getElementById("cafe");
    if (cafe) cafe.setAttribute("style", "--i:4");

    var about = D.getElementById("about");
    if (about) about.remove();

    translateMarked(D.body);
  }

  function injectStyles() {
    var style = D.createElement("style");
    style.id = "ah-requested-refresh";
    style.textContent = String.raw`
      .lc__act{display:none!important}
      .lc__body{padding-right:var(--cat-inset)!important}
      .lc__meta{white-space:normal!important;overflow:visible!important;text-overflow:clip!important;display:flex!important;flex-wrap:wrap;gap:0 6px;align-items:baseline}
      .lc__meta-item{min-width:0}
      .lc__meta-item:not(:last-child)::after{content:" ·";opacity:.6}
      @media(max-width:599px){
        .cgrid{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:16px 8px!important}
        .lc__body{padding:8px 8px 10px!important}
        .lc__price{font-size:13px!important;line-height:18px!important}
        .lc__name{font-size:12px!important;line-height:17px!important}
        .lc__meta{font-size:11px!important;line-height:15px!important;gap:0 4px!important}
        .lc__cue{display:none!important}
      }`;
    D.head.appendChild(style);
  }

  function fmt(n) {
    return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0");
  }

  function metaPart(bg, en) {
    var span = D.createElement("span");
    span.className = "lc__meta-item";
    mark(span, bg, en);
    return span;
  }

  function enhanceCard(card) {
    if (!card || card.nodeType !== 1 || card.getAttribute("data-ah-refined") === "1") return;
    var id = card.getAttribute("data-id");
    var v = VEHICLE_BY_ID[id];
    if (!v) return;

    var action = card.querySelector(".lc__act");
    if (action) action.remove();

    var meta = card.querySelector(".lc__meta");
    if (!meta) return;
    meta.textContent = "";

    var gearBG = v.gear === "manual" ? "Ръчна" : (v.gear === "auto" ? "Автоматична" : "—");
    var gearEN = v.gear === "manual" ? "Manual" : (v.gear === "auto" ? "Automatic" : "—");
    var fuelMap = {
      petrol: ["Бензин", "Petrol"], diesel: ["Дизел", "Diesel"],
      hybrid: ["Хибрид", "Hybrid"], phev: ["Plug-in хибрид", "Plug-in hybrid"],
      ev: ["Електрически", "Electric"]
    };
    var fuel = fuelMap[v.fuel] || ["—", "—"];
    var kmBG = v.km == null ? "—" : fmt(v.km) + " км";
    var kmEN = v.km == null ? "—" : fmt(v.km) + " km";
    var regBG, regEN;
    if (v.unreg || !v.year) {
      regBG = "Без първа регистрация";
      regEN = "No first registration";
    } else {
      var date = (v.month ? (v.month < 10 ? "0" : "") + v.month + "/" : "") + v.year;
      regBG = "Първа регистрация " + date;
      regEN = "First registration " + date;
    }

    meta.appendChild(metaPart(gearBG, gearEN));
    meta.appendChild(metaPart(fuel[0], fuel[1]));
    meta.appendChild(metaPart(kmBG, kmEN));
    meta.appendChild(metaPart(regBG, regEN));
    card.setAttribute("data-ah-refined", "1");
  }

  var BG_TEXT = {
    "Колекцията": "Автомобили",
    "Колекцията на AutoHaus": "Автомобили",
    "Целият каталог": "Виж всички",
    "Целия каталог": "Виж всички",
    "Цялата колекция": "Виж всички",
    "Обратно към колекцията": "Обратно към автомобилите",
    "Търсене в колекцията": "Търсене на автомобили",
    "Резултати от търсенето в наличната колекция.": "Резултати от търсенето в наличните автомобили."
  };
  var EN_TEXT = {
    "The collection": "Vehicles",
    "The AutoHaus collection": "Vehicles",
    "The full catalogue": "See all",
    "The whole collection": "See all",
    "Back to the collection": "Back to vehicles",
    "Search the collection": "Search vehicles",
    "Search results within the collection in stock.": "Search results within vehicles in stock."
  };

  function normalizeTextNode(node) {
    if (!node || node.nodeType !== 3 || !node.parentNode) return;
    var p = node.parentNode;
    if (/^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA|CODE)$/.test(p.nodeName)) return;
    var raw = node.nodeValue;
    var trimmed = raw.replace(/[\s\u00a0]+/g, " ").trim();
    if (!trimmed) return;
    var next = BG_TEXT[trimmed] || EN_TEXT[trimmed] || null;
    if (!next && /^Виж всички\s+\d+\s+автомобила$/i.test(trimmed)) next = "Виж всички";
    if (!next && /^See all\s+\d+\s+vehicles$/i.test(trimmed)) next = "See all";
    if (next && next !== trimmed) {
      var lead = /^\s*/.exec(raw)[0], tail = /\s*$/.exec(raw)[0];
      node.nodeValue = lead + next + tail;
    }
  }

  function normalizeAttrs(el) {
    if (!el || el.nodeType !== 1) return;
    var attrs = ["aria-label", "title"];
    for (var i = 0; i < attrs.length; i++) {
      var a = attrs[i], value = el.getAttribute(a);
      if (!value) continue;
      var next = BG_TEXT[value] || EN_TEXT[value] || null;
      if (next) el.setAttribute(a, next);
    }
  }

  function processRoot(root) {
    if (!root) return;
    if (root.nodeType === 3) {
      normalizeTextNode(root);
      return;
    }
    if (root.nodeType !== 1 && root.nodeType !== 9) return;

    if (root.nodeType === 1) {
      normalizeAttrs(root);
      if (root.classList && root.classList.contains("lc")) enhanceCard(root);
      if (root.classList && root.classList.contains("fsel__t")) {
        var parent = root.closest(".fsel");
        var t = root.textContent.trim();
        if (parent && !parent.classList.contains("is-set") && (t === "Марка" || t === "Make" || t === "Филтри" || t === "Filters")) {
          mark(root, "Филтри", "Filters");
        }
      }
    }

    if (root.querySelectorAll) {
      var cards = root.querySelectorAll(".lc");
      for (var c = 0; c < cards.length; c++) enhanceCard(cards[c]);

      var filterLabels = root.querySelectorAll(".fsel__t");
      for (var f = 0; f < filterLabels.length; f++) {
        var fl = filterLabels[f], fp = fl.closest(".fsel"), ft = fl.textContent.trim();
        if (fp && !fp.classList.contains("is-set") && (ft === "Марка" || ft === "Make" || ft === "Филтри" || ft === "Filters")) mark(fl, "Филтри", "Filters");
      }

      var walker = D.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
      var n;
      while ((n = walker.nextNode())) normalizeTextNode(n);

      var labelled = root.querySelectorAll("[aria-label],[title]");
      for (var a = 0; a < labelled.length; a++) normalizeAttrs(labelled[a]);
    }
    translateMarked(root);
  }

  injectStyles();
  patchNavigation();
  patchLanding();
  processRoot(D.body);

  var observer = new MutationObserver(function (records) {
    for (var i = 0; i < records.length; i++) {
      var r = records[i];
      if (r.type === "characterData") {
        normalizeTextNode(r.target);
      } else {
        for (var j = 0; j < r.addedNodes.length; j++) processRoot(r.addedNodes[j]);
      }
    }
  });
  if (D.body) observer.observe(D.body, { childList: true, subtree: true, characterData: true });

  window.addEventListener("ah:languagechange", function (e) {
    currentLang = e && e.detail && e.detail.lang === "en" ? "en" : "bg";
    translateMarked(D.body);
    processRoot(D.body);
  });
})();
