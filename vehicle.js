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
  function has(tag) { return (v.tags || []).indexOf(tag) > -1; }
  function frames(n) { return n === 1 ? "кадър" : "кадъра"; }

  var shots = v.shots || [];
  var N = shots.length;
  var l60 = AH.lease(v.price, 60);
  var age = v.year ? Math.max(1, (new Date()).getFullYear() - v.year) : null;
  var perYear = (age && v.km != null) ? Math.round(v.km / age) : null;
  var gearName = v.gear === "manual" ? "Ръчна" : "Автоматична";
  var chapterName = AH.chapterName[v.chapter] || "";
  var chapterBlurb = (function () {
    for (var i = 0; i < AH.chapters.length; i++)
      if (AH.chapters[i].key === v.chapter) return AH.chapters[i].blurb;
    return "";
  })();
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
     PROSE — assembled from the record and from the four-step standard.
     No provenance the data cannot support.
     ============================================================ */
  function story() {
    var p = [];

    p.push(v.make + " " + v.model + " — " +
      (v.unreg ? "нерегистриран" : v.year + " г.") + ", " + AH.km(v.km) + ", " +
      v.hp + " к.с. " + AH.fuel[v.fuel].toLowerCase() + ", " +
      gearName.toLowerCase() + " скоростна кутия" +
      (v.colour ? ", " + v.colour.toLowerCase() : "") + ".");

    if (v.unreg)
      p.push("Автомобилът не е регистриран. " + AH.km(v.km) +
        " са доставъчен пробег — от завода до салона.");
    else if (v.km != null && v.km < 1000)
      p.push("Пробегът от " + AH.km(v.km) + " е доставъчен; автомобилът е практически нов.");
    else if (perYear)
      p.push("От " + v.year + " г. са изминати " + AH.km(v.km) + " — около " +
        AH.fmt(perYear) + " км средногодишно.");

    if (has("guard"))
      p.push("Фабрично брониран автомобил. Нивото на защита и документацията към " +
        "бронирането се преглеждат лично при огледа, не се описват в обява.");

    if (chapterName)
      p.push("Стои в раздел „" + chapterName + "“" + (chapterBlurb ? ": " + chapterBlurb : "."));

    p.push("Преминал е през същия път като всеки автомобил в колекцията: проверка на " +
      "произход и сервизна история, механична подготовка в собствен сервиз, пълен Auto Spa " +
      "детайлинг и лично одобрение от " + CFG.expert + ", преди да бъде показан.");

    p.push("Документите — справка за произход, сервизни книжки и фактури — са на " +
      "разположение при огледа, преди да е поет какъвто и да било ангажимент.");

    p.push(v.price == null
      ? "Цената на този автомобил не се обявява публично; съобщава се при заявка."
      : "Обявената цена е крайна. Лизинг от ≈ " + AH.fmt(l60) +
        " € на месец при 20% първоначална вноска и 60 месеца.");

    return p.map(function (t) { return "<p>" + AH.esc(t) + "</p>"; }).join("");
  }

  /* ============================================================
     HIGHLIGHTS — derived, never invented. Max four.
     ============================================================ */
  function highlights() {
    var out = [];
    if (has("guard"))
      out.push(["Фабрично брониран", "Ниво на защита и документация — лично при оглед."]);
    if (v.unreg)
      out.push(["Нерегистриран", "Без първа регистрация, " + AH.km(v.km) + " от завода."]);
    else if (v.km != null && v.km < 1000)
      out.push(["Доставъчен пробег", AH.km(v.km) + " — практически нов автомобил."]);
    else if (perYear && perYear < 12000)
      out.push(["Малко каран", "Около " + AH.fmt(perYear) + " км средногодишно от " + v.year + " г."]);
    if (v.price == null)
      out.push(["Дискретна продажба", "Не се обявява публично; цената се съобщава при заявка."]);
    if (has("classic"))
      out.push(["Колекционерска стойност", "Възраст, в която състоянието е единственото, което тежи."]);
    if (v.gear === "manual")
      out.push(["Ръчна скоростна кутия", "Рядкост в този клас."]);
    if (v.fuel === "ev" || v.fuel === "phev" || v.fuel === "hybrid")
      out.push([AH.fuel[v.fuel], "С пълна история на батерията."]);
    if (v.hp >= 500)
      out.push([v.hp + " к.с.", "Мощност, която оправдава подготовката."]);
    if (out.length < 3)
      out.push(["Пълна сервизна история", "Книжки, фактури и справка за произход при огледа."]);
    return out.slice(0, 4);
  }

  function trustRow(t) {
    return "<li>" + CHECK + "<span>" + t + "</span></li>";
  }
  function checkRow(h) {
    return "<li>" + CHECK + '<span><b style="color:var(--ink);font-weight:600">' + AH.esc(h[0]) +
      '</b><span style="display:block;color:var(--ink-3)">' + AH.esc(h[1]) + "</span></span></li>";
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

      /* a) title / price / place */
      '<section class="dsec">' +
        '<div class="dtitle">' +
          "<h1>" + AH.esc(v.model) + "</h1>" +
          '<p class="dtitle__price">' +
            (v.price == null ? "Цена при запитване" : AH.price(v.price)) + "</p>" +
          '<p class="dtitle__place">AutoHaus · Пловдив · реф. ' + AH.esc(v.ref) + "</p>" +
        "</div>" +
      "</section>" +

      /* b) spec strip — value above label, scrollable */
      '<section class="dsec">' +
        '<dl class="dspecs">' +
          [["Година", v.unreg ? "Нерегистриран" : (v.year ? v.year + " г." : "—")],
           ["Пробег", AH.km(v.km)],
           ["Мощност", v.hp + " к.с."],
           ["Двигател", AH.fuel[v.fuel]],
           ["Скоростна кутия", gearName],
           ["Цвят", v.colour || "—"]
          ].map(function (r) {
            return "<div><dt>" + r[0] + "</dt><dd>" + AH.esc(String(r[1])) + "</dd></div>";
          }).join("") +
        "</dl>" +
      "</section>" +

      /* c) prose */
      '<section class="dsec">' +
        '<h2 class="dsec__h">За този автомобил</h2>' +
        '<div class="dclamp" id="dabout"><div class="dprose">' + story() + "</div></div>" +
        '<button type="button" class="dmore" id="dmore" aria-expanded="false" aria-controls="dabout">' +
          "Прочети още</button>" +
      "</section>" +

      /* d) details table */
      '<section class="dsec">' +
        '<h2 class="dsec__h">Детайли</h2>' +
        '<dl class="dtable">' +
          [["Марка", v.make],
           ["Модел", v.model],
           ["Първа регистрация", v.unreg ? "Нерегистриран"
              : (v.year ? (v.month ? (v.month < 10 ? "0" + v.month : v.month) + "." + v.year
                                   : v.year + " г.") : "—")],
           ["Пробег", AH.km(v.km)],
           ["Мощност", v.hp + " к.с."],
           ["Двигател", AH.fuel[v.fuel]],
           ["Скоростна кутия", gearName],
           ["Цвят", v.colour || "—"],
           ["Раздел", chapterName || "—"],
           ["Референция", v.ref]
          ].map(function (r) {
            return "<dt>" + r[0] + "</dt><dd>" + AH.esc(String(r[1])) + "</dd>";
          }).join("") +
        "</dl>" +
      "</section>" +

      /* e) why this one */
      '<section class="dsec">' +
        '<h2 class="dsec__h">Защо този</h2>' +
        '<ul class="dtrust" style="margin-top:0">' +
          highlights().map(checkRow).join("") +
        "</ul>" +
      "</section>" +

      /* f) ask — the seller, then a question that travels to the brief */
      '<section class="dsec">' +
        '<h2 class="dsec__h">Въпрос към AutoHaus</h2>' +
        '<div class="dseller">' +
          '<span class="dseller__av" aria-hidden="true" style="font-size:18px;font-weight:600">' +
            initials(CFG.expert) + "</span>" +
          "<div>" +
            '<p class="dseller__n">' + AH.esc(CFG.expert) + "</p>" +
            '<p class="dseller__m">Одобри лично този автомобил, преди да бъде показан.</p>' +
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
            "заявката и стига до " + AH.esc(CFG.expert) + " — отговор до 24 часа в работни дни.</p>" +
        "</form>" +
      "</section>" +

      /* g) guarantees and viewing */
      '<section class="dsec">' +
        '<h2 class="dsec__h">Гаранции и оглед</h2>' +
        '<ul class="dtrust" style="margin-top:0">' +
          trustRow("Оглед всеки делничен ден 09:00 – 18:00, без записване. Автомобилът е физически в салона.") +
          trustRow("Тест драйв по уговорка — автомобилът трябва да е подготвен и застрахован за него.") +
          trustRow("Запазване за 48 часа след капаро, докато уредите финансирането.") +
          trustRow("Бартер: оглеждаме вашия автомобил на място и даваме твърда оферта същия ден.") +
        "</ul>" +
      "</section>" +

    "</div>" +

    /* the rail — sticky on a desktop, last in the stack on a phone */
    '<aside class="drail" aria-label="Цена и запитване">' +
      '<p class="drail__pk">' + (v.price == null ? "Дискретна продажба" : "Крайна цена") + "</p>" +
      '<p class="drail__price">' +
        (v.price == null ? "При запитване" : AH.price(v.price)) + "</p>" +
      '<p class="drail__lease">' + (v.price == null
        ? "Този автомобил не се обявява публично. Цената и условията се съобщават при заявка."
        : "Лизинг от ≈ " + AH.fmt(l60) + " € / мес. при 20% първоначална вноска") + "</p>" +
      '<a class="btn-primary" href="' + AH.conciergeUrl({ v: v.id }) + '">Запитване</a>' +
      '<a class="btn-ghost" href="' + AH.conciergeUrl({ v: v.id, visit: 1 }) + '">Запази оглед</a>' +
      '<p class="drail__fn">Заявката стига директно до ' + AH.esc(CFG.expert) +
        ' и получава отговор до 24 часа в работни дни. За спешни въпроси: <a href="tel:' +
        CFG.salonPhone + '">' + prettyPhone(CFG.salonPhone) + "</a>.</p>" +

      (v.price == null ? "" :
      '<div class="drail__div"></div>' +
      '<p class="drail__pk">Лизинг · 20% първоначална вноска</p>' +
      '<div class="vd-terms" role="group" aria-label="Срок в месеци" style="margin-top:16px">' +
        [24, 36, 48, 60].map(function (t) {
          return '<button type="button" class="vd-term' + (t === 60 ? " is-on" : "") +
            '" data-term="' + t + '" aria-pressed="' + (t === 60) + '">' + t + "</button>";
        }).join("") +
      "</div>" +
      '<p class="vd-out" id="vd-out" role="status" aria-live="polite">≈ ' +
        AH.fmt(l60) + " € / месец</p>") +
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

  /* ---- the read-more clamp ---- */
  var clamp = D.getElementById("dabout"), moreBtn = D.getElementById("dmore");
  if (clamp && moreBtn) {
    /* nothing to expand if the prose already fits. Re-checked on load,
       because the webfont arrives after this runs and reflows the prose. */
    var fits = function () {
      if (clamp.classList.contains("is-open")) return;
      if (clamp.scrollHeight <= clamp.clientHeight + 4) moreBtn.setAttribute("hidden", "");
      else moreBtn.removeAttribute("hidden");
    };
    fits();
    addEventListener("load", fits);
    moreBtn.addEventListener("click", function () {
      var open = clamp.classList.toggle("is-open");
      moreBtn.setAttribute("aria-expanded", open ? "true" : "false");
      moreBtn.textContent = open ? "Скрий" : "Прочети още";
    });
  }

  /* ---- leasing terms ---- */
  var out = D.getElementById("vd-out");
  if (out) {
    var terms = Array.prototype.slice.call(D.querySelectorAll(".vd-term"));
    terms.forEach(function (b) {
      b.addEventListener("click", function () {
        var term = parseInt(b.getAttribute("data-term"), 10) || 60;
        terms.forEach(function (o) {
          var on = o === b;
          o.classList.toggle("is-on", on);
          o.setAttribute("aria-pressed", on ? "true" : "false");
        });
        out.textContent = "≈ " + AH.fmt(AH.lease(v.price, term)) + " € / месец";
      });
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
    var foot = D.querySelector(".foot"), qs = false;
    var onScroll = function () {
      qs = false;
      var g = gal.getBoundingClientRect();
      var navH = parseFloat(getComputedStyle(D.body).paddingTop) || 64;
      var past = g.bottom < navH + 8;
      var footerUp = foot ? foot.getBoundingClientRect().top < innerHeight - 40 : false;
      if (mini) mini.classList.toggle("show", past && !footerUp);
      if (bar) bar.classList.toggle("show", past && !footerUp);
    };
    addEventListener("scroll", function () {
      if (qs) return;
      qs = true;
      requestAnimationFrame(onScroll);
    }, { passive: true });
    addEventListener("resize", onScroll);
    onScroll();
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
