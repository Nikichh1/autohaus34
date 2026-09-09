/* ============================================================
   AUTOHAUS — THE CATALOG ENGINE  (v41)

   One card renderer and one filter engine, shared by:
     · the landing page preview   (index.html)
     · the full-screen collection (showroom.js, over the landing page)
     · the expanding catalog layer (showroom.js)
     · "you might also like"       (vehicle.js)

   That sharing is the point. On JamesEdition the same ListingCard appears
   on the category page, in the results grid and under a listing, so the
   card is learned once and never re-learned. If the preview and the
   expanded catalog rendered different markup, the expansion would read as
   a new page arriving rather than the same room getting bigger.

   Depends on AH from main.js for the data layer (AH.all, AH.img, AH.price,
   AH.matchQ, AH.sortBy, AH.conciergeUrl…). Everything here is additive:
   with this file blocked the pages still render their server markup.
   ============================================================ */
(function () {
  "use strict";
  var D = document, AH = window.AH;
  if (!AH) return;

  /* ============================================================
     THE CARD

     Information order is theirs and it is deliberate:
       price  ->  year make model  ->  place
     The price leads because at this value it is the first question, not
     the last. The name is one line. The third line is provenance.
     ============================================================ */

  var ENVELOPE = '<svg viewBox="0 0 16 16" aria-hidden="true">' +
    '<rect x="1" y="3" width="14" height="10"/><path d="M1,4 L8,9 L15,4"/></svg>';
  /* Drawn inline, NOT as <use href="#arrow">. That is half of why the card's
     old hover arrows were invisible: the `arrow` symbol is only defined in
     vehicle.html, so on the landing page and in the collection layer every
     <use> pointing at it resolved to nothing and the
     button rendered an empty 26x8 box over the photograph. This renderer is
     shared by four pages and can only depend on markup it ships itself. */
  var ARR = '<svg viewBox="0 0 26 8" aria-hidden="true">' +
    '<line x1="0" y1="4" x2="24" y2="4"/><path d="M19,1 L24,4 L19,7"/></svg>';

  /* THE CARD CARRIES NO BADGE.
     It used to sticker a corner of the photograph — "Доставъчен пробег",
     "Нерегистриран", "Класика". Three problems, one cause: a label pasted on
     a photograph is the visual language of a marketplace listing, not of a
     collection; it landed on some cards and not others, so a grid of eighty
     read as unevenly finished; and every one of those facts is already on the
     card (500 км IS delivery mileage) or on the dossier where it can be
     explained. The photograph is the card's whole first impression and
     nothing is allowed to sit on top of it. `AH.sorts.recent` still reads the
     `delivery` tag — sorting by it is fine, advertising it was not. */

  /* year make model — their card's middle line, in their order */
  function nameLine(v) {
    return (v.unreg ? "" : (v.year ? v.year + " " : "")) + v.make + " " + v.model;
  }

  /* their third line is a location. Ours is the thing a Bulgarian buyer
     actually needs at a glance, in the same slot with the same weight. */
  function metaLine(v) {
    var bits = [];
    bits.push(AH.km(v.km));
    if (v.hp) bits.push(v.hp + " к.с.");
    bits.push(AH.fuel[v.fuel] || "");
    return bits.filter(Boolean).join(" · ");
  }

  /* opts: { paper:true, sizes:"…", eager:true, act:false } */
  AH.card = function (v, opts) {
    opts = opts || {};
    var shots = v.shots || [];
    var n = shots.length;
    var sizes = opts.sizes ||
      "(min-width:1600px) 23vw, (min-width:1024px) 31vw, (min-width:600px) 46vw, 92vw";
    var priceCls = v.price == null ? "lc__price lc__price--ask" : "lc__price";
    var priceTxt = v.price == null ? "Цена при запитване" : AH.price(v.price);

    return '' +
    '<article class="lc' + (opts.paper ? " lc--paper" : "") + '" data-id="' + AH.esc(v.id) + '">' +
      '<a class="lc__link" href="' + AH.vehicleUrl(v) + '">' +
        '<span class="lc__pic">' +
          /* <picture>, not <img srcset>: the format switch has to be a
             <source type>, because a browser without WebP still picks a WebP
             candidate out of a srcset and then cannot decode it */
          AH.picture(shots[0], { eager: opts.eager, width: 412, height: 252,
                                 sizes: sizes, src: 800, alt: v.full }) +
          /* THE CARD NO LONGER STEPS ITS OWN PHOTOGRAPH.
             It used to carry hover arrows, a "1 / 24" counter and an "24
             кадъра" pill. The arrows were invisible against a bright frame
             (white strokes on a 34%-black gradient over a sunlit bonnet), the
             counter told a browsing visitor a number they cannot act on, and
             all three competed with the one thing the card is for: going to
             the car. Stepping frames belongs on the dossier, where the gallery
             is the subject rather than a thumbnail. What the hover says now is
             simply where the click goes. */
          '<span class="lc__cue" aria-hidden="true"><span>Разгледай</span>' + ARR + "</span>" +
        "</span>" +
        '<span class="lc__body">' +
          '<span class="' + priceCls + '">' + priceTxt + "</span>" +
          '<span class="lc__name">' + AH.esc(nameLine(v)) + "</span>" +
          '<span class="lc__meta">' + AH.esc(metaLine(v)) + "</span>" +
        "</span>" +
      "</a>" +
      (opts.act === false ? "" :
        '<a class="lc__act" href="' + AH.conciergeUrl({ v: v.id }) + '">' + ENVELOPE + "Запитване</a>") +
    "</article>";
  };

  /* AH.cardGallery — the delegated in-card photo stepper — was removed with
     the arrows it drove. A card is a doorway; the dossier holds the gallery.
     Nothing calls it any more; if in-grid stepping is ever wanted again, it
     needs a control that can be seen over a bright photograph first. */

  /* ============================================================
     THE FILTER ENGINE

     Their control set, mapped onto what this dataset can actually
     answer. A filter that cannot be answered from the records is not
     offered — a Body Style pill over data with no body styles is a
     promise the page cannot keep.

       theirs            ours
       Make              Марка        (14 real makes)
       Model             Модел        (appears only after a make — theirs too)
       Year              Година       (range)
       Price             Цена         (range, plus "при запитване")
       Body Style        Раздел       (our chapters: the honest analogue)
       Country/State     —            (one showroom, one city)
       —                 Двигател     (fuel: we have it, they gate it deeper)
       —                 Пробег       (range, 0 to the highest record)
       —                 Мощност      (range: the spec a performance buyer
                                       opens a catalogue with, and the one
                                       every single record carries)
     ============================================================ */

  var CHAPTERS = AH.chapters;
  var FUELS = [
    { key: "petrol", name: "Бензин" }, { key: "diesel", name: "Дизел" },
    { key: "hybrid", name: "Хибрид" }, { key: "phev", name: "Plug-in" },
    { key: "ev", name: "Електрически" }
  ];

  var SORTS = [
    /* their order, their labels, our words. "Препоръчани" is their
       "Premium": the curated order the dataset already carries. */
    { key: "curated",    name: "Препоръчани" },
    { key: "recent",     name: "Най-нови постъпления" },
    { key: "price-desc", name: "Цена — низходящо" },
    { key: "price-asc",  name: "Цена — възходящо" },
    { key: "year-desc",  name: "Година — най-нови" },
    { key: "km-asc",     name: "Пробег — най-малък" },
    { key: "hp-desc",    name: "Мощност — най-висока" }
  ];
  AH.catalogSorts = SORTS;

  /* "recent" has no timestamp in the dataset, so it means what it can
     honestly mean: the unregistered and delivery-mileage cars first. */
  AH.sorts.recent = function (a, b) {
    var s = function (v) { return (v.unreg ? 2 : 0) + (v.tags.indexOf("delivery") > -1 ? 1 : 0); };
    return s(b) - s(a) || (b.year || 0) - (a.year || 0);
  };

  var BOUNDS = (function () {
    var V = AH.all, yr = [], pr = [], km = [], hp = [];
    V.forEach(function (v) {
      if (v.year) yr.push(v.year);
      if (v.price != null) pr.push(v.price);
      if (v.km != null) km.push(v.km);
      if (v.hp) hp.push(v.hp);
    });
    var mm = function (a) { return [Math.min.apply(null, a), Math.max.apply(null, a)]; };
    /* mileage starts at zero whatever the lowest record says — a slider whose
       floor is 500 cannot express "as new", which is the end of the scale
       people actually reach for.

       Horsepower is rounded OUTWARD to the nearest ten, and that is not
       cosmetic: a range input snaps to min + k*step, so with min 89 and step
       10 the reachable values are 89, 99 … 499, 509. Typing "500" landed on
       499 and the control then read "499–839 к.с.", which looks like an
       arithmetic bug in a shop selling cars by the hundred thousand. Rounded
       to 80 and 850 the stops are round numbers all the way up. */
    var hpr = mm(hp);
    return {
      year: mm(yr), price: mm(pr), km: [0, mm(km)[1]],
      hp: [Math.floor(hpr[0] / 10) * 10, Math.ceil(hpr[1] / 10) * 10]
    };
  })();
  AH.catalogBounds = BOUNDS;

  /* ---- state ----
     Пробег and Мощност used to be bolted on from showroom.js, which wrapped
     six engine entry points to teach them about mileage and left a comment
     saying it belonged here. It does: a filter the instrument offers has to
     be one the engine owns, or every count, badge and shared URL is computed
     by a different definition of "matches" than the results are. Horsepower
     is the one specification a performance buyer opens a catalogue with, and
     every record in the set carries it. */
  AH.newFilterState = function () {
    return {
      q: "", make: "", model: "", chapter: "", tag: "", fuel: "",
      yearMin: null, yearMax: null, priceMin: null, priceMax: null,
      kmMin: null, kmMax: null, hpMin: null, hpMax: null,
      includeAsk: true,          /* keep "цена при запитване" in price ranges */
      sort: "curated"
    };
  };

  /* `except` lets one control count itself as if unapplied, so a chip can
     show how many cars it would give you rather than how many it gives
     you on top of itself. */
  AH.filterMatch = function (S, v, except) {
    if (S.q && !AH.matchQ(v, S.q)) return false;
    if (S.make && except !== "make" && v.make !== S.make) return false;
    if (S.model && except !== "model" && v.model !== S.model) return false;
    if (S.chapter && except !== "chapter" && v.chapter !== S.chapter) return false;
    if (S.tag && except !== "chapter" && v.tags.indexOf(S.tag) < 0) return false;
    if (S.fuel && except !== "fuel" && v.fuel !== S.fuel) return false;
    if (except !== "year") {
      var y = v.unreg ? BOUNDS.year[1] : v.year;
      if (S.yearMin != null && y < S.yearMin) return false;
      if (S.yearMax != null && y > S.yearMax) return false;
    }
    if (except !== "price") {
      if (v.price == null) {
        if ((S.priceMin != null || S.priceMax != null) && !S.includeAsk) return false;
      } else {
        if (S.priceMin != null && v.price < S.priceMin) return false;
        if (S.priceMax != null && v.price > S.priceMax) return false;
      }
    }
    if (except !== "km") {
      if (S.kmMin != null && (v.km == null || v.km < S.kmMin)) return false;
      if (S.kmMax != null && (v.km == null || v.km > S.kmMax)) return false;
    }
    if (except !== "hp") {
      if (S.hpMin != null && (!v.hp || v.hp < S.hpMin)) return false;
      if (S.hpMax != null && (!v.hp || v.hp > S.hpMax)) return false;
    }
    return true;
  };

  AH.filterResults = function (S) {
    var out = AH.all.filter(function (v) { return AH.filterMatch(S, v); });
    return AH.sortBy(out, S.sort);
  };
  AH.filterCount = function (S, except, extra) {
    return AH.all.filter(function (v) {
      if (!AH.filterMatch(S, v, except)) return false;
      return extra ? extra(v) : true;
    }).length;
  };

  AH.filterDirty = function (S) {
    return !!(S.q || S.make || S.model || S.chapter || S.tag || S.fuel ||
      S.yearMin != null || S.yearMax != null || S.priceMin != null || S.priceMax != null ||
      S.kmMin != null || S.kmMax != null || S.hpMin != null || S.hpMax != null);
  };
  AH.filterClear = function (S) {
    var f = AH.newFilterState();
    f.sort = S.sort;                 /* a sort is a preference, not a filter */
    Object.keys(f).forEach(function (k) { S[k] = f[k]; });
  };

  /* how many controls carry a value — their "Filters" pill shows a count */
  AH.filterBadge = function (S) {
    var n = 0;
    if (S.make) n++;
    if (S.model) n++;
    if (S.chapter || S.tag) n++;
    if (S.fuel) n++;
    if (S.yearMin != null || S.yearMax != null) n++;
    if (S.priceMin != null || S.priceMax != null) n++;
    if (S.kmMin != null || S.kmMax != null) n++;
    if (S.hpMin != null || S.hpMax != null) n++;
    return n;
  };

  /* ---- URL, so every view is shareable and the back button works ---- */
  var URL_KEYS = ["q", "make", "model", "chapter", "tag", "fuel",
                  "yearMin", "yearMax", "priceMin", "priceMax",
                  "kmMin", "kmMax", "hpMin", "hpMax", "sort"];
  AH.filterToQuery = function (S) {
    var p = new URLSearchParams();
    URL_KEYS.forEach(function (k) {
      var val = S[k];
      if (val === "" || val == null) return;
      if (k === "sort" && val === "curated") return;
      p.set(k, val);
    });
    return p.toString();
  };
  AH.filterFromQuery = function (S, search) {
    var p = new URLSearchParams(search == null ? location.search : search);
    URL_KEYS.forEach(function (k) {
      if (!p.has(k)) return;
      var raw = p.get(k);
      S[k] = /Min$|Max$/.test(k) ? (raw === "" ? null : +raw) : raw;
    });
    /* a chapter arriving as a tag is how the landing page deep-links */
    if (S.tag && S.chapter) S.chapter = "";
    return S;
  };

  /* ---- the option lists a bar needs, with live counts ---- */
  AH.filterOptions = function (S) {
    var tally = {};
    AH.all.forEach(function (v) {
      if (AH.filterMatch(S, v, "make")) tally[v.make] = (tally[v.make] || 0) + 1;
    });
    var makes = Object.keys(AH.all.reduce(function (a, v) { a[v.make] = 1; return a; }, {}))
      .sort(function (a, b) { return (tally[b] || 0) - (tally[a] || 0) || a.localeCompare(b); })
      .map(function (m) { return { key: m, name: m, n: tally[m] || 0 }; });

    var models = [];
    if (S.make) {
      var mt = {};
      AH.all.forEach(function (v) {
        if (v.make !== S.make) return;
        if (AH.filterMatch(S, v, "model")) mt[v.model] = (mt[v.model] || 0) + 1;
      });
      models = Object.keys(mt).sort().map(function (m) { return { key: m, name: m, n: mt[m] }; });
    }

    var chapters = CHAPTERS.map(function (c) {
      return { key: c.key, name: c.name, n: AH.filterCount(S, "chapter",
        function (v) { return v.chapter === c.key; }) };
    }).filter(function (c) { return c.n > 0 || S.chapter === c.key; });

    var fuels = FUELS.map(function (f) {
      return { key: f.key, name: f.name, n: AH.filterCount(S, "fuel",
        function (v) { return v.fuel === f.key; }) };
    }).filter(function (f) { return f.n > 0 || S.fuel === f.key; });

    return { makes: makes, models: models, chapters: chapters, fuels: fuels, sorts: SORTS };
  };

  /* ---- marque tiles for the discovery row (their "Popular Makes") ---- */
  AH.marques = function (limit) {
    var by = {};
    AH.all.forEach(function (v) {
      if (!by[v.make]) by[v.make] = { make: v.make, n: 0, shot: null, score: -1 };
      by[v.make].n++;
      /* the tile should show that marque's best car, not its first: the
         most expensive one is the closest thing the data has to "best" */
      var s = v.price == null ? 1e9 : v.price;
      if (s > by[v.make].score) { by[v.make].score = s; by[v.make].shot = v.shots[0]; }
    });
    return Object.keys(by).map(function (k) { return by[k]; })
      .sort(function (a, b) { return b.n - a.n || a.make.localeCompare(b.make); })
      .slice(0, limit || 14);
  };

  AH.marqueTile = function (m) {
    var href = "index.html?make=" + encodeURIComponent(m.make);
    return '<a class="mtile" href="' + href + '" data-catalog data-make="' + AH.esc(m.make) + '">' +
      '<span class="mtile__pic">' +
        AH.picture(m.shot, { width: 140, height: 107, widths: [400, 800],
                             sizes: "(min-width:1024px) 14vw, 45vw", src: 400, alt: m.make }) +
      "</span>" +
      '<span class="mtile__name">' + AH.esc(m.make) + "</span>" +
      '<span class="mtile__n">' + m.n + (m.n === 1 ? " автомобил" : " автомобила") + "</span>" +
    "</a>";
  };

  /* ---- plural helper used by every count line ---- */
  AH.plural = function (n) { return n === 1 ? "автомобил" : "автомобила"; };
})();
