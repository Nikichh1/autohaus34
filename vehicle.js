(window.AH_INVENTORY_READY || Promise.resolve()).then(function () {
/* AutoHaus vehicle dossier. The existing gallery composition, compact facts,
   published BG/EN content and direct enquiry share one responsive layout. */
(function () {
  "use strict";
  var D = document, AH = window.AH, CFG = AH.cfg;
  var root = D.getElementById("vd");
  if (!root) return;

  var mini = D.getElementById("dmini"), bar = D.getElementById("dbar");
  var id = new URLSearchParams(location.search).get("id");
  var v = id ? AH.byId(id) : null;

  /* ---- sold or mistyped: never a dead end, and never a sticky bar ---- */
  if (!v) {
    if (window.AH_INVENTORY_SOURCE !== "managed") {
      root.innerHTML = '<section class="vd-body dsec" style="padding-top:32px"><h1 class="h4">Връзката с каталога е временно недостъпна.</h1><p class="dprose">Моля, опитайте отново след малко.</p><button class="btn-primary" id="inventory-retry">Опитай отново</button></section>';
      D.getElementById("inventory-retry").addEventListener("click", function () { location.reload(); });
      if (mini) mini.remove();
      if (bar) bar.remove();
      return;
    }
    D.title = "Автомобилът не е намерен — AutoHaus";
    root.innerHTML =
      '<div class="vd-body" style="padding-top:24px">' +
        '<section class="dsec">' +
          '<h1 class="h4" style="color:var(--ink);margin-bottom:16px">' +
            "Този автомобил не е наличен.</h1>" +
          '<div class="dprose" style="max-width:62ch">' +
            "<p>Разгледайте наличните автомобили или се свържете с нас за повече информация.</p></div>" +
          '<div class="btn-group" style="margin-top:32px">' +
            '<a class="btn-primary" href="index.html#avtomobili">Автомобили</a>' +
            '<a class="btn-ghost" href="concierge.html?intent=source">Намерете ми такъв</a>' +
          "</div>" +
        "</section>" +
      "</div>";
    if (mini && mini.parentNode) mini.parentNode.removeChild(mini);
    if (bar && bar.parentNode) bar.parentNode.removeChild(bar);
    return;
  }

  /* ---- page identity ---- */
  var priceLabel = v.price == null ? "цена при запитване" : AH.price(v.price);
  D.title = v.full + " · " + priceLabel + " — AutoHaus";
  var md = D.querySelector('meta[name="description"]');
  if (md) md.setAttribute("content",
    v.full + ", " + (v.unreg ? "нерегистриран" : v.year + " г.") + ", " + AH.km(v.km) + ", " +
    (v.hp ? v.hp + " к.с. " : "") + "Автомобил в AutoHaus.");

  function prettyPhone(p) {
    var m = String(p).match(/^\+359(\d{3})(\d{3})(\d{3})$/);
    return m ? "+359 " + m[1] + " " + m[2] + " " + m[3] : p;
  }

  var shots = (v.shots || []).filter(Boolean);
  var N = shots.length;
  function gallerySizes(count) {
    return count === 1 ? '100vw' : '(min-width:1024px) 46vw, 100vw';
  }
  var mainSizes = gallerySizes(N);
  var chapterName = AH.chapterName[v.chapter] || "";
  var backHref = "index.html#avtomobili";
  var backName = "автомобилите";

  var CHECK = '<svg viewBox="0 0 16 16" aria-hidden="true"><use href="#ic-check"/></svg>';
  var PHONE = '<svg viewBox="0 0 16 16" aria-hidden="true"><use href="#ic-phone"/></svg>';

  // Only stored vehicle facts and published equipment are rendered here.
  // VAT notes remain beside the price; all other notes follow the facts.

  /* the per-car notes: two to four lines the listing prints under the price.
     The VAT one belongs beside the price; the rest belong under the spec. */
  var allNotes = (v.notes || []).slice();
  var vatNote = null;
  var notes = allNotes.filter(function (t) {
    if (/ДДС/.test(t)) { vatNote = t.replace(/!+$/, ""); return false; }
    return true;
  }).map(function (t) { return t.replace(/!+$/, ""); });

  var MONTHS = ["", "януари", "февруари", "март", "април", "май", "юни",
                "юли", "август", "септември", "октомври", "ноември", "декември"];
  /* the listing's own wording, including the case where there is none */
  var regTxt = v.unreg || !v.year ? "Без първа регистрация"
    : (v.year ? ((v.month ? MONTHS[v.month] + " " : "") + v.year + " г.") : "—");

  function specRows() {
    var rows = [["Регистрация", regTxt],
            ["Гориво", AH.fuel[v.fuel] || "—"],
            ["Мощност", v.hp ? v.hp + " к.с." : "—"],
            ["Трансмисия", v.gear === "manual" ? "Ръчна" : v.gear === "auto" ? "Автоматична" : "—"],
            ["Пробег", v.km == null ? "—" : AH.fmt(v.km) + " км"],
            ["Цвят", v.colour || "—"]];
    var bodies = { suv: "SUV", sedan: "Седан", wagon: "Комби", hatchback: "Хечбек", coupe: "Купе", cabrio: "Кабриолет", van: "Ван", pickup: "Пикап", passenger: "Лек автомобил", other: "Друг" };
    if (v.body_type) rows.splice(1, 0, ["Каросерия", bodies[v.body_type] || v.body_type]);
    return rows;
  }

  /* ---- the equipment list ----
     Two shapes in the source, both kept: "<code> – <text>" is an option
     carrying the maker's own code, and a line opening with "-" is a
     sub-point of the option above it. Nothing is reordered or reworded. */
  function equipHTML(lines) {
    var groups = [];
    /* A few source option codes use Cyrillic characters that look identical
       to their Latin OEM counterparts (for example 4А2). Keep the source
       code, but render the universally recognisable Latin form in either
       language so an English dossier contains no accidental Cyrillic. */
    var codeLatin = {
      "А": "A", "В": "B", "Е": "E", "К": "K", "М": "M", "Н": "H",
      "О": "O", "Р": "P", "С": "C", "Т": "T", "У": "Y", "Х": "X"
    };
    function optionCode(value) {
      return value.replace(/[АВЕКМНОРСТУХ]/g, function (letter) {
        return codeLatin[letter];
      });
    }
    for (var i = 0; i < lines.length; i++) {
      String(lines[i]).replace(/\r\n?/g, "\n").split("\n").forEach(function (line) {
        var t = line.trim();
        if (!t) return;
        var dash = /^[-–—]\s*/.test(t);
        if (dash && groups.length && groups[groups.length - 1].code) {
          groups[groups.length - 1].subs.push(t.replace(/^[-–—]\s*/, ""));
          return;
        }
        t = t.replace(/^[•●▪]\s*|^[-–—]\s*/, "");
        var m = t.match(/^([0-9A-ZА-Я]{1,6})\s+[-–—]\s*(.+)$/);
        groups.push({ code: m ? optionCode(m[1]) : "", label: m ? m[2] : t, subs: [] });
      });
    }
    function item(group) {
      return '<li class="deq-i' + (group.code ? ' deq-i--coded' : '') + '">' +
        (group.code ? '<span class="deq-c">' + AH.esc(group.code) + '</span>' : '') +
        '<span class="deq-v">' + AH.esc(group.label) + '</span>' +
        (group.subs.length ? '<ul class="deq-sub">' + group.subs.map(function (sub) {
          return '<li>' + AH.esc(sub) + '</li>';
        }).join("") + '</ul>' : '') + '</li>';
    }
    return {
      html: '<ul class="deq-col">' + groups.map(item).join("") + '</ul>',
      simple: groups.every(function (group) { return !group.subs.length && group.label.length < 150; }),
      n: groups.length
    };
  }



  /* ============================================================
     RENDER
     ============================================================ */
  root.innerHTML = '' +
  '<div class="vd-body" style="padding-top:24px">' +

    /* ---------- 1. GALLERY ---------- */
    '<section class="dgallery" aria-label="Галерия">' +
      '<div class="dgal-wrap" id="dgal-wrap">' +
      '<div class="dgal dgal--1" id="dgal">' +
        (N ? '<a class="dgal__f dgal__main" href="' + AH.esc(shots[0]) + '" data-i="0" aria-label="Кадър 1 от ' + N + ' — уголеми">' +
          AH.picture(shots[0], { eager: true, width: 1600, height: 900,
                                sizes: mainSizes, src: 1280,
                                alt: v.full + " — кадър 1" }) +
          '<span class="dgal__n">1 / ' + N + '</span></a>' : '') +
      "</div>" +
      (!N ? '<div class="dgal-empty" data-ah-bg="Очаквайте снимки" data-ah-en="Photos coming soon">Очаквайте снимки</div>' : '') +
      "</div>" +
      (N > 1 ? '<div class="dthumbs" id="dthumbs" role="group" aria-label="Избери снимка">' + shots.map(function (s, i) {
        return '<button type="button" class="dthumb' + (!i ? ' is-active' : '') + '" data-i="' + i + '" aria-pressed="' + (!i) + '" aria-label="' + (i + 1) + ' / ' + N + '">' +
          AH.picture(s, { width: 160, height: 90, widths: [400], src: 400, sizes: "96px", alt: v.full + ' / ' + (i + 1) }) + '</button>';
      }).join('') + '</div>' : '') +
      '<div class="dgal-bar">' +
        (N ? '<span class="dgal-bar__n" id="dgal-n" aria-live="polite" data-nt>1 / ' + N + '</span>' : '') +
        (N > 1 ? '<div class="dgal-controls"><button type="button" id="dgal-prev" aria-label="Предишен кадър"><svg viewBox="0 0 16 16" aria-hidden="true"><use href="#ic-chev-l"/></svg></button><button type="button" id="dgal-next" aria-label="Следващ кадър"><svg viewBox="0 0 16 16" aria-hidden="true"><use href="#ic-chev-r"/></svg></button></div>' : '') +
      "</div>" +
    "</section>" +

    /* ---------- 2. BODY ---------- */
    '<div class="dbody">' +
    '<div class="dossier">' +
    '<div class="dossier-content">' +

      /* a) title / price */
      '<section class="dsec dsummary">' +
        '<p class="dtitle__make">' + AH.esc(v.make) + '</p>' +
        '<div class="dtitle">' +
          "<h1>" + AH.esc(v.model) + "</h1>" +
          '<div class="dtitle__pw">' +
            '<p class="dtitle__price">' +
              (v.price == null ? "Цена при запитване" : AH.fmt(v.price) + " €") + "</p>" +
            (vatNote ? '<p class="dtitle__vat">' + AH.esc(vatNote) + "</p>" : "") +
          "</div>" +
        "</div>" +

      /* b) THE SPECIFICATION — one block, the eight rows the listing has.
         It was a scrolling strip of six, a table of ten underneath it and a
         sentence restating all six a third time. */
        '<dl class="dspec" aria-label="Спецификация">' +
          specRows().map(function (r) {
            return "<div><dt>" + r[0] + "</dt><dd>" + AH.esc(String(r[1])) + "</dd></div>";
          }).join("") +
        "</dl>" +
        /* the listing's own notes, in its own words. Never a fixed set: of
           the 83 published cars, 25 carry the VAT line and 60 the service
           history, and a car that says neither says neither here. */
        (notes.length
          ? '<ul class="dnotes">' + notes.map(function (t) {
              return "<li>" + CHECK + "<span>" + AH.esc(t) + "</span></li>";
            }).join("") + "</ul>"
          : "") +
      "</section>" +

      /* c) THE EQUIPMENT.
         Loaded per car from data/eq/<id>.js after this render — it is the
         one heavy thing on the page and it is below the fold at every
         width. The box reserves its own height so the arrival shifts
         nothing, and if the file is missing (four cars have been sold and
         their listings are gone) the section simply never appears. */
      '<section class="dsec" id="deq-sec" hidden>' +
        '<h2 class="dsec__h">Оборудване <span class="dsec__n" id="deq-n"></span></h2>' +
        '<div class="dclamp" id="deq-clamp"><div class="deq" id="deq"></div></div>' +
        '<button type="button" class="dmore" id="deq-more" aria-expanded="false" aria-controls="deq-clamp" hidden>' +
          "Прочети още</button>" +
      "</section>" +

      '</div>' +
      '<section class="dsec dinquiry" id="vehicle-inquiry">' +
        '<h2 class="dsec__h">Запитване</h2>' +
        '<div class="dinq-layout">' +
          '<div class="dseller dseller--clean">' +
            '<p class="dseller__n" data-ah-bg="Иван Манев" data-ah-en="Ivan Manev">Иван Манев</p>' +
            '<div class="dseller__acts">' +
              '<a href="tel:' + AH.esc(CFG.expertPhone) + '">' + PHONE + AH.esc(prettyPhone(CFG.expertPhone)) + '</a>' +
              '<a class="dseller__mail" href="mailto:autohaussale@gmail.com">autohaussale@gmail.com</a>' +
            '</div>' +
          '</div>' +
          '<form class="dinq" id="vehicle-inquiry-form" novalidate>' +
            '<div class="dinq__grid">' +
              '<label class="dinq__field"><span class="dinq__label">Име</span><input class="dinq__input" name="name" autocomplete="name" maxlength="120" required></label>' +
              '<label class="dinq__field"><span class="dinq__label">Телефон</span><input class="dinq__input" name="phone" type="tel" autocomplete="tel" inputmode="tel" maxlength="60"></label>' +
              '<label class="dinq__field"><span class="dinq__label">Имейл</span><input class="dinq__input" name="email" type="email" autocomplete="email" maxlength="180"></label>' +
            '</div>' +
            '<label class="dinq__field"><span class="dinq__label">Вашето запитване</span>' +
              '<textarea class="dask" name="message" rows="3" maxlength="4000" required placeholder="Напишете въпроса си за този автомобил…"></textarea></label>' +
            '<label class="dinq__trap" aria-hidden="true">Website<input name="website" tabindex="-1" autocomplete="off"></label>' +
            '<div class="dinq__actions"><button class="btn-primary" type="submit">Изпрати</button></div>' +
            '<p class="dinq__status" role="status" aria-live="polite" aria-atomic="true"></p>' +
          '</form>' +
        '</div>' +
      '</section>' +

    "</div>" +
    "</div>" +

  "</div>";

  /* ---------- 4. the two phone bars ---------- */
  if (mini) mini.innerHTML =
    '<span class="dmini__t">' + AH.esc(v.model) + "</span>" +
    '<span class="dmini__p">' +
      (v.price == null ? "При запитване" : AH.price(v.price)) + "</span>";
  if (bar) bar.innerHTML =
    '<a class="btn-primary" href="#vehicle-inquiry">Запитване</a>' +
    '<a class="dbar__call" href="tel:' + CFG.expertPhone + '" aria-label="Обади се">' + PHONE + "</a>";

  /* the masthead's back arrow already exists; point it at this car's chapter */
  var headBack = D.querySelector(".nav .burger");
  if (headBack) {
    headBack.href = backHref;
    headBack.setAttribute("aria-label", "Обратно към " + backName);
  }

  // Gallery media is visible as soon as it decodes; catalog card fades do
  // not apply to this selectable image stage or its thumbnail controls.
  bindVehicleInquiry(D.getElementById("vehicle-inquiry-form"));
  /* Gallery selection is independent of layout: thumbnails, arrows and
     touch all update one main frame, with enlarged viewing on request. */
  var gal = D.getElementById("dgal");
  var fs = Array.prototype.slice.call(gal.querySelectorAll(".dgal__f"));
  var nEl = D.getElementById("dgal-n");
  var mainFrame = gal.querySelector('.dgal__main');
  var thumbs = Array.prototype.slice.call(D.querySelectorAll('.dthumb'));
  var thumbRail = D.getElementById('dthumbs');
  var selected = 0, selectionVersion = 0, suppressClick = false;
  var decoded = Object.create(null);
  function canWarmImages() {
    var connection = navigator.connection;
    return !connection || (!connection.saveData && !/^(slow-2g|2g|3g)$/.test(connection.effectiveType || '') &&
      !(connection.downlink > 0 && connection.downlink <= 1.5));
  }
  function prepare(i, priority, sizes) {
    if (!N) return Promise.resolve(null);
    priority = priority || 'low';
    if (priority === 'low' && !canWarmImages()) return Promise.resolve(null);
    i = (i + N) % N;
    sizes = sizes || mainSizes;
    var key = i + ':' + sizes;
    if (decoded[key]) {
      if (priority === 'high') decoded[key].image.fetchPriority = 'high';
      return decoded[key].promise;
    }
    var image = new Image();
    var entry = { image: image };
    decoded[key] = entry;
    entry.promise = new Promise(function (resolve) {
      var fallback = false;
      image.decoding = 'async';
      image.fetchPriority = priority;
      image.sizes = sizes;
      image.onload = function () {
        (image.decode ? image.decode().catch(function () {}) : Promise.resolve()).then(function () { resolve(image); });
      };
      image.onerror = function () {
        // An Image srcset has no <picture> type negotiation. Retry JPEG if
        // WebP is unsupported or that derivative is unavailable.
        if (!fallback) {
          fallback = true;
          image.srcset = AH.srcset(shots[i]);
          image.src = AH.img(shots[i], 800);
          return;
        }
        delete decoded[key];
        resolve(null);
      };
      image.srcset = AH.webpset(shots[i]);
      image.src = AH.img(shots[i], 800);
    });
    return entry.promise;
  }
  function loadedPicture(i, image, sizes) {
    // Keep the successfully decoded format, including JPEG fallback. Switching
    // back to a fresh <source> here would retry a failed WebP derivative.
    return '<picture><img decoding="async" fetchpriority="high" width="1600" height="900"' +
      ' src="' + AH.esc(image.currentSrc || image.src) + '" srcset="' + AH.esc(image.srcset || '') + '"' +
      ' sizes="' + AH.esc(sizes) + '" alt="' + AH.esc(v.full + ' / ' + (i + 1)) + '"></picture>';
  }
  function stripTo(i) {
    if (!mainFrame || !N) return;
    i = (i + N) % N;
    var changed = selected !== i;
    selected = i;
    mainFrame.dataset.i = String(i);
    mainFrame.href = shots[i];
    mainFrame.setAttribute('aria-label', v.full + ' / ' + (i + 1) + ' / ' + N);
    mainFrame.querySelector('.dgal__n').textContent = (i + 1) + ' / ' + N;
    if (nEl) nEl.textContent = (i + 1) + ' / ' + N;
    thumbs.forEach(function (thumb, index) {
      thumb.classList.toggle('is-active', index === i);
      thumb.setAttribute('aria-pressed', String(index === i));
    });
    if (!changed) return;
    var version = ++selectionVersion;
    // The already-loaded thumbnail gives immediate feedback while the full
    // responsive image decodes. The stage never changes its dimensions.
    var preview = thumbs[i] && thumbs[i].querySelector('img');
    if (preview && preview.complete && preview.naturalWidth) {
      mainFrame.querySelector('picture').innerHTML = '<img src="' + AH.esc(preview.currentSrc || preview.src) + '" alt="' + AH.esc(v.full) + '" width="1600" height="900">';
    }
    mainFrame.setAttribute('aria-busy', 'true');
    prepare(i, 'high').then(function (image) {
      if (version !== selectionVersion) return;
      if (image) mainFrame.querySelector('picture').outerHTML = loadedPicture(i, image, mainSizes);
      mainFrame.removeAttribute('aria-busy');
      if (image) prepare((i + 1) % N);
    });
  }
  thumbs.forEach(function (thumb, index) {
    thumb.addEventListener('click', function () { stripTo(index); });
    thumb.addEventListener('pointerenter', function () { prepare(index); }, { passive: true });
    thumb.addEventListener('focus', function () { prepare(index); });
    thumb.addEventListener('keydown', function (event) {
      var next = event.key === 'ArrowRight' ? index + 1 : event.key === 'ArrowLeft' ? index - 1 : event.key === 'Home' ? 0 : event.key === 'End' ? N - 1 : null;
      if (next === null) return;
      event.preventDefault();
      next = (next + N) % N;
      thumbs[next].focus({ preventScroll: true });
      stripTo(next);
    });
  });
  ['prev', 'next'].forEach(function (direction) {
    var control = D.getElementById('dgal-' + direction);
    if (control) control.addEventListener('click', function () { stripTo(selected + (direction === 'next' ? 1 : -1)); });
  });
  if (mainFrame && N > 1) {
    var swipeStart = null;
    mainFrame.addEventListener('pointerdown', function (event) {
      if (event.pointerType === 'mouse' || event.button > 0) return;
      swipeStart = { x: event.clientX, y: event.clientY };
      suppressClick = false;
    });
    mainFrame.addEventListener('pointerup', function (event) {
      if (!swipeStart) return;
      var dx = event.clientX - swipeStart.x, dy = event.clientY - swipeStart.y;
      swipeStart = null;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.3) {
        suppressClick = true;
        stripTo(selected + (dx < 0 ? 1 : -1));
      }
    });
    mainFrame.addEventListener('pointercancel', function () { swipeStart = null; });
    var warmNext = function () { prepare(1); };
    if ('requestIdleCallback' in window) requestIdleCallback(warmNext, { timeout: 1800 });
    else setTimeout(warmNext, 500);
  }


  function bindVehicleInquiry(form) {
    if (!form) return;
    var busy = false;
    function bilingual(el, bg, en) {
      el.setAttribute("data-ah-bg", bg);
      el.setAttribute("data-ah-en", en);
      el.textContent = window.AHLang && window.AHLang.get() === "en" ? en : bg;
    }
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      if (busy) return;
      var status = form.querySelector(".dinq__status");
      var button = form.querySelector("button[type=submit]");
      var fields = form.elements;
      var name = fields.name.value.trim(), phone = fields.phone.value.trim();
      var email = fields.email.value.trim(), message = fields.message.value.trim();
      status.className = "dinq__status";
      if (!form.reportValidity()) return;
      if (!name || !message || (!phone && !email)) {
        status.classList.add("is-error");
        bilingual(status, "Попълнете име, запитване и телефон или имейл.", "Enter your name, enquiry and a phone number or email.");
        (!name ? fields.name : !message ? fields.message : fields.phone).focus();
        return;
      }
      busy = true;
      button.disabled = true;
      form.setAttribute("aria-busy", "true");
      bilingual(button, "Изпращане…", "Sending…");
      bilingual(status, "", "");
      var controller = new AbortController();
      var timeout = setTimeout(function () { controller.abort(); }, 20000);
      fetch(CFG.endpoint, {
        method: "POST", credentials: "same-origin", signal: controller.signal,
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ kind: "vehicle", language: window.AHLang ? window.AHLang.get() : "bg",
          website: fields.website.value.trim(), page: location.href,
          vehicle: { id: v.id, ref: v.ref, name: v.full, price: v.price },
          contact: { name: name, phone: phone, email: email }, message: message })
      }).then(function (response) {
        if (!response.ok) throw new Error("HTTP " + response.status);
        return response.json();
      }).then(function (result) {
        if (!result || result.ok !== true) throw new Error("Delivery not confirmed");
        form.reset();
        status.classList.add("is-ok");
        bilingual(status, "Запитването е изпратено успешно.", "Your enquiry was sent successfully.");
      }).catch(function () {
        status.classList.add("is-error");
        bilingual(status, "Запитването не е изпратено. Текстът Ви е запазен тук. Опитайте отново или използвайте телефона или имейла по-горе.", "Your enquiry was not sent. Your text is still here. Try again or use the phone number or email above.");
      }).finally(function () {
        clearTimeout(timeout);
        busy = false;
        button.disabled = false;
        form.removeAttribute("aria-busy");
        bilingual(button, "Изпрати", "Send");
      });
    });
  }

  /* ---- THE EQUIPMENT, LOADED FOR THIS CAR ONLY ------------------------
     data/eq/<id>.js is the one heavy asset on this page — a median 4.3KB
     and 20KB at the worst — and all 83 of them together are 357KB, which
     is why they are 83 files and not one table. This injects exactly the
     one the reader is looking at.

     AFTER the render, not before: the section is below the fold at every
     width, so a late arrival shifts nothing above it, and a car whose file
     is missing (four have been sold and their listings are gone) simply
     renders without the section rather than with an empty one.

     The file states its own id and it is checked. Two dossiers in one
     session — click a related car, come back — would otherwise let a
     slow response paint one car's options onto another car's page. */
  (function loadEquipment() {
    var sec = D.getElementById("deq-sec");
    if (!sec) return;
    var activeData = v.db_id ? { e: v.equipment_bg || [], en: v.equipment_en || [] } : null;
    function renderEquipment() {
      if (!activeData) return;
      var useEnglish = window.AHLang && window.AHLang.get && window.AHLang.get() === "en";
      var lines = useEnglish && Array.isArray(activeData.en) &&
        activeData.en.length === activeData.e.length ? activeData.en : activeData.e;
      var built = equipHTML(lines);
      var list = D.getElementById("deq");
      var count = D.getElementById("deq-n");
      var clamp = D.getElementById("deq-clamp");
      var btn = D.getElementById("deq-more");
      if (!list || !clamp || !btn) return;
      list.innerHTML = built.html;
      list.classList.toggle('deq--simple', built.simple);
      if (count) count.textContent = built.n ? "· " + built.n : "";
      sec.hidden = !built.n;
      armClamp(clamp, btn);
    }
    addEventListener("load", renderEquipment);
    addEventListener("ah:languagechange", renderEquipment);
    if (v.db_id) {
      // Empty managed equipment is intentional; never revive a stale bundled list.
      renderEquipment();
      return;
    }
    // Equipment has its own content version, independent of other scripts.
    var versionMeta = D.querySelector('meta[name="ah-equipment-version"]');
    var ver = versionMeta ? versionMeta.content : '';
    var s = D.createElement("script");
    s.src = "data/eq/" + encodeURIComponent(v.id) + ".js" + (ver ? "?v=" + ver : "");
    s.async = true;
    s.onload = function () {
      var data = window.AH_EQ;
      if (!data || data.id !== v.id || !data.e || !data.e.length) return;
      activeData = data;
      renderEquipment();
    };
    /* a 404 is a real state here, not a failure to report: the car has been
       sold and its listing is gone. The section stays hidden. */
    s.onerror = function () {};
    D.head.appendChild(s);
    /* i18n boots after this renderer. The load listener catches the first
       English paint; subsequent language changes redraw from the static,
       reviewed local copy rather than relying on a visitor-side service. */
  })();

  /* ---- THE READ-MORE, WHICH IS THE ONE INTERACTION THAT STAYED ---------
     Same clamp, same two words, same behaviour as the prose block it used
     to open — it just has something worth opening now. An equipment list
     runs from 17 lines to 155, so the box shows the first screenful and
     the button says how to get the rest. If a car's list already fits, the
     button never appears rather than appearing and doing nothing. */
  function armClamp(clamp, btn) {
    var fits = function () {
      if (clamp.classList.contains("is-open")) return;
      var clipped = clamp.scrollHeight > clamp.clientHeight + 4;
      clamp.classList.toggle('is-clipped', clipped);
      btn.hidden = !clipped;
    };
    fits();
    if (btn.__ahClampBound) return;
    btn.__ahClampBound = true;
    addEventListener("load", fits);
    addEventListener("resize", fits);
    btn.addEventListener("click", function () {
      var open = clamp.classList.toggle("is-open");
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      var en = window.AHLang && window.AHLang.get() === 'en';
      btn.textContent = open ? (en ? 'Show less' : 'Скрий') : (en ? 'Read more' : 'Прочети още');
      if (!open) {
        var top = clamp.getBoundingClientRect().top + window.scrollY - 120;
        if (window.scrollY > top) window.scrollTo({ top: top, behavior: "smooth" });
      }
    });
  }

  /* ============================================================
     LIGHTBOX — the existing one, kept: focus returns to the frame that
     opened it, arrows and Escape work, focus is trapped, and the strip
     follows whatever was last magnified.
     ============================================================ */
  var lb = D.getElementById("lb"), lbImg = D.getElementById("lb-img");
  var lbStage = D.getElementById("lb-stage"), lbCount = D.getElementById("lb-count");
  var shot = 0, opener = null, lockY = 0, lightboxVersion = 0;
  var lightboxSizes = '88vw';
  function fitLightboxMargins() {
    var box = lbImg.getBoundingClientRect();
    lbImg.style.clipPath = window.AH_PHOTO_INSETS && lbImg.complete
      ? window.AH_PHOTO_INSETS.clip(lbImg.currentSrc || lbImg.src, lbImg.naturalWidth, lbImg.naturalHeight, box.width, box.height, location.origin) : "";
  }
  lbImg.addEventListener("load", fitLightboxMargins);
  lbImg.addEventListener("error", function () { lbImg.style.clipPath = ""; });
  if (window.ResizeObserver) new ResizeObserver(fitLightboxMargins).observe(lbImg);
  else window.addEventListener("resize", fitLightboxMargins);
  var lightboxResizePending = false;
  window.addEventListener('resize', function () {
    if (lightboxResizePending || !lb.classList.contains('open')) return;
    lightboxResizePending = true;
    requestAnimationFrame(function () {
      lightboxResizePending = false;
      if (lb.classList.contains('open')) open(shot);
    });
  });

  /* `body.style.overflow = "hidden"` looked like a scroll lock and was in fact
     a scroll RESET. When <html> is `overflow:visible` the BODY's overflow is
     what propagates to the viewport, so setting it to hidden made the viewport
     non-scrollable, which clamps the offset to 0 — measured: open the lightbox
     700px down the dossier, close it, and you are back at the top of the page.
     Pin the body at its current offset instead and put it back afterwards,
     which is what the card wall and the showroom layer already do. */
  function lockPage(on) {
    var html = D.documentElement;
    if (on) {
      lockY = window.scrollY || window.pageYOffset || 0;
      D.body.style.top = (-lockY) + "px";
      html.classList.add("lb-open");
    } else {
      html.classList.remove("lb-open");
      D.body.style.top = "";
      window.scrollTo({ top: lockY, left: 0, behavior: "instant" });
    }
  }

  function open(n, from) {
    var first = !lb.classList.contains("open");
    if (!N) return;
    var previous = shot;
    shot = (n + N) % N;
    if (from) opener = from;
    var version = ++lightboxVersion;
    // Start with an already visible frame/thumbnail. Keep it on screen until
    // the responsive enlargement decodes, then swap only the latest request.
    var frame = fs.filter(function (item) { return Number(item.dataset.i) === shot; })[0];
    var preview = frame && frame.querySelector('img');
    if (!preview || !preview.complete || !preview.naturalWidth) preview = thumbs[shot] && thumbs[shot].querySelector('img');
    if ((first || previous !== shot) && preview && preview.complete && preview.naturalWidth) {
      lbImg.style.clipPath = '';
      lbImg.removeAttribute('srcset');
      lbImg.src = preview.currentSrc || preview.src;
      fitLightboxMargins();
    }
    lbImg.alt = v.model + " — кадър " + (shot + 1);
    if (lbCount) lbCount.textContent = (shot + 1) + " / " + N;
    lb.classList.add("open");
    if (first) lockPage(true);                  /* stepping frames must not re-pin */
    if (first) D.getElementById("lb-close").focus();
    lbStage.setAttribute('aria-busy', 'true');
    var sizes = lbStage.clientWidth ? Math.ceil(lbStage.clientWidth) + 'px' : lightboxSizes;
    prepare(shot, 'high', sizes).then(function (image) {
      if (version !== lightboxVersion || !lb.classList.contains('open')) return;
      if (image) {
        lbImg.style.clipPath = '';
        // The preloader chose/decoded the responsive candidate already.
        // Assign only that URL here: srcset density-corrects naturalWidth,
        // whereas the verified matte boundaries require original pixel sizes.
        lbImg.removeAttribute('srcset');
        lbImg.src = image.currentSrc || image.src;
        fitLightboxMargins();
      }
      lbStage.removeAttribute('aria-busy');
    });
  }
  function close() {
    lightboxVersion++;
    lbStage.removeAttribute('aria-busy');
    lb.classList.remove("open");
    lockPage(false);
    stripTo(shot);                              /* the strip follows the lightbox */
    if (opener) { opener.focus({ preventScroll: true }); opener = null; }
  }
  fs.forEach(function (f) {
    f.addEventListener("click", function (e) {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button > 0) return;  /* let a new tab open */
      e.preventDefault();
      if (suppressClick) { suppressClick = false; return; }
      open(parseInt(f.getAttribute("data-i"), 10) || 0, f);
    });
  });
  D.getElementById("lb-close").addEventListener("click", close);
  D.getElementById("lb-prev").addEventListener("click", function () { open(shot - 1); });
  D.getElementById("lb-next").addEventListener("click", function () { open(shot + 1); });
  lb.addEventListener("click", function (e) { if (e.target === lb) close(); });

  /* ---- swipe on a phone, click-drag with a mouse ----
     The same gesture the hero uses, scoped to the lit picture: the image
     follows the pointer, and a move past a short threshold steps a frame
     while anything less snaps back. Armed only when there is a frame to step
     to, and it releases the axis to the page the moment a drag reads vertical
     so a two-finger scroll is never stolen. */
  if (N > 1 && lbStage) {
    lbStage.classList.add("is-swipe");
    var gOn = false, gx0 = 0, gy0 = 0, gdx = 0, gAxis = 0;
    lbStage.addEventListener("pointerdown", function (e) {
      if (e.button > 0) return;
      gOn = true; gx0 = e.clientX; gy0 = e.clientY; gdx = 0; gAxis = 0;
      lbStage.classList.add("is-grabbing");
      try { lbStage.setPointerCapture(e.pointerId); } catch (_) {}
    });
    lbStage.addEventListener("pointermove", function (e) {
      if (!gOn) return;
      var dx = e.clientX - gx0, dy = e.clientY - gy0;
      if (!gAxis) {
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
        gAxis = Math.abs(dx) >= Math.abs(dy) ? 1 : 2;
        if (gAxis === 2) { gOn = false; lbStage.classList.remove("is-grabbing"); return; }
      }
      gdx = dx;
      e.preventDefault();
      lbImg.style.transform = "translateX(" + dx + "px)";
    });
    var endGesture = function (e) {
      if (!gOn) return;
      gOn = false;
      lbStage.classList.remove("is-grabbing");
      try { lbStage.releasePointerCapture(e.pointerId); } catch (_) {}
      lbImg.style.transform = "";
      var threshold = Math.min(120, lbStage.clientWidth * 0.15);
      if (gAxis === 1 && Math.abs(gdx) > threshold) open(shot + (gdx < 0 ? 1 : -1));
    };
    lbStage.addEventListener("pointerup", endGesture);
    lbStage.addEventListener("pointercancel", endGesture);
  }

  D.addEventListener("keydown", function (e) {
    if (lb.classList.contains("open")) {
      if (e.key === "Escape") return close();
      if (e.key === "ArrowRight") return open(shot + 1);
      if (e.key === "ArrowLeft") return open(shot - 1);
      if (e.key === "Tab") {
        var f = lb.querySelectorAll("button");
        if (!f.length) return;
        var a = f[0], z = f[f.length - 1];
        if (e.shiftKey && D.activeElement === a) { e.preventDefault(); z.focus(); }
        else if (!e.shiftKey && D.activeElement === z) { e.preventDefault(); a.focus(); }
      }
      return;
    }
    /* Gallery keys apply only while focus is inside the gallery. */
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    if (e.defaultPrevented || !gal.contains(D.activeElement)) return;
    e.preventDefault();
    stripTo(selected + (e.key === "ArrowRight" ? 1 : -1));
  });

  /* ============================================================
     THE PHONE BARS
     .dmini and .dbar appear together, once the gallery has left the top of
     the screen, and .dbar retracts when the footer arrives so it never
     covers the legal text or the last button.
     ============================================================ */
  if (mini || bar) {
    /* BOTH TESTS ARE OBSERVERS NOW.
       This frame used to do three expensive things per scrolled tick, on
       the page a phone spends the longest on: a rect for the gallery, a
       rect for the footer, and — worst of the three — a getComputedStyle()
       on <body> to re-read a padding that only changes at a breakpoint.
       A resolved style is not cached across frames; asking for one forces
       the engine to flush pending style work every time.

       Both questions are "is this element near the viewport", which is an
       IntersectionObserver's entire job, answered off the main thread. The
       scroll handler is gone with them: the two observers drive the state
       directly, so scrolling the dossier now costs nothing at all until
       one of the two boundaries is actually crossed. */
    var foot = D.querySelector(".ft");
    var galPast = false, footerUp = false;
    var apply = function () {
      if (mini) mini.classList.toggle("show", galPast && !footerUp);
      if (bar) bar.classList.toggle("show", galPast && !footerUp);
    };
    if ("IntersectionObserver" in window) {
      /* the masthead's own height is the top inset; it is a token, so it
         is read once here rather than per frame */
      var navH = parseFloat(getComputedStyle(D.body).paddingTop) || 64;
      new IntersectionObserver(function (e) {
        galPast = !e[0].isIntersecting && e[0].boundingClientRect.top < 0;
        apply();
      }, { rootMargin: (-(navH + 8)) + "px 0px 0px 0px", threshold: 0 }).observe(gal);
      if (foot) new IntersectionObserver(function (e) {
        footerUp = e[0].isIntersecting;
        apply();
      }, { rootMargin: "0px 0px -40px 0px" }).observe(foot);
    } else {
      var qs = false;
      var onScroll = function () {
        qs = false;
        var navH2 = parseFloat(getComputedStyle(D.body).paddingTop) || 64;
        galPast = gal.getBoundingClientRect().bottom < navH2 + 8;
        footerUp = foot ? foot.getBoundingClientRect().top < innerHeight - 40 : false;
        apply();
      };
      addEventListener("scroll", function () {
        if (qs) return;
        qs = true; requestAnimationFrame(onScroll);
      }, { passive: true });
      addEventListener("resize", onScroll);
      onScroll();
    }
  }

  /* ---- reveal, with the rescue for a document that renders hidden ---- */
  var rvs = Array.prototype.slice.call(D.querySelectorAll(".rv"));
  if (!rvs.length) return;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) {
    rvs.forEach(function (e) { e.classList.add("in"); });
  } else {
    var io = new IntersectionObserver(function (en) {
      en.forEach(function (x) {
        if (x.isIntersecting) { x.target.classList.add("in"); io.unobserve(x.target); }
      });
    }, { threshold: 0.1, rootMargin: "0px 0px -8% 0px" });
    rvs.forEach(function (e) { io.observe(e); });
    var rescue = function () {
      rvs.forEach(function (e) {
        if (e.classList.contains("in")) return;
        var r = e.getBoundingClientRect();
        if (r.top < innerHeight && r.bottom > 0) { e.classList.add("in"); io.unobserve(e); }
      });
    };
    setTimeout(rescue, 2500);
    if (D.hidden) D.addEventListener("visibilitychange", function once() {
      if (D.hidden) return;
      D.removeEventListener("visibilitychange", once);
      setTimeout(rescue, 60);
    });
  }
})();

});
