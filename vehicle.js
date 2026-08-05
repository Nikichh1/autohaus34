/* ============================================================
   AUTOHAUS — the vehicle dossier, rebuilt on the JamesEdition structure
   (SPEC-JAMESEDITION.md §4, measured 2026-07-30)

   One file serves all 87 cars (vehicle.html?id=slug). The surface is the
   v34 light "paper" page, which is what their own detail page is too.

   Their order, kept exactly, because it answers the questions in the order
   a buyer asks them:

     gallery  ->  title + price  ->  spec strip  ->  prose  ->  table
              ->  why this one   ->  ask         ->  guarantees
     then, at full content width, more from the collection.

   Contact is duplicated the way theirs is: a sticky rail on a desktop, a
   fixed bar on a phone. The rail is never the phone's contact path — it
   falls to the bottom of the stack there and .dbar carries the ask.

   Nothing here is invented about a car. Every claim in the prose and in
   "Защо този" is derived from that car's own record; where the data cannot
   support a claim (VAT status, invoice, owner count) the row is omitted
   rather than guessed.
   ============================================================ */
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
    D.title = "Автомобилът не е намерен — AutoHaus";
    root.innerHTML =
      '<div class="vd-body" style="padding-top:24px">' +
        '<section class="dsec">' +
          '<h1 class="h4" style="color:var(--ink);margin-bottom:16px">' +
            "Този автомобил вече не е в колекцията.</h1>" +
          '<div class="dprose" style="max-width:62ch">' +
            "<p>Продадените се свалят в деня на продажбата. Ако сте го харесали, " +
              "вероятно можем да намерим същия — или по-добър.</p></div>" +
          '<div class="btn-group" style="margin-top:32px">' +
            '<a class="btn-primary" href="index.html#avtomobili">Виж колекцията</a>' +
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
  D.title = v.full + " · " + priceLabel + " — AutoHaus Пловдив";
  var md = D.querySelector('meta[name="description"]');
  if (md) md.setAttribute("content",
    v.full + ", " + (v.unreg ? "нерегистриран" : v.year + " г.") + ", " + AH.km(v.km) + ", " +
    v.hp + " к.с. Проверен автомобил в наличност в AutoHaus Пловдив.");

  function prettyPhone(p) {
    var m = String(p).match(/^\+359(\d{3})(\d{3})(\d{3})$/);
    return m ? "+359 " + m[1] + " " + m[2] + " " + m[3] : p;
  }
  function initials(name) {
    return String(name).split(/\s+/).map(function (w) { return w.charAt(0); })
      .join("").slice(0, 2).toUpperCase();
  }
  function frames(n) { return n === 1 ? "кадър" : "кадъра"; }

  var shots = v.shots || [];
  var N = shots.length;
  var chapterName = AH.chapterName[v.chapter] || "";
  var backHref = "index.html#avtomobili" + (v.chapter ? "?chapter=" + v.chapter : "");
  var backName = (chapterName || "колекцията").toLowerCase();

  var CHECK = '<svg viewBox="0 0 16 16" aria-hidden="true"><use href="#ic-check"/></svg>';
  var PHONE = '<svg viewBox="0 0 16 16" aria-hidden="true"><use href="#ic-phone"/></svg>';
  var DOC   = '<svg viewBox="0 0 16 16" aria-hidden="true"><use href="#ic-doc"/></svg>';
  var ENV   = '<svg viewBox="0 0 16 16" aria-hidden="true">' +
              '<rect x="1" y="3" width="14" height="10"/><path d="M1,4 L8,9 L15,4"/></svg>';
  /* three nodes and two links — the one icon the sprite does not carry */
  var SHARE = '<svg viewBox="0 0 16 16" aria-hidden="true">' +
              '<circle cx="12" cy="3.4" r="2"/><circle cx="4" cy="8" r="2"/>' +
              '<circle cx="12" cy="12.6" r="2"/>' +
              '<path d="M10.2,4.5 L5.8,6.9 M5.8,9.1 L10.2,11.5"/></svg>';
  /* four panes — the contact sheet the "see all frames" box opens */
  var GRID_IC = '<svg viewBox="0 0 16 16" aria-hidden="true">' +
                '<rect x="1" y="1" width="6" height="6"/><rect x="9" y="1" width="6" height="6"/>' +
                '<rect x="1" y="9" width="6" height="6"/><rect x="9" y="9" width="6" height="6"/></svg>';

  /* ============================================================
     WHAT THIS PAGE IS ALLOWED TO SAY

     Everything on it is either in data/vehicles.js — verified line by line
     against the live listings on 2026-08-05, where all 83 still-published
     cars agreed on make, model, registration, engine, power, transmission,
     mileage and colour — or in data/eq/<id>.js, which is that listing's own
     equipment list, verbatim.

     WHAT WAS HERE AND IS NOT ANY MORE, because AutoHaus does not say it:

       · "Преминал е през същия път като всеки автомобил в колекцията:
          проверка на произход и сервизна история, механична подготовка в
          собствен сервиз, пълен Auto Spa детайлинг и лично одобрение от …,
          преди да бъде показан." A four-step standard, asserted for all 87.
       · "Документите — справка за произход, сервизни книжки и фактури — са
          на разположение при огледа." A promise about paperwork.
       · A "Гаранции и оглед" block of four: viewings every weekday 09:00 to
          18:00 without an appointment, a test drive by arrangement, a
          48-hour hold after a deposit, a firm part-exchange offer the same
          day. Four commitments, none of them made by the company.
       · "Защо този" — up to four editorial verdicts per car, generated from
          the record: "Мощност, която оправдава подготовката", "Възраст, в
          която състоянието е единственото, което тежи", "Рядкост в този
          клас". A dealer may write that about a car; a template may not
          write it about eighty-seven.
       · "Пълна сервизна история" as a filler whenever fewer than three of
          those verdicts fired. True of 60 of the 83 listings — and printed
          now for exactly those 60, because it is one of their own notes.
       · A monthly leasing figure per car, on the rail and again in the
          prose, computed from a rate nobody has confirmed. The listings say
          "Възможен лизинг!" and nothing more, so that is what this says.
       · "Обявената цена е крайна" and the rail's "Крайна цена" — the
          opposite of what the listing says. See THE PRICE below.
       · An answer "до 24 часа в работни дни", and an expert who "одобри
          лично този автомобил".
       · "реф. AH-018" on the identity line. That reference is this site's,
          generated when the inventory was scraped; it is not printed on any
          AutoHaus listing. It still travels with an enquiry — where it is
          labelled as the enquiry's reference, which is what it is — but it
          is no longer shown as though it were the car's catalogue number.

     THE PRICE. AutoHaus publishes a euro figure and, on 25 of the 83 cars,
     the line "Цена без начислен 20% ДДС!" — the price does not include 20%
     VAT. The old page printed "Крайна цена" on every car, which is wrong
     twice: wrong for those 25 because the VAT is still to come, and wrong
     for the other 58 because it asserts something their listing never said.
     The note is carried per car now, in the listing's own words.

     THE DUPLICATION. Year, mileage, power, engine, transmission and colour
     used to appear three times each — in a scrolling spec strip, again in a
     "Детайли" table underneath it, and a third time as the opening sentence
     of the prose. There is one specification block now, holding exactly the
     eight rows the listing holds.
     ============================================================ */

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
  var regTxt = v.unreg ? "Без първа регистрация"
    : (v.year ? ((v.month ? MONTHS[v.month] + " " : "") + v.year + " г.") : "—");

  function specRows() {
    return [["Марка и модел", v.full],
            ["Регистрация", regTxt],
            ["Тип двигател", AH.fuel[v.fuel] || "—"],
            ["Мощност", v.hp ? v.hp + " к.с." : "—"],
            ["Трансмисия", v.gear === "manual" ? "Ръчна" : "Автоматична"],
            ["Пробег", v.km == null ? "—" : AH.fmt(v.km) + " км"],
            ["Цвят", v.colour || "—"],
            ["Цена", v.price == null ? "При запитване" : AH.fmt(v.price) + " евро"]];
  }

  /* ---- the equipment list ----
     Two shapes in the source, both kept: "<code> – <text>" is an option
     carrying the maker's own code, and a line opening with "-" is a
     sub-point of the option above it. Nothing is reordered or reworded. */
  function equipHTML(lines) {
    var html = "", open = false, n = 0;
    for (var i = 0; i < lines.length; i++) {
      var t = String(lines[i]);
      if (/^[-–—]\s*/.test(t)) {
        if (!open) { html += '<ul class="deq-sub">'; open = true; }
        html += "<li>" + AH.esc(t.replace(/^[-–—]\s*/, "")) + "</li>";
        continue;
      }
      if (open) { html += "</ul>"; open = false; }
      var m = t.match(/^([0-9A-Za-zА-Яа-я]{1,5})\s*[–—]\s*(.+)$/);
      n++;
      html += '<li class="deq-i">' + (m
        ? '<span class="deq-c">' + AH.esc(m[1]) + "</span><span>" + AH.esc(m[2]) + "</span>"
        : '<span class="deq-c" aria-hidden="true"></span><span>' + AH.esc(t) + "</span>") + "</li>";
    }
    if (open) html += "</ul>";
    return { html: html, n: n };
  }

  var related = AH.all.filter(function (o) {
    return o.id !== v.id && (o.chapter === v.chapter || o.make === v.make);
  }).slice(0, 4);

  /* ============================================================
     RENDER
     ============================================================ */
  root.innerHTML = '' +
  '<div class="vd-body" style="padding-top:24px">' +

    /* ---------- 1. GALLERY ---------- */
    '<section aria-label="Галерия">' +
      '<div class="dgal-wrap" id="dgal-wrap">' +
      '<div class="dgal" id="dgal">' +
        shots.map(function (s, i) {
          return '<a class="dgal__f ' + (i === 0 ? "dgal__main" : "dgal__side") + '"' +
            ' href="' + AH.esc(s) + '" data-i="' + i + '"' +
            ' aria-label="Кадър ' + (i + 1) + " от " + N + ' — уголеми">' +
            AH.picture(s, { eager: i === 0, width: 800, height: 490,
                            sizes: "(min-width:1024px) 46vw, 100vw", src: 800,
                            alt: v.full + " — кадър " + (i + 1) }) +
            '<span class="dgal__n">' + (i + 1) + " / " + N + "</span></a>";
        }).join("") +
      "</div>" +
      /* THE WAY INTO THE REST OF THE SET.
         The mosaic shows three frames of however many there are, and the line
         underneath announced the total — "1 / 24 кадъра" — without offering
         any way to reach it. The only route to frames 4..24 was to magnify
         one and step through the lightbox, which is a viewer, not an index.
         This is the index: one box, and every frame lands on the page. */
      (N > 3 ?
        '<button type="button" class="dgal__all" id="dgal-all" aria-expanded="false" aria-controls="dgal">' +
          GRID_IC + '<span id="dgal-all-l">Виж всички ' + N + " " + frames(N) + "</span></button>"
        : "") +
      "</div>" +
      '<div class="dgal-bar">' +
        '<div class="dgal-bar__l">' +
          '<button type="button" id="dgal-share">' + SHARE + "<span>Сподели</span></button>" +
          '<button type="button" id="dgal-print" aria-label="Запази досието като PDF">' +
            DOC + "<span>Запази</span></button>" +
        "</div>" +
        '<span class="dgal-bar__n" id="dgal-n">1 / ' + N + " " + frames(N) + "</span>" +
      "</div>" +
    "</section>" +

    /* ---------- 2. BODY: content column + rail ---------- */
    '<div class="dbody">' +
    '<div style="min-width:0">' +

      /* a) title / price */
      '<section class="dsec">' +
        '<div class="dtitle">' +
          "<h1>" + AH.esc(v.model) + "</h1>" +
          '<div class="dtitle__pw">' +
            '<p class="dtitle__price">' +
              (v.price == null ? "Цена при запитване" : AH.fmt(v.price) + " €") + "</p>" +
            (vatNote ? '<p class="dtitle__vat">' + AH.esc(vatNote) + "</p>" : "") +
          "</div>" +
        "</div>" +
        '<p class="dtitle__place">AutoHaus · Пловдив</p>' +
      "</section>" +

      /* b) THE SPECIFICATION — one block, the eight rows the listing has.
         It was a scrolling strip of six, a table of ten underneath it and a
         sentence restating all six a third time. */
      '<section class="dsec">' +
        '<h2 class="dsec__h">Спецификация</h2>' +
        '<dl class="dspec">' +
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
        '<div class="dclamp" id="deq-clamp"><ul class="deq" id="deq"></ul></div>' +
        '<button type="button" class="dmore" id="deq-more" aria-expanded="false" aria-controls="deq-clamp" hidden>' +
          "Прочети още</button>" +
      "</section>" +

      /* d) ask — the enquiry. The form is real and stays; what went is the
         claim that the expert personally approved this car and the promise
         of an answer within 24 working hours. */
      '<section class="dsec">' +
        '<h2 class="dsec__h">Въпрос към AutoHaus</h2>' +
        '<div class="dseller">' +
          '<span class="dseller__av" aria-hidden="true" style="font-size:18px;font-weight:600">' +
            initials(CFG.expert) + "</span>" +
          "<div>" +
            '<p class="dseller__n">' + AH.esc(CFG.expert) + "</p>" +
            '<p class="dseller__m">AutoHaus Пловдив</p>' +
          "</div>" +
          '<div class="dseller__acts">' +
            '<a href="tel:' + CFG.expertPhone + '">' + PHONE +
              prettyPhone(CFG.expertPhone) + "</a>" +
            '<a href="' + AH.conciergeUrl({ v: v.id }) + '">' + ENV + "Пълно запитване</a>" +
          "</div>" +
        "</div>" +
        /* a GET form: with JS blocked it still lands in the concierge with
           the question attached. There is no POST endpoint to invent. */
        '<form method="get" action="concierge.html" style="margin-top:24px">' +
          '<input type="hidden" name="v" value="' + AH.esc(v.id) + '">' +
          '<label for="dask" class="dseller__m" style="display:block;margin-bottom:8px">' +
            "Кратък въпрос за този автомобил</label>" +
          '<textarea id="dask" name="q" rows="3" class="dask"' +
            ' placeholder="Например: свободен ли е за оглед в събота?"></textarea>' +
          '<button class="btn-primary" type="submit" style="margin-top:16px">Продължи</button>' +
          '<p class="body-s" style="margin-top:12px;color:var(--ink-3)">Въпросът се добавя към ' +
            "заявката и стига до " + AH.esc(CFG.expert) + ".</p>" +
        "</form>" +
      "</section>" +

    "</div>" +

    /* the rail — sticky on a desktop, last in the stack on a phone */
    '<aside class="drail" aria-label="Цена и запитване">' +
      '<p class="drail__pk">' + (v.price == null ? "Цена" : "Цена") + "</p>" +
      '<p class="drail__price">' +
        (v.price == null ? "При запитване" : AH.fmt(v.price) + " €") + "</p>" +
      (vatNote
        ? '<p class="drail__vat">' + AH.esc(vatNote) + "</p>"
        : (v.price == null
            ? '<p class="drail__lease">Цената на този автомобил се съобщава при запитване.</p>'
            : "")) +
      '<a class="btn-primary" href="' + AH.conciergeUrl({ v: v.id }) + '">Запитване</a>' +
      '<a class="btn-ghost" href="' + AH.conciergeUrl({ v: v.id, visit: 1 }) + '">Запази оглед</a>' +
      '<p class="drail__fn">Заявката стига до ' + AH.esc(CFG.expert) +
        '. За въпроси по телефона: <a href="tel:' +
        CFG.salonPhone + '">' + prettyPhone(CFG.salonPhone) + "</a>.</p>" +
    "</aside>" +
    "</div>" +

    /* ---------- 3. more from the collection, at full content width ---------- */
    (related.length
      ? '<section class="dsec dmore-sec rv">' +
          '<h2 class="h4" style="color:var(--ink);margin-bottom:8px">Други от колекцията</h2>' +
          '<p class="body-s" style="color:var(--ink-3);max-width:62ch;margin-bottom:24px">' +
            "Автомобили от същия раздел или от същата марка, в наличност сега.</p>" +
          '<div class="cgrid" id="dmore-grid">' +
            related.map(function (o) { return AH.card(o, { paper: true }); }).join("") +
          "</div>" +
          '<div class="btn-group" style="margin-top:32px">' +
            '<a class="btn-primary" href="' + backHref + '">Цялата колекция</a>' +
            '<a class="btn-ghost" href="' +
              AH.conciergeUrl({ intent: "source", make: v.make }) + '">Търся друг</a>' +
          "</div>" +
        "</section>"
      : "") +

  "</div>";

  /* ---------- 4. the two phone bars ---------- */
  if (mini) mini.innerHTML =
    '<span class="dmini__t">' + AH.esc(v.model) + "</span>" +
    '<span class="dmini__p">' +
      (v.price == null ? "При запитване" : AH.price(v.price)) + "</span>";
  if (bar) bar.innerHTML =
    '<a class="btn-primary" href="' + AH.conciergeUrl({ v: v.id }) + '">Запитване</a>' +
    '<a class="dbar__call" href="tel:' + CFG.salonPhone + '" aria-label="Обади се">' + PHONE + "</a>";

  /* the masthead's back arrow already exists; point it at this car's chapter */
  var headBack = D.querySelector(".nav .burger");
  if (headBack) {
    headBack.href = backHref;
    headBack.setAttribute("aria-label", "Обратно към " + backName);
  }

  AH.rendered(root);
  var grid = D.getElementById("dmore-grid");
  /* .cgrid's one-column track is `1fr`, i.e. minmax(auto,1fr), so below 600px
     the track cannot shrink under the card's min-content and the page gains
     48px of horizontal scroll. minmax(0,1fr) belongs in catalog.css (see the
     CSS GAP in the report); until it lands, the item's own min-width does the
     same job and is a no-op at every wider breakpoint. */
  if (grid) Array.prototype.slice.call(grid.querySelectorAll(".lc")).forEach(function (c) {
    c.style.minWidth = "0";
  });

  /* ============================================================
     GALLERY

     One element, three behaviours: a 2x2 mosaic above 1024, a full-bleed snap
     strip below it, and — either side of that line — a contact sheet holding
     every frame, opened by the box in the corner. Every shot is in the DOM so
     the strip is complete; in the mosaic everything past the third frame is
     [hidden], which the global !important rule can actually win against
     .dgal__f.
     ============================================================ */
  var gal = D.getElementById("dgal");
  var fs = Array.prototype.slice.call(gal.querySelectorAll(".dgal__f"));
  var nEl = D.getElementById("dgal-n");
  var wide = matchMedia("(min-width:1024px)");
  /* the contact-sheet state: every frame on the page at once. It overrides
     both of the two layouts below, so every branch has to consult it. */
  var wrap = D.getElementById("dgal-wrap");
  var allBtn = D.getElementById("dgal-all");
  var allLbl = D.getElementById("dgal-all-l");
  var showAll = false;

  function syncFrames() {
    var hide = wide.matches && !showAll;
    fs.forEach(function (f, i) {
      if (i < 3) return;
      if (hide) f.setAttribute("hidden", "");
      else f.removeAttribute("hidden");
    });
    syncCount();
  }
  if (allBtn) allBtn.addEventListener("click", function () {
    showAll = !showAll;
    wrap.classList.toggle("is-all", showAll);
    allBtn.setAttribute("aria-expanded", showAll ? "true" : "false");
    if (allLbl) allLbl.textContent = showAll
      ? "Покажи по-малко" : ("Виж всички " + N + " " + frames(N));
    syncFrames();
    /* Collapsing takes ~2000px out of the document in one frame. Without
       this the reader is left staring at the spec table with no idea the
       gallery closed above them. */
    if (!showAll) {
      gal.scrollLeft = 0;
      if (wrap.getBoundingClientRect().top < 0) {
        wrap.scrollIntoView({ block: "start", behavior: "smooth" });
      }
    }
  });

  /* the strip IS the state: the counter is read back from scrollLeft, so a
     swipe, a keyboard arrow and a lightbox close can never disagree */
  function current() {
    if (gal.scrollWidth - gal.clientWidth < 8) return 0;
    return Math.max(0, Math.min(N - 1, Math.round(gal.scrollLeft / Math.max(1, gal.clientWidth))));
  }
  function syncCount() {
    if (!nEl) return;
    /* laid out as a sheet there is no "current" frame — only a total */
    if (showAll) { nEl.textContent = N + " " + frames(N); return; }
    if (wide.matches) { nEl.textContent = "1 / " + N + " " + frames(N); return; }
    nEl.textContent = (current() + 1) + " / " + N + " " + frames(N);
  }
  syncFrames();
  if (wide.addEventListener) wide.addEventListener("change", syncFrames);
  else if (wide.addListener) wide.addListener(syncFrames);
  var queued = false;
  gal.addEventListener("scroll", function () {
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () { queued = false; syncCount(); });
  }, { passive: true });
  addEventListener("resize", function () { syncFrames(); syncCount(); });

  function stripTo(i, smooth) {
    if (gal.scrollWidth - gal.clientWidth < 8) return;
    var f = fs[i];
    if (!f) return;
    var left = gal.scrollLeft + (f.getBoundingClientRect().left - gal.getBoundingClientRect().left);
    if (smooth && gal.scrollTo) gal.scrollTo({ left: left, behavior: "smooth" });
    else gal.scrollLeft = left;
    syncCount();
  }

  /* ---- gallery bar actions ---- */
  function flash(btn, text) {
    var lbl = btn.querySelector("span");
    if (!lbl) return;
    if (!lbl.getAttribute("data-was")) lbl.setAttribute("data-was", lbl.textContent);
    lbl.textContent = text;
    setTimeout(function () { lbl.textContent = lbl.getAttribute("data-was"); }, 2400);
  }
  var shareBtn = D.getElementById("dgal-share");
  if (shareBtn) shareBtn.addEventListener("click", function () {
    var url = location.href;
    if (navigator.share) {
      try {
        var r = navigator.share({ title: v.full, text: v.full, url: url });
        if (r && r.then) r.then(null, function () {});
        return;
      } catch (e) { /* fall through to the clipboard */ }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(
        function () { flash(shareBtn, "Копиран линк"); },
        function () { flash(shareBtn, "Копирайте адреса"); });
      return;
    }
    flash(shareBtn, "Копирайте адреса");
  });
  var printBtn = D.getElementById("dgal-print");
  if (printBtn) printBtn.addEventListener("click", function () { window.print(); });

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
    /* THE VERSION HAS TO TRAVEL WITH IT.
       _headers caches every .js on this site `immutable` for a year, which
       is correct only because build.js stamps ?v=<hash> onto every URL it
       writes into the HTML. This URL is built at runtime, so it is not one
       of those — and without the stamp a re-scraped equipment list would
       never reach anybody who had already opened that car. The page's own
       scripts carry the current hash; this borrows it. build.js hashes
       data/eq/ too, so re-scraping moves it. */
    var ver = (function () {
      var tags = D.getElementsByTagName("script");
      for (var i = 0; i < tags.length; i++) {
        var m = (tags[i].src || "").match(/[?&]v=([\w]+)/);
        if (m) return m[1];
      }
      return "";
    })();
    var s = D.createElement("script");
    s.src = "data/eq/" + encodeURIComponent(v.id) + ".js" + (ver ? "?v=" + ver : "");
    s.async = true;
    s.onload = function () {
      var data = window.AH_EQ;
      if (!data || data.id !== v.id || !data.e || !data.e.length) return;
      var built = equipHTML(data.e);
      var list = D.getElementById("deq");
      var count = D.getElementById("deq-n");
      var clamp = D.getElementById("deq-clamp");
      var btn = D.getElementById("deq-more");
      if (!list || !clamp || !btn) return;
      list.innerHTML = built.html;
      if (count) count.textContent = built.n ? "· " + built.n : "";
      sec.removeAttribute("hidden");
      armClamp(clamp, btn);
    };
    /* a 404 is a real state here, not a failure to report: the car has been
       sold and its listing is gone. The section stays hidden. */
    s.onerror = function () {};
    D.head.appendChild(s);
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
      if (clamp.scrollHeight <= clamp.clientHeight + 4) btn.setAttribute("hidden", "");
      else btn.removeAttribute("hidden");
    };
    fits();
    addEventListener("load", fits);
    addEventListener("resize", fits);
    btn.addEventListener("click", function () {
      var open = clamp.classList.toggle("is-open");
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      btn.textContent = open ? "Скрий" : "Прочети още";
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
  var shot = 0, opener = null, lockY = 0;

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
    shot = (n + N) % N;
    if (from) opener = from;
    lbImg.src = shots[shot];                    /* the original, only here */
    lbImg.alt = v.model + " — кадър " + (shot + 1);
    lb.classList.add("open");
    if (first) lockPage(true);                  /* stepping frames must not re-pin */
    void lb.offsetWidth;
    D.getElementById("lb-close").focus();
  }
  function close() {
    lb.classList.remove("open");
    lockPage(false);
    stripTo(shot);                              /* the strip follows the lightbox */
    if (opener) { opener.focus({ preventScroll: true }); opener = null; }
  }
  fs.forEach(function (f) {
    f.addEventListener("click", function (e) {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button > 0) return;  /* let a new tab open */
      e.preventDefault();
      open(parseInt(f.getAttribute("data-i"), 10) || 0, f);
    });
  });
  D.getElementById("lb-close").addEventListener("click", close);
  D.getElementById("lb-prev").addEventListener("click", function () { open(shot - 1); });
  D.getElementById("lb-next").addEventListener("click", function () { open(shot + 1); });
  lb.addEventListener("click", function (e) { if (e.target === lb) close(); });
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
    /* with the lightbox shut the arrows drive the strip, if it is in view */
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    if (gal.scrollWidth - gal.clientWidth < 8) return;
    var r = gal.getBoundingClientRect();
    if (r.bottom < 80 || r.top > innerHeight - 80) return;
    if (/INPUT|TEXTAREA|SELECT/.test(D.activeElement.tagName)) return;
    stripTo(current() + (e.key === "ArrowRight" ? 1 : -1), true);
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
    var foot = D.querySelector(".foot");
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
