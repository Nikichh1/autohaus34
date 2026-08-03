/* ============================================================
   AUTOHAUS — v34 · plain JS, no dependencies

   Behaviour ported from the measured Bentley homepage:
     1. hero stage — 8-slide crossfade, counter, range, prev/next, autoplay
     2. card wall  — drag scroller, arrows, progress bar, staggered entry
     3. reveals    — appear-on-scroll (source: bm-appear-animation)
     4. parallax   — decor squares + the CTA image pair (source: bm-parallax)
     5. leasing    — the control inside article teaser 2
     6. header + mobile nav
     7. vehicle.html — lightbox + sticky CTA (legacy, unchanged)

   Everything is an enhancement: with this file blocked the page still
   shows every slide's content, every card and every link.
   ============================================================ */
(function () {
  "use strict";
  document.documentElement.classList.add("js");

  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var coarse = matchMedia("(hover: none)").matches;

  /* ---- LOW-POWER PATH -----------------------------------------------------
     The three most expensive things on this page are a 16px blur over a
     full-bleed backdrop and two 40px backdrop-filters that repaint while you
     scroll. On a 2013 laptop with Intel HD graphics — the machines still
     running Windows 7 — those alone drop the page to single-digit frames.

     Rather than guess from the user agent, ask the device: fewer than 4 cores
     or under 4GB of reported memory, or an explicit data-saver request, and
     the page swaps the blurs for flat tints. Everything keeps its exact
     geometry, colour and timing; only the compositing cost goes.        */
  var lowPower = (function () {
    try {
      var nav = navigator;
      if (nav.connection && nav.connection.saveData) return true;
      if (typeof nav.deviceMemory === "number" && nav.deviceMemory <= 4) return true;
      if (typeof nav.hardwareConcurrency === "number" && nav.hardwareConcurrency <= 4) return true;
    } catch (e) {}
    return false;
  })();
  if (lowPower) document.documentElement.classList.add("lo-fx");
  var $ = function (id) { return document.getElementById(id); };
  var all = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var fmt = function (n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " "); };

  /* ============================================================
     0. DATA LAYER  (added in v35)

     The design system below is unchanged v34. This block only gives the
     collection, the vehicle page and the concierge one source for the 87
     real cars, and renders cards in the SAME card-wall language the
     homepage already uses — white ground, cover photo, the eased
     double-gradient scrim, label above / title and body below.
     ============================================================ */
  var CFG = window.AH_CONFIG = Object.assign({
    endpoint: "",
    email: "autohausbg@gmail.com",
    salonPhone: "+359884777147",
    expert: "Иван Манев",
    expertPhone: "+359884777045",
    whatsapp: "359884777045"
  }, window.AH_CONFIG || {});

  var V = window.AH_VEHICLES || [];
  /* "Брониран клас" was a chapter here, and a badge on every card that
     carried the tag. It is a specification, not a way anyone chooses a car —
     the five vehicles it described are chauffeur cars first and armoured
     second, and a buyer looking for a Maybach was being shown a category from
     a generic dealer taxonomy. The cars stay; the chapter does not. What
     protection they carry is on the dossier, where it belongs, and it is
     reviewed in person rather than advertised. */
  var CHAPTERS = [
    { key: "chauffeur",   name: "Представителен",  blurb: "Maybach, дълга база, VIP салон. Задната седалка е работното място." },
    { key: "performance", name: "Performance",     blurb: "AMG, RS, Turbo S, GT. Автомобили, които се избират с ушите." },
    { key: "utility",     name: "Терен",           blurb: "G-класа, Land Cruiser, Range Rover. Построени да не се извиняват." },
    { key: "electrified", name: "Електрифицирани", blurb: "Електрически и хибридни, с пълна история на батерията." },
    { key: "classic",     name: "Класика",         blurb: "Автомобили, чиято стойност вече не се обезценява." },
    { key: "saloon",      name: "Селекция",        blurb: "Останалата част от колекцията — седани, купета и SUV." }
  ];
  var CH_NAME = {}; CHAPTERS.forEach(function (c) { CH_NAME[c.key] = c.name; });
  /* the retired chapter's cars keep their place in the collection */
  V.forEach(function (v) { if (v.chapter === "guard") v.chapter = "chauffeur"; });
  var FUEL = { petrol: "Бензин", diesel: "Дизел", hybrid: "Хибрид", phev: "Plug-in хибрид", ev: "Електрически" };

  var esc = function (s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  };

  /* ---- IMAGES -------------------------------------------------------------
     Every photo on autohaus.bg is a ~700-900KB original, and WordPress has
     already rendered five smaller copies of each. Serving the original into a
     318px card was costing 18MB on the homepage alone. These two helpers pick
     the right copy; nothing else about the markup changes.

     Verified present for every upload in the dataset:
       -260x160  -300x188  -768x480  -784x490  -800x490  and the original. */
  /* ---- LOCAL ASSETS ------------------------------------------------------
     Every vehicle photograph is served from this project, not from
     autohaus.bg. 648 originals were pulled down once and re-encoded to
     img/v/ at three widths in WebP and JPEG. Nothing at runtime touches a
     remote host any more, which removes a third-party origin from the
     critical path, a DNS lookup and a TLS handshake from first paint, and any
     chance of the shop's own CMS deciding what our pages look like.

     The local name is derived from the source URL rather than looked up, so
     there is no manifest to ship or keep in step: WordPress writes uploads to
     /YYYY/MM/name.jpg and that triple is already unique across the set
     (checked — 648 URLs, 648 keys, no collisions). Anything that does not
     match the pattern falls through to the URL it was given, so a hand-added
     record still renders. */
  var LOCAL = "img/v/";
  var LOCAL_W = [400, 800, 1280];
  function localKey(url) {
    var m = String(url).match(/\/(\d{4})\/(\d{2})\/([^\/]+?)(?:-\d+x\d+)?\.(?:jpe?g|png)$/i);
    return m ? m[1] + "-" + m[2] + "_" + m[3] : null;
  }
  /* the JPEG at a given width — this is what goes in `src`, so it has to be
     the universally decodable one */
  function img(url, w) {
    var k = localKey(url);
    if (!k) return url;
    var pick = LOCAL_W.indexOf(w) > -1 ? w : (w && w <= 400 ? 400 : w && w >= 1280 ? 1280 : 800);
    return LOCAL + k + "-" + pick + ".jpg";
  }
  function setOf(url, ext, widths) {
    var k = localKey(url);
    if (!k) return url + " 1280w";
    return (widths || LOCAL_W).filter(function (w) { return LOCAL_W.indexOf(w) > -1; })
      .map(function (w) { return LOCAL + k + "-" + w + "." + ext + " " + w + "w"; }).join(", ");
  }
  /* widths must be listed ascending */
  function srcset(url, widths) { return setOf(url, "jpg", widths); }
  function webpset(url, widths) { return setOf(url, "webp", widths); }
  /* The photograph, as a <picture>: WebP for the ~97% that take it, JPEG for
     everyone else. srcset alone could not do this — a browser without WebP
     still picks from srcset and then fails to decode, so the format switch
     has to be a <source type>, not a candidate. */
  function picture(url, o) {
    o = o || {};
    var w = o.widths || LOCAL_W;
    var sizes = o.sizes ? ' sizes="' + o.sizes + '"' : "";
    return '<picture>' +
      '<source type="image/webp" srcset="' + webpset(url, w) + '"' + sizes + '>' +
      '<img ' + (o.eager ? 'fetchpriority="high"' : 'loading="lazy"') + ' decoding="async"' +
        (o.width ? ' width="' + o.width + '" height="' + o.height + '"' : "") +
        (o.cls ? ' class="' + o.cls + '"' : "") +
        ' src="' + img(url, o.src || 800) + '"' +
        ' srcset="' + srcset(url, w) + '"' + sizes +
        ' alt="' + esc(o.alt || "") + '">' +
      '</picture>';
  }
  var priceTxt = function (v) { return v == null ? null : fmt(v) + " €"; };
  var kmTxt = function (v) { return v == null ? "—" : fmt(v) + " км"; };
  var yrTxt = function (v) { return v.unreg ? "Нов" : (v.year || "—"); };
  /* annuity on 80% of price at 6.9% nominal — the homepage calculator's maths */
  var lease = function (p, term) {
    if (!p) return null;
    var fin = p * 0.8, r = 0.069 / 12;
    return fin * r / (1 - Math.pow(1 + r, -(term || 60)));
  };

  var AH = window.AH = {
    cfg: CFG, all: V, chapters: CHAPTERS, chapterName: CH_NAME, fuel: FUEL,
    fmt: fmt, price: priceTxt, km: kmTxt, yr: yrTxt, lease: lease, esc: esc,
    img: img, srcset: srcset, webpset: webpset, picture: picture,
    byId: function (id) { return V.filter(function (v) { return v.id === id; })[0] || null; },
    count: function (fn) { return V.filter(fn).length; },
    countOf: function (k) {
      if (k === "all") return V.length;
      if (k === "makes") return Object.keys(V.reduce(function (a, v) { a[v.make] = 1; return a; }, {})).length;
      if (k === "ask") return AH.count(function (v) { return v.price == null; });
      var byCh = AH.count(function (v) { return v.chapter === k; });
      return byCh || AH.count(function (v) { return v.tags.indexOf(k) > -1; });
    },
    conciergeUrl: function (o) {
      o = o || {};
      var q = [];
      Object.keys(o).forEach(function (k) {
        if (o[k] !== undefined && o[k] !== null && o[k] !== "")
          q.push(encodeURIComponent(k) + "=" + encodeURIComponent(o[k]));
      });
      return "concierge.html" + (q.length ? "?" + q.join("&") : "");
    },
    vehicleUrl: function (v) { return "vehicle.html?id=" + encodeURIComponent(v.id); }
  };


  /* ---- SEARCH -------------------------------------------------------------
     Eighty-seven cars is exactly the size where filters stop being enough:
     someone who already knows they want a G 63 should not have to walk
     Терен → Mercedes-AMG to find it.

     Two decisions worth stating:

     · Every token must match, in any order. "guard s600" and "s 600 guard"
       find the same car; a single substring search would find neither.
     · The dataset is written in Latin for the marque and Cyrillic for
       everything else, but Bulgarian buyers type marques both ways. Each
       car's haystack therefore carries its own Cyrillic spelling, so
       "мерцедес" and "mercedes" are the same query.

     The haystack is built once per car on first use and cached. */
  var MAKE_BG = {
    "BMW": "бмв бемве",
    "Mercedes-Benz": "мерцедес мерцедес-бенц мерцедес бенц",
    "Mercedes-AMG": "мерцедес амг мерцедес-амг",
    "Mercedes-Maybach": "мерцедес майбах мейбах",
    "Audi": "ауди",
    "Ferrari": "ферари",
    "Porsche": "порше порше",
    "Maserati": "мазерати",
    "Volkswagen": "фолксваген вw",
    "Land Rover": "ленд роувър рейндж",
    "Toyota": "тойота",
    "Mazda": "мазда",
    "Cadillac": "кадилак",
    "Bentley": "бентли"
  };
  var HAY = {};
  function fold(s) {
    return String(s == null ? "" : s).toLowerCase().replace(/\s+/g, " ").trim();
  }
  function hay(v) {
    if (HAY[v.id]) return HAY[v.id];
    return (HAY[v.id] = fold([
      v.make, MAKE_BG[v.make] || "", v.model, v.full, v.ref, v.colour,
      v.unreg ? "нов нерегистриран" : v.year,
      v.hp + " кс к.с.", FUEL[v.fuel] || "",
      v.gear === "manual" ? "ръчна ръчни" : "автоматик автоматична",
      CH_NAME[v.chapter] || "", (v.tags || []).join(" "),
      v.price == null ? "запитване" : ""
    ].join(" ")));
  }
  /* exposed so the collection page and the showroom layer share one
     definition of what "matches" means — they must never disagree */
  AH.matchQ = function (v, q) {
    q = fold(q);
    if (!q) return true;
    var t = q.split(" ");
    var h = hay(v);
    for (var i = 0; i < t.length; i++) if (h.indexOf(t[i]) < 0) return false;
    return true;
  };
  /* one shared sort table, same reason */
  AH.sorts = {
    "price-desc": function (a, b) { return (b.price == null ? -1 : b.price) - (a.price == null ? -1 : a.price); },
    "price-asc":  function (a, b) { return (a.price == null ? 1e12 : a.price) - (b.price == null ? 1e12 : b.price); },
    "year-desc":  function (a, b) { return (b.unreg ? 9999 : b.year || 0) - (a.unreg ? 9999 : a.year || 0); },
    "km-asc":     function (a, b) { return (a.km == null ? 1e9 : a.km) - (b.km == null ? 1e9 : b.km); },
    "hp-desc":    function (a, b) { return (b.hp || 0) - (a.hp || 0); }
  };
  AH.sortBy = function (list, key) {
    var by = AH.sorts[key];
    return by ? list.slice().sort(by) : list;   /* "curated" is dataset order */
  };

  /* A collection card IS a card-wall card: same aspect, same white ground,
     same scrim, same label-over-title-over-body order — so the grid on
     index.html#avtomobili reads as the homepage wall, unrolled. */
  AH.cardHTML = function (v) {
    var label = v.tags.indexOf("guard") > -1 ? "Брониран клас"
              : v.tags.indexOf("delivery") > -1 ? "Доставъчен пробег"
              : v.tags.indexOf("classic") > -1 ? "Класика"
              : CH_NAME[v.chapter] || "В наличност";
    var price = v.price == null ? "Цена при запитване" : priceTxt(v.price);
    return '' +
      '<article class="gcard">' +
        '<span class="gcard-photo">' +
          picture(v.shots[0], { width: 800, height: 490, src: 800, alt: v.full,
            sizes: "(min-width:1920px) 25vw, (min-width:1024px) 33vw, (min-width:768px) 50vw, 100vw" }) +
        "</span>" +
        '<span class="gcard-text">' +
          '<span class="gcard-label">' + esc(label) + " · " + v.ref + "</span>" +
          '<a class="gcard-anchor" href="' + AH.vehicleUrl(v) + '">' +
            '<span class="h6 gcard-h">' + esc(v.model) + "</span></a>" +
          '<span class="body-s gcard-make">' + esc(v.make) + "</span>" +
          '<span class="gcard-spec">' + yrTxt(v) + " · " + kmTxt(v.km) + " · " + v.hp + " к.с. · " + FUEL[v.fuel] + "</span>" +
          '<span class="gcard-foot"><span class="gcard-price">' + price + "</span>" +
            '<button type="button" class="gcard-look" data-look="' + v.id + '">Бърз преглед</button></span>' +
        "</span>" +
      "</article>";
  };

  /* ---- MORPH -------------------------------------------------------------
     A CSS grid cannot interpolate between two `grid-template-areas`, so the
     filter bar's two states used to change in a single frame: measured at
     1440, the pill row jumped 284px sideways, lost 686px of width and rose
     11px, all between one frame and the next. Transitioning padding-block
     alongside it only drew attention to the snap.

     So the arrangement is FLIPped. Read every part's box, let the layout
     change, read it again, then play each part from where it WAS to where it
     now is — on the compositor, as a transform, with the widths that actually
     changed animated alongside. The grid still snaps; nobody sees it snap.

     The bar's own height is animated too, because it is what the eye tracks:
     the copy below appears to rise into the space rather than being revealed
     by a bar that has already gone. */
  AH.morphDur = 340;
  AH.morphEase = "cubic-bezier(.32,.72,0,1)";
  AH.morph = function (root, parts, apply) {
    if (reduce || !root.animate) { apply(); return; }
    var kids = [].concat(parts).filter(Boolean);
    var a = kids.map(function (k) { return k.getBoundingClientRect(); });
    var h0 = root.getBoundingClientRect().height;
    apply();
    var b = kids.map(function (k) { return k.getBoundingClientRect(); });
    var h1 = root.getBoundingClientRect().height;
    var o = { duration: AH.morphDur, easing: AH.morphEase };

    /* ---- WHY THE ROOT'S HEIGHT IS NOT ALWAYS ANIMATED ------------------
       When the root ends the morph OUT of the flow — the catalog layer's
       tools, or the collection bar while it is still `position:fixed` —
       animating its height costs nothing: no other box depends on it.

       When it ends IN the flow, its height IS the document's height, and
       animating it animates the document for the whole 340ms. Measured on
       index.html#avtomobili releasing from the condensed state: the document
       collapsed 3851 -> 3765 on the first frame and then crawled back over
       28 frames, and the browser dragged the reader's scroll from 345 to
       269 and back again. That is the "text shifts and layout instability"
       the bar was accused of, and no amount of retiming fixes it, because
       the problem is not the timing — it is that a growing box in the flow
       IS a growing document.

       So the box snaps and the CONTENTS carry the motion. That is what a
       FLIP is for: every part below plays from exactly where it was, so the
       eye follows the type, which is gliding, and not the background edge,
       which is already home. The document height changes once, in the same
       frame the caller swaps the spacer, and the two cancel exactly. */
    var inFlow = (function () {
      for (var n = root; n && n.nodeType === 1; n = n.parentElement) {
        if (getComputedStyle(n).position === "fixed") return false;
      }
      return true;
    })();
    if (!inFlow && Math.abs(h1 - h0) > 0.5) {
      root.animate([{ height: h0 + "px" }, { height: h1 + "px" }], o);
    }
    kids.forEach(function (k, i) {
      var dx = a[i].left - b[i].left, dy = a[i].top - b[i].top;
      var dw = a[i].width - b[i].width;
      var moved = Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5;
      if (!moved && Math.abs(dw) < 1) return;
      var from = { transform: "translate(" + dx + "px," + dy + "px)" };
      var to = { transform: "translate(0,0)" };
      /* width is the one non-transform property worth paying for here: the
         search field goes 520 -> 260 in place, so a pure translate would
         leave it snapping its box while everything else glides */
      if (Math.abs(dw) > 1) { from.width = a[i].width + "px"; to.width = b[i].width + "px"; }
      k.animate([from, to], o);
    });
  };

  /* live numbers, so copy can never drift from the inventory */
  all("[data-count]").forEach(function (el) {
    el.textContent = AH.countOf(el.getAttribute("data-count"));
  });

  /* ============================================================
     1. HERO STAGE
     ============================================================ */
  var stage = document.querySelector(".stage");
  var slides = all(".stage-item");
  if (slides.length) {
    var cur = $("pag-cur"), curA11y = $("pag-cur-a11y"), tot = $("pag-tot"), range = $("pag-range");
    var prev = $("pag-prev"), next = $("pag-next");
    /* source: autoslide-duration="10" — verified live at 10055 / 10021ms.
       At 7s the eye never finishes reading a frame before it moves. */
    var i = 0, timer = 0, DUR = 10000, hovering = false, onScreen = true;

    if (tot) tot.textContent = String(slides.length);
    if (range) {
      range.max = String(slides.length); range.value = "1";
      /* source styles the THUMB as a --visible-fraction-wide bar (1/8) */
      range.style.setProperty("--visible-fraction", String(1 / slides.length));
    }

    /* ---- odometer -------------------------------------------------------
       Source renders the position as a clipped strip of digits and rolls it
       from the old value to the new one, descending. The keyframe ends at
       translateY(0), i.e. showing the FIRST child, so the strip is built
       new-first. Collapsed back to a single digit once it has settled. */
    var cntD = cur ? cur.querySelector(".cnt-d") : null, rollT = 0;
    var roll = function (to, from) {
      if (curA11y) curA11y.textContent = String(to);
      if (!cntD) return;
      var N = slides.length, snap = function () {
        cntD.innerHTML = "<span>" + to + "</span>";
      };
      if (reduce || to === from || N < 2 || to > 9 || from > 9) return snap();
      /* THE WHEEL'S CYCLE IS THE SLIDE COUNT, not base ten. This stepped the
         strip with (d + 9) % 10, which is right for an odometer and wrong for
         a carousel: with three slides, wrapping 3 -> 1 rolled 3,4,5,6,7,8,9,0,1
         — six numbers this carousel can never be on, and a zero. Walking back
         through 1..N instead makes that same wrap two digits, 3 -> 1, and no
         reachable position is ever skipped. */
      var strip = [to], d = to, guard = 0, ok = true;
      while (d !== from) {
        if (guard++ >= N) { ok = false; break; }   /* `from` outside 1..N */
        d = d > 1 ? d - 1 : N;
        if (d > 9) { ok = false; break; }          /* the strip clips one glyph */
        strip.push(d);
      }
      if (!ok) return snap();
      cntD.innerHTML = strip.map(function (x) { return "<span>" + x + "</span>"; }).join("");
      cur.classList.remove("is-rolling");
      void cur.offsetWidth;                       /* restart the animation */
      cur.classList.add("is-rolling");
      clearTimeout(rollT);
      rollT = setTimeout(function () {
        cur.classList.remove("is-rolling");
        cntD.innerHTML = "<span>" + to + "</span>";
      }, 2000);
    };

    /* ---- slide state ----------------------------------------------------
       Three states, never two: the leaving frame keeps travelling to
       scale .8 while the arriving one settles from 1.2 to 1. Everything
       else rests at the upcoming state (invisible), so the stack always
       moves one way and nothing ever pops back. */
    /* ---- slide loading -------------------------------------------------
       Eight slides carry sixteen photographs, and every one of them sits in
       the viewport (the stack is absolutely positioned), so `loading=lazy`
       does nothing — the browser fetched all sixteen originals on load. That
       was 18MB before a single pixel of the page was usable.

       Only the first slide ships a real `src`. The rest carry `data-src` and
       are promoted one step ahead of the carousel, so the next frame is
       always decoded before it is needed and nothing else is ever fetched. */
    var prime = function (n) {
      var s = slides[((n % slides.length) + slides.length) % slides.length];
      if (!s || s.getAttribute("data-primed")) return;
      s.setAttribute("data-primed", "1");
      /* the <source> has to be primed BEFORE the <img>: setting img.src is what
         makes the browser resolve the picture, and a <source> still holding
         only data-srcset at that moment is an empty candidate list, so the
         slide would silently fall back to the JPEG for its whole life */
      all("source[data-srcset]", s).forEach(function (so) {
        so.setAttribute("srcset", so.getAttribute("data-srcset"));
        so.removeAttribute("data-srcset");
      });
      all("img[data-src]", s).forEach(function (im) {
        var set = im.getAttribute("data-srcset");
        if (set) im.setAttribute("srcset", set);
        im.src = im.getAttribute("data-src");
        im.removeAttribute("data-src");
      });
    };

    var paint = function (from) {
      prime(i); prime(i + 1);                 /* current, and the one after */
      slides.forEach(function (s, n) {
        s.classList.toggle("is-active", n === i);
        s.classList.toggle("is-past", from !== undefined && n === from && n !== i);
        /* Invisible slides must leave the tab order and the a11y tree.
           Without this a keyboard user tabs through 14 links they cannot
           see, and a screen reader announces eight competing headlines. */
        if (n === i) s.removeAttribute("inert"); else s.setAttribute("inert", "");
      });
      if (range) range.value = String(i + 1);
      if (prev) prev.disabled = i === 0;
      if (next) next.disabled = i === slides.length - 1;
    };
    var go = function (n, user) {
      var len = slides.length, from = i;
      n = ((n % len) + len) % len;
      if (n === i) return;
      i = n;
      paint(from);
      roll(i + 1, from + 1);
      if (user) restart();
    };
    var restart = function () {
      clearInterval(timer);
      if (reduce || hovering || !onScreen) return;
      timer = setInterval(function () { go(i + 1); }, DUR);
    };

    if (prev) prev.addEventListener("click", function () { go(i - 1, true); });
    if (next) next.addEventListener("click", function () { go(i + 1, true); });
    if (range) range.addEventListener("input", function () { go(parseInt(range.value, 10) - 1, true); });
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) clearInterval(timer); else restart();
    });
    /* hovering the stage holds the frame; nothing slides out from under the
       pointer while someone is reading it */
    if (stage && !coarse) {
      stage.addEventListener("pointerenter", function () { hovering = true; clearInterval(timer); });
      stage.addEventListener("pointerleave", function () { hovering = false; restart(); });
    }
    /* and it does no work at all once it has scrolled away */
    if (stage && "IntersectionObserver" in window) {
      new IntersectionObserver(function (e) {
        onScreen = e[0].isIntersecting;
        if (onScreen) restart(); else clearInterval(timer);
      }, { threshold: 0 }).observe(stage);
    }
    paint();
    restart();

    /* ---- entrance gate --------------------------------------------------
       Source holds the whole choreography paused until the hero frame has
       decoded (animation-play-state), with a 4s step-end keyframe as the
       fallback. The CSS carries the fallback; this is the fast path. */
    if (stage) {
      var heroImg = stage.querySelector('.stage-item[data-i="0"] .stage-media img');
      var arm = function () {
        stage.classList.add("is-ready");
        /* the entrance runs 3.6s at most; after that a standing will-change
           is just a retained layer, so hand the memory back */
        setTimeout(function () { stage.classList.add("is-settled"); }, 4200);
      };
      if (!heroImg || heroImg.complete) arm();
      else {
        heroImg.addEventListener("load", arm);
        heroImg.addEventListener("error", arm);
        setTimeout(arm, 4000);
      }
    }
  }

  /* ============================================================
     2. CARD WALL — drag scroller, arrows, progress
     ============================================================ */
  var wall = $("wall-scroll");
  if (wall) {
    var bar = $("wall-bar");
    var items0 = all(".wcard-item", wall);
    var num = function (v) { var n = parseFloat(v); return isNaN(n) ? 0 : n; };

    /* ---- ONE motion spec, shared with the stylesheet ---------------------
       --wall-dur / --wall-ease in style.css drive the card's width and the
       rail's leading room; these drive the scroll that happens at the same
       time. They are the same numbers on purpose — three things moving on one
       curve for one duration read as a single gesture. The browser's own
       `behavior:"smooth"` cannot be told either, which is why the rail is
       tweened by hand: at 1824px of travel it ran 510ms against a 400ms
       growth, so the card finished opening and the rail kept sliding. */
    /* .3s linear — measured off the source frame by frame, not chosen. Fed
       through the solver rather than special-cased: cubic-bezier(0,0,1,1) IS
       linear, and keeping one code path means the curve can be retuned in one
       place if the stylesheet's ever stops agreeing with it. */
    var WALL_DUR = 300, WALL_BEZ = [0, 0, 1, 1];
    var bez = (function (p) {
      var cx = 3 * p[0], bx = 3 * (p[2] - p[0]) - cx, ax = 1 - cx - bx;
      var cy = 3 * p[1], by = 3 * (p[3] - p[1]) - cy, ay = 1 - cy - by;
      var fx = function (t) { return ((ax * t + bx) * t + cx) * t; };
      var dx = function (t) { return (3 * ax * t + 2 * bx) * t + cx; };
      return function (x) {
        var t = x, i, d;
        for (i = 0; i < 5; i++) {                  /* Newton, then bisect */
          d = dx(t); if (d < 1e-6) break;
          t -= (fx(t) - x) / d;
        }
        if (t < 0 || t > 1) { var lo = 0, hi = 1; t = x;
          for (i = 0; i < 20; i++) { if (fx(t) < x) lo = t; else hi = t; t = (lo + hi) / 2; } }
        return ((ay * t + by) * t + cy) * t;
      };
    })(WALL_BEZ);

    /* ---- cached rail geometry ------------------------------------------
       Measured once per layout rather than once per scroll event. The
       scrubber used to read scrollWidth and seven bounding boxes on every
       frame of every scroll — 120 layout reads a second while the rail was
       being dragged, for a 2px indicator. */
    var geo = { view: 0, content: 0, pitch: 0, max: 0 };
    var measure = function () {
      if (openItem) return;                       /* never measure mid-expand */
      geo.view = wall.clientWidth;
      geo.content = wall.scrollWidth;
      geo.max = Math.max(0, geo.content - geo.view);
      geo.pitch = items0.length > 1
        ? items0[1].getBoundingClientRect().left - items0[0].getBoundingClientRect().left
        : items0[0] ? items0[0].getBoundingClientRect().width : 0;
    };

    var sync = function () {
      if (!bar) return;
      var frac = geo.content ? geo.view / geo.content : 1;
      bar.style.width = Math.max(8, Math.min(100, frac * 100)) + "%";
      bar.style.transform = "translateX(" +
        (geo.max > 0 ? (wall.scrollLeft / geo.max) * ((1 / frac - 1) * 100) : 0) + "%)";
      /* `visibility:hidden` here left a 42px band of nothing under the rail.
         That was invisible when the band held seven cards and always
         overflowed; with four service cards the rail fits a desktop exactly,
         so the reserved row became permanent dead space between the rail and
         whatever follows it. [hidden] takes it out of the flow instead — the
         scrubber has nothing to report when there is nothing to scroll. */
      var wpg = wall.parentElement.querySelector(".wall-pag");
      if (wpg) {
        var wantPag = geo.max > 4;
        if (wpg.hidden === wantPag) wpg.hidden = !wantPag;
      }
    };

    /* ---- which card is framed right now -------------------------------
       With snapping on below 768 the rail always rests on a card, so the
       scrubber can report a position rather than a percentage. It reads as
       "3 of 6" rather than "somewhere along a bar", which is the difference
       between an indicator and a scrollbar. Derived from the pitch instead of
       measured, for the same reason as above. */
    var framed = -1;
    var markActive = function () {
      if (innerWidth >= 768 || !geo.pitch) return;
      var n = Math.max(0, Math.min(items0.length - 1, Math.round(wall.scrollLeft / geo.pitch)));
      if (n === framed) return;
      framed = n;
      items0.forEach(function (it, i) { it.classList.toggle("is-framed", i === n); });
    };

    /* ---- the rail's own scroll tween ------------------------------------
       Interruptible: any new tween, and any pointer touching the rail,
       abandons the one in flight rather than fighting it. */
    var tweenId = 0;
    var glide = function (to, dur) {
      var from = wall.scrollLeft, d = to - from, id = ++tweenId;
      if (reduce || !dur || Math.abs(d) < 1) { wall.scrollLeft = to; return; }
      var t0 = 0;
      var frame = function (now) {
        if (id !== tweenId) return;
        if (!t0) t0 = now;
        var t = Math.min(1, (now - t0) / dur);
        wall.scrollLeft = from + d * bez(t);
        if (t < 1) requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    };

    var onScroll = function () { sync(); markActive(); };
    wall.addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", function () { measure(); onScroll(); });
    measure(); onScroll();

    /* Below 1024 the rail snaps, so the browser owns the landing position and
       a hand-driven tween would only fight it. Above, the arrows travel on the
       same curve as everything else the rail does. */
    var step = function (dir) {
      var w = geo.pitch || 342;
      if (innerWidth < 1024) {
        wall.scrollBy({ left: dir * w, behavior: reduce ? "auto" : "smooth" });
        return;
      }
      glide(Math.max(0, Math.min(geo.max, wall.scrollLeft + dir * w * 2)), WALL_DUR + 120);
    };
    var wp = $("wall-prev"), wn = $("wall-next");
    if (wp) wp.addEventListener("click", function () { step(-1); });
    if (wn) wn.addEventListener("click", function () { step(1); });

    /* ---- EXPAND ---------------------------------------------------------
       The source keys the whole thing off an --open class on the grid item
       and lets CSS transitions do the work; the anchor's href points at the
       panel so :target still opens it with JS disabled. Same here. Only one
       card may be open, and opening a second closes the first. */
    var items = all(".wcard-item", wall);
    var openItem = null, settleT = 0, lockY = 0, locked = false;

    /* Full-screen mode below 1024 has to freeze the page behind it, but
       `overflow:hidden` on <html> alone collapses the scroll position — open a
       card 1300px down the page and you were returned to 769px on close.
       Pin the body at its current offset instead and put it back afterwards. */
    var lockScroll = function (on) {
      if (on === locked) return;
      var html = document.documentElement;
      if (on) {
        lockY = window.scrollY || window.pageYOffset || 0;
        document.body.style.top = (-lockY) + "px";
        html.classList.add("cw-open");
      } else {
        html.classList.remove("cw-open");
        document.body.style.top = "";
        window.scrollTo({ top: lockY, left: 0, behavior: "instant" });
      }
      locked = on;
    };

    /* ---- CENTRING ------------------------------------------------------
       The open card sits at exactly (railWidth - openWidth) / 2. The cards at
       either end cannot get there by scrolling alone — you cannot scroll past
       either end of a rail — so the rail is given extra room on whichever side
       is short.

       THE GEOMETRY IS COMPUTED, NEVER MEASURED, and that is the whole fix.
       Every closed card is the same width, so the rail's closed metrics are
       arithmetic: pitch = card + gutter, content = 2*pad + n*pitch. The old
       code read getBoundingClientRect() and scrollWidth instead — which is
       correct exactly once, on the first card you open from rest. Click a
       second card while the first is open and every one of those reads came
       back mid-collapse, so the centring was solved against a rail that no
       longer existed by the time the scroll landed. Measured at 1440: cards 5
       and 6 never reached centre at all, and ~420ms after the click the rail
       teleported 456px and 785px sideways as a stale timer restored padding
       out from under the scroll that depended on it. That is the "each card is
       worse than the last" the wall was accused of, and none of it survives
       arithmetic.

       Two kinds of room, and they behave differently on purpose:
         LEADING room shifts every card to the right, so it IS the movement and
           is transitioned (padding-inline-start, in the stylesheet).
         TRAILING room moves nothing — flex items lay out from the left — so it
           is applied instantly, before the scroll that needs it exists.
       They are mutually exclusive by construction: lead > 0 forces target 0. */
    var tok = function (n) { return num(getComputedStyle(wall).getPropertyValue(n)); };
    var pad = { lead: 0, trail: 0 };

    var plan = function (idx) {
      var g = tok("--gutter"), cw = tok("--card-w"), P = tok("--wall-pad");
      var openW = tok("--cw-open") + g + tok("--pw-open");
      var pitch = cw + g, view = wall.clientWidth;
      var left = P + g / 2 + idx * pitch;              /* item's left, unpadded */
      var content = P * 2 + items.length * pitch;      /* the rail, all closed  */
      var need = left - (view - openW) / 2;
      var lead = Math.max(0, -need);
      var trail = Math.max(0, need - Math.max(0, content - view));
      return { target: need + lead, lead: lead, trail: trail,
               closedMax: Math.max(0, content - view) };
    };

    /* Leading room needs no scroll compensation, because whenever it exists the
       target scroll is 0 by construction: the padding transition and the scroll
       tween are then the only two terms in the card's position, both run over
       WALL_DUR on the same curve, and a card's viewport x is therefore itself
       interpolated on that curve. Compensating for the padding immediately —
       which an earlier revision did — moved the whole rail 228px sideways on
       the frame of the click, before the transition it was compensating for had
       rendered a single pixel.

       Trailing room may GROW at once, since flex items lay out from the left
       and adding it moves nothing. It may never SHRINK at once: dropping it
       while the rail is still scrolled into it leaves scrollLeft past the new
       end and the browser resolves that in one frame. Every shrink is deferred
       to trim(), after the movement has landed. */
    var setPad = function (lead, trail) {
      var P = tok("--wall-pad");
      if (lead !== pad.lead) {
        wall.style.paddingInlineStart = lead ? (P + lead) + "px" : "";
        pad.lead = lead;
      }
      if (trail > pad.trail) {
        wall.style.paddingInlineEnd = (P + trail) + "px";
        pad.trail = trail;
      }
    };
    var trim = function (trail) {
      if (trail === pad.trail) return;
      var P = tok("--wall-pad");
      wall.style.paddingInlineEnd = trail ? (P + trail) + "px" : "";
      pad.trail = trail;
    };
    /* One settle per state change, whatever the change was. It releases the
       room the rail no longer needs and re-reads the geometry the scrubber
       works from. */
    var settle = function () {
      clearTimeout(settleT);
      settleT = setTimeout(function () {
        wall.classList.remove("is-swap");   /* the crossover is over */
        trim(openItem && innerWidth >= 1024 ? plan(items.indexOf(openItem)).trail : 0);
        measure(); onScroll();
      }, WALL_DUR + 80);
    };

    var setOpen = function (item, on, focusBack) {
      var wide = innerWidth >= 1024;
      var anchor = item.querySelector(".wcard-anchor");
      var panel = item.querySelector(".wcard-panel");
      clearTimeout(settleT);

      if (on) {
        var p = wide ? plan(items.indexOf(item)) : null;
        item.classList.add("is-open");
        openItem = item;
        if (p) { setPad(p.lead, p.trail); glide(p.target, WALL_DUR); }
        lockScroll(!wide);
        if (anchor) anchor.setAttribute("aria-expanded", "true");
        if (panel) panel.removeAttribute("inert");
        var close = item.querySelector(".wcard-close");
        if (close) { void item.offsetWidth; close.focus({ preventScroll: true }); }
        settle();
        return;
      }

      item.classList.remove("is-open");
      if (openItem === item) openItem = null;
      if (anchor) anchor.setAttribute("aria-expanded", "false");
      if (panel) panel.setAttribute("inert", "");
      if (focusBack && anchor) anchor.focus({ preventScroll: true });
      if (!openItem) lockScroll(false);

      if (wide) {
        /* Release the leading room — it rides its own transition and carries
           the rail back — and ease the scroll inside the range it will have
           once the trailing room goes, so trim() has nothing left to clamp. */
        var closedMax = plan(0).closedMax;
        setPad(0, pad.trail);
        if (wall.scrollLeft > closedMax) glide(closedMax, WALL_DUR);
        settle();
      }
    };

    items.forEach(function (item) {
      var panel = item.querySelector(".wcard-panel");
      if (panel) panel.setAttribute("inert", "");
      var anchor = item.querySelector(".wcard-anchor");
      if (anchor) anchor.addEventListener("click", function (e) {
        e.preventDefault();
        if (moved) return;                       /* swallow drag-clicks */
        if (openItem === item) return;           /* already open — do nothing */
        /* A switch is the only case where the rail must not follow the card:
           one is shrinking while the other grows, and a rail sized to the
           taller of the two sags through the crossover. See the switch floor
           in style.css. Opening from rest deliberately gets no floor. */
        if (openItem) { wall.classList.add("is-swap"); setOpen(openItem, false); }
        setOpen(item, true);
      });
      var close = item.querySelector(".wcard-close");
      if (close) close.addEventListener("click", function () { setOpen(item, false, true); });
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && openItem) setOpen(openItem, false, true);
    });

    /* ---- ARRIVING BY LINK ------------------------------------------------
       #lizing and #care used to be whole bands, and they are still linked from
       every header and every footer on the site — including a CTA that says
       "Калкулатор". They are cards on this rail now, so landing on one has to
       OPEN it; otherwise that CTA delivers a photograph of a terrace and no
       calculator anywhere on the screen.

       The scroll is deliberately instant. Below 1024 opening a card pins the
       body at whatever offset it is on, so it must never run while a smooth
       scroll is still in flight — the pin would capture a position the page
       was only passing through. */
    var wallItemFor = function (id) {
      var found = null;
      if (!id) return null;
      items.some(function (it) {
        var panel = it.querySelector(".wcard-panel");
        if (it.id === id || (panel && panel.id === id)) { found = it; return true; }
        return false;
      });
      return found;
    };
    var revealItem = function (item) {
      item.scrollIntoView({ block: "center", behavior: "instant" });
      requestAnimationFrame(function () {
        if (openItem === item) return;
        if (openItem) { wall.classList.add("is-swap"); setOpen(openItem, false); }
        setOpen(item, true);
      });
    };
    document.addEventListener("click", function (e) {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button > 0) return;
      var a = e.target.closest && e.target.closest('a[href^="#"]');
      if (!a || a.closest(".wall")) return;      /* the rail owns its own anchors */
      var item = wallItemFor(a.getAttribute("href").slice(1));
      if (!item) return;
      e.preventDefault();
      if (history.replaceState) history.replaceState(null, "", a.getAttribute("href"));
      revealItem(item);
    });
    addEventListener("hashchange", function () {
      var item = wallItemFor(location.hash.slice(1));
      if (item) revealItem(item);
    });
    /* on arrival from another page, after the entrance has stopped moving
       things around underneath the scroll this is about to take */
    if (location.hash) addEventListener("load", function () {
      var item = wallItemFor(location.hash.slice(1));
      if (item) setTimeout(function () { revealItem(item); }, 150);
    });
    /* Crossing the 1024 line while a card is open would leave it half in one
       mode and half in the other — inline-expanded geometry with a full-screen
       stylesheet, or centring room the new breakpoint never asked for. Close
       it instead; a resize mid-interaction is rare and a clean state is worth
       more than preserving it. */
    var lastW = innerWidth;
    addEventListener("resize", function () {
      var crossed = (lastW < 1024) !== (innerWidth < 1024);
      lastW = innerWidth;
      if (openItem && crossed) { setOpen(openItem, false); setPad(0, 0); }
      lockScroll(!!openItem && innerWidth < 1024);
    });

    if (!coarse) {
      var down = false, sx = 0, sl = 0, moved = false;
      wall.addEventListener("pointerdown", function (e) {
        if (e.pointerType !== "mouse" || e.button !== 0) return;
        tweenId++;                                 /* the hand wins over any tween */
        down = true; moved = false; sx = e.clientX; sl = wall.scrollLeft;
        /* source: .bm-state-dragging drops scroll-behavior AND snapping,
           so the rail tracks the pointer 1:1 instead of fighting the snap */
        wall.classList.add("is-dragging");
      });
      wall.addEventListener("pointermove", function (e) {
        if (!down) return;
        var d = e.clientX - sx;
        if (Math.abs(d) > 4) moved = true;
        wall.scrollLeft = sl - d;
      });
      var up = function () { down = false; wall.classList.remove("is-dragging"); };
      wall.addEventListener("pointerup", up);
      wall.addEventListener("pointercancel", up);
      wall.addEventListener("pointerleave", up);
      /* swallow the click that ends a drag */
      wall.addEventListener("click", function (e) {
        if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; }
      }, true);
    }
  }

  /* ============================================================
     2b. IMAGE DISSOLVE
     Source fades every photo in over .2s as it decodes. The hero frame is
     excluded — it has its own 3.6s brightness entry and gates the whole
     choreography. Any image that errors or is still pending after 6s is
     shown regardless, so nothing can be left invisible.
     ============================================================ */
  all(".wcard-photo img, .teaser-bg img, .cta-img img").forEach(function (im) {
    im.classList.add("fade-img");
    var done = function () { im.classList.add("is-loaded"); };
    if (im.complete && im.naturalWidth) { done(); return; }
    im.addEventListener("load", done);
    im.addEventListener("error", done);
    setTimeout(done, 6000);
  });

  /* ============================================================
     3. REVEALS
     ============================================================ */
  /* The card wall reveals as ONE group, keyed off the rail rather than the
     individual cards. The source creates all six card animations the moment
     the wall enters view — including the two parked off-screen to the right.
     Observing each card separately left those at opacity 0 until the rail was
     dragged, so a drag uncovered empty slots that then faded in behind the
     pointer. `data-reveal-kids` lets the same observer drive both patterns. */
  var wallRail = $("wall-scroll");
  if (wallRail) wallRail.setAttribute("data-reveal-kids", ".wcard-item");

  /* ---- MASKED LINES ----------------------------------------------------
     The band fading up is the generic half of a reveal; the part that reads
     as printed rather than as animated is the display line rising out from
     behind its own edge. That needs two boxes — one to clip and one to
     travel — and the markup only has one, so the line's own children are
     moved into a span here rather than in four HTML files.

     Only the display lines, and only inside a reveal: a masked paragraph is
     a gimmick, and a mask on anything that can hold a position:fixed
     descendant is a bug waiting to happen. --i carries the running index so
     the eyebrow leads and the headline follows, which is the whole point of
     doing it per line instead of per band. */
  var LINES = ".teaser-eyebrow,.teaser-headline,.csec__h,.cta-text > h2";
  if (!reduce) {
    all("[data-reveal]").forEach(function (root) {
      all(LINES, root).forEach(function (el, i) {
        if (el.__rvl || !el.firstChild) return;
        el.__rvl = 1;
        var line = document.createElement("span");
        line.className = "rv-l";
        while (el.firstChild) line.appendChild(el.firstChild);
        el.appendChild(line);
        el.classList.add("rv-mask");
        el.style.setProperty("--i", i);
      });
    });
  }

  var revealables = all("[data-reveal]").concat(wallRail ? [wallRail] : []);
  var show = function (el) {
    el.classList.add("is-in");
    var kids = el.getAttribute && el.getAttribute("data-reveal-kids");
    if (kids) all(kids, el).forEach(function (c) { c.classList.add("is-in"); });
  };
  if (reduce || !("IntersectionObserver" in window)) {
    revealables.forEach(show);
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { show(e.target); io.unobserve(e.target); } });
    /* A positive bottom margin arms the reveal slightly BEFORE the element
       reaches the fold, so the entry has finished by the time the eye gets
       there. It was -8%, which armed it late — the wall's own entry then ran
       while you were already looking at the space it was supposed to fill. */
    }, { threshold: 0.1, rootMargin: "0px 0px 12% 0px" });
    revealables.forEach(function (e) { io.observe(e); });
    /* Failsafe. The old form revealed EVERY element the moment 2.5s passed
       with nothing yet in view — which is the normal state on load, since the
       hero fills the screen. That silently burned the card wall's entry
       before anyone had scrolled to it. Only rescue what is actually on
       screen and still hidden. */
    setTimeout(function () {
      revealables.forEach(function (e) {
        if (e.classList.contains("is-in")) return;
        var r = e.getBoundingClientRect();
        if (r.top < innerHeight && r.bottom > 0) { show(e); io.unobserve(e); }
      });
    }, 2500);
  }

  /* ============================================================
     4. PARALLAX
     The source uses native scroll-driven animation:
         animation: bm-parallax linear both;
         animation-timeline: view(); animation-range: cover;
     with per-element --parallax-x/y-start/end. Where view() is
     supported the CSS does it alone and this block never runs.
     This is the fallback, reproducing the same `cover` progress:
     0 when the element's leading edge enters the scrollport,
     1 when its trailing edge leaves — travel = viewport + height.
     ============================================================ */
  var nativeTimeline = window.CSS && CSS.supports && CSS.supports("animation-timeline", "view()");
  var para = all(".teaser-decor, .cta-img");
  if (para.length && !reduce && !nativeTimeline) {
    var num = function (el, prop, dflt) {
      var v = parseFloat(getComputedStyle(el).getPropertyValue(prop));
      return isNaN(v) ? dflt : v;
    };
    var conf = para.map(function (el) {
      return { el: el,
        xs: num(el, "--px-s", 0), xe: num(el, "--px-e", 0),
        ys: num(el, "--py-s", 0), ye: num(el, "--py-e", 0),
        ss: num(el, "--ps-s", 1), se: num(el, "--ps-e", 1) };
    });
    var queued = false;
    var frame = function () {
      queued = false;
      var vh = innerHeight;
      conf.forEach(function (c) {
        var r = c.el.getBoundingClientRect();
        if (r.bottom < -100 || r.top > vh + 100) return;
        var p = (vh - r.top) / (vh + r.height);
        p = p < 0 ? 0 : p > 1 ? 1 : p;
        var x = c.xs + (c.xe - c.xs) * p;
        var y = c.ys + (c.ye - c.ys) * p;
        var s = c.ss + (c.se - c.ss) * p;
        c.el.style.transform = "translateX(" + x.toFixed(2) + "px) translateY(" + y.toFixed(2) + "px) scale(" + s.toFixed(4) + ")";
      });
    };
    addEventListener("scroll", function () {
      if (queued) return;
      queued = true; requestAnimationFrame(frame);
    }, { passive: true });
    addEventListener("resize", frame);
    frame();
  }

  /* ============================================================
     5. LEASING CONTROL (article teaser 2)
     Annuity on 80% of price at 6.9% nominal annual interest.
     Indicative only — the footer note says so.
     ============================================================ */
  var lzCar = $("lz-car"), lzOut = $("lz-out");
  if (lzCar && lzOut) {
    var RATE = 0.069, DEPOSIT = 0.2, term = 60;
    /* Was eight hard-coded cars. Now the priced part of the real collection,
       most expensive first — so the calculator can never quote a car that
       has been sold, and never miss one that has just arrived. */
    var cars = V.filter(function (v) { return v.price; })
      .sort(function (a, b) { return b.price - a.price; })
      .map(function (v) { return [v.full, v.price]; });
    if (!cars.length) cars = [["Porsche 911 Targa 4 GTS", 142000]];
    lzCar.innerHTML = "";
    cars.forEach(function (c) {
      var o = document.createElement("option");
      o.value = String(c[1]);
      o.textContent = c[0] + " — " + fmt(c[1]) + " €";
      lzCar.appendChild(o);
    });
    var recalc = function () {
      var price = parseInt(lzCar.value, 10) || 0;
      var fin = price * (1 - DEPOSIT), r = RATE / 12;
      var pay = fin * r / (1 - Math.pow(1 + r, -term));
      lzOut.textContent = "≈ " + fmt(pay) + " € / месец";
    };
    all(".lz-term").forEach(function (b) {
      b.addEventListener("click", function () {
        term = parseInt(b.dataset.term, 10) || 60;
        all(".lz-term").forEach(function (o) {
          var on = o === b;
          o.classList.toggle("is-on", on);
          o.setAttribute("aria-pressed", on ? "true" : "false");
        });
        recalc();
      });
    });
    lzCar.addEventListener("change", recalc);
    recalc();
  }

  /* ============================================================
     6. HEADER + MOBILE NAV
     ============================================================ */
  /* No sticky-header logic on purpose: the source header is position:absolute
     at every scroll offset (verified 0→3600 and on scroll-up), so it simply
     scrolls away with the hero. */
  var mbtn = $("hd-menu"), mob = $("mob"), mclose = $("mob-close");
  /* The brand plate carries a second Меню trigger, because below the hero the
     header — and with it the burger — has scrolled away. Both triggers drive
     the one overlay and both have to carry its aria-expanded, or a screen
     reader is told the menu is shut by whichever button was not pressed. */
  var mtriggers = [mbtn, $("plate-menu")].filter(Boolean);
  if (mtriggers.length && mob && mclose) {
    var last = null, mobY = 0;
    /* `body.style.overflow = "hidden"` reads as a scroll lock and behaves as a
       scroll RESET: the body's overflow is what propagates to the viewport
       here, so hiding it makes the viewport non-scrollable and the offset is
       clamped. Measured: open the menu 900px down, close it, land at 461.
       Pin the body at its offset instead, as every other layer does. */
    var lockMob = function (on) {
      var html = document.documentElement;
      if (on) {
        mobY = window.scrollY || window.pageYOffset || 0;
        document.body.style.top = (-mobY) + "px";
        html.classList.add("mob-open");
      } else {
        html.classList.remove("mob-open");
        document.body.style.top = "";
        window.scrollTo({ top: mobY, left: 0, behavior: "instant" });
      }
    };
    var setMob = function (open) {
      mob.classList.toggle("is-open", open);
      mob.setAttribute("aria-hidden", open ? "false" : "true");
      mtriggers.forEach(function (t) {
        t.setAttribute("aria-expanded", open ? "true" : "false");
      });
      /* out of the tab order entirely while closed, so the trap below is the
         only thing that has to hold and not the last line of defence */
      if (open) mob.removeAttribute("inert"); else mob.setAttribute("inert", "");
      lockMob(open);
      if (open) {
        last = document.activeElement;
        void mob.offsetWidth;                  /* flush the class before focusing */
        mclose.focus({ preventScroll: true });
      } else {
        /* Fall back to the trigger. `last` is whatever had focus when the menu
           opened, which is the right answer for a real click — but it is
           <body> when the menu is opened any other way, and returning focus to
           <body> drops a keyboard user back at the top of the document. */
        /* whichever trigger is actually on the screen: below the hero the
           header burger is gone with the header, and focusing a node that
           scrolled away is how a keyboard user loses their place */
        var live = mtriggers.filter(function (t) {
          return t.offsetParent !== null && t.getBoundingClientRect().height > 0;
        });
        var back = (last && last !== document.body && document.contains(last))
          ? last : (live[live.length - 1] || mtriggers[0]);
        if (back) back.focus({ preventScroll: true });
        last = null;
      }
    };
    mob.setAttribute("inert", "");
    mtriggers.forEach(function (t) {
      t.addEventListener("click", function () { setMob(true); });
    });
    mclose.addEventListener("click", function () { setMob(false); });
    /* the page is visible beside the panel now, so clicking it is the most
       natural way out — and the one a modal never offered */
    var mscrim = $("mob-scrim");
    if (mscrim) mscrim.addEventListener("click", function () { setMob(false); });
    all("nav a", mob).forEach(function (a) { a.addEventListener("click", function () { setMob(false); }); });
    document.addEventListener("keydown", function (e) {
      if (!mob.classList.contains("is-open")) return;
      if (e.key === "Escape") { setMob(false); return; }
      /* The catalog and the lightbox both trap Tab; this one never did, so a
         keyboard user tabbed straight out of the open menu and into the page
         it was covering — measured escaping to ah-skip, hd-menu, hd-logo. */
      if (e.key !== "Tab") return;
      var f = all("a[href],button:not([disabled])", mob).filter(function (el) {
        return el.offsetWidth || el.offsetHeight || el.getClientRects().length;
      });
      if (!f.length) return;
      var first = f[0], lastF = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); lastF.focus(); }
      else if (!e.shiftKey && document.activeElement === lastF) { e.preventDefault(); first.focus(); }
    });
  }

  /* ---- THE BRAND PLATE ------------------------------------------------
     Armed by the hero itself rather than by a scroll offset. `isIntersecting`
     goes false only once the whole stage is above the viewport, which is
     exactly "after the hero banner" at every height — and the hero is taller
     than the screen on a phone and shorter on a desktop, so any hard-coded
     threshold would be wrong on one of them.

     An observer, not a scroll listener: the plate is `position:fixed`, so
     showing it changes no layout and there is no risk of the toggle feeding
     back into its own trigger the way a sticky bar's can. */
  var plate = $("plate");
  if (plate) {
    /* index arms off the hero; collection and legal arm off their own
       masthead — in both cases the trigger is "the thing at the top of this
       page has gone", which is the only moment the plate is needed.

       The concierge room cannot use either: its masthead is a STICKY rail
       that never leaves the screen, so observing it would mean the plate
       never arrives and everything below the absolute header would be left
       with no mark and no menu. It supplies a zero-width strip the height
       of the header instead (.cgr__sentinel, sized off --cg-top, which is
       what clears that header anyway), so the moment is identical to the
       other three pages without depending on anything that scrolls. */
    var plateAfter = document.querySelector(".stage") ||
                     document.querySelector(".cgr__sentinel") ||
                     document.querySelector(".phead") ||
                     document.querySelector(".hd");
    /* Anything else fixed to the top of the page needs to know, because the
       plate is now above it. One custom property on <html> rather than a
       class per component: the filter bar reads --plate-top and nothing else
       has to be taught about the plate. */
    var armPlate = function (on) {
      plate.classList.toggle("is-on", on);
      document.documentElement.style.setProperty(
        "--plate-top", on ? "var(--plate-h)" : "0px");
    };
    AH.armPlate = armPlate;

    /* ---- ONE STACK, ONE TRIGGER ----------------------------------------
       A page with a pinning tools bar has TWO fixed things at the top, and
       the bar's offset is the plate's height. Given two separate triggers
       they fire at two different scroll positions, and on index.html#avtomobili
       they did: measured at 1440, the bar pinned at y=325 with --plate-top
       still 0, and the plate did not arrive until y=387 — at which point it
       shoved the already-pinned bar down its own 62px, in one frame, under
       the reader's eyes. Retiming cannot fix that; the two states have to be
       the same state.

       So where a tools bar exists, IT owns the moment: collection.js calls
       AH.armPlate() inside the same synchronous mutation that pins the bar,
       and the plate is never armed by anything else. The top of the page is
       then only ever "nothing fixed" or "plate and bar together". */
    var ownedByTools = !!document.getElementById("f-sentinel");
    if (!ownedByTools) {
      if (!plateAfter || !("IntersectionObserver" in window)) {
        armPlate(true);
      } else {
        new IntersectionObserver(function (en) {
          armPlate(!en[0].isIntersecting);
        }, { threshold: 0 }).observe(plateAfter);
      }
    }
  }

  /* ============================================================
     7. VEHICLE PAGE — lightbox + sticky CTA (legacy)
     ============================================================ */
  var rvs = all(".rv");
  if (rvs.length) {
    if (reduce || !("IntersectionObserver" in window)) {
      rvs.forEach(function (e) { e.classList.add("in"); });
    } else {
      var io2 = new IntersectionObserver(function (en) {
        en.forEach(function (x) { if (x.isIntersecting) { x.target.classList.add("in"); io2.unobserve(x.target); } });
      }, { threshold: 0.1, rootMargin: "0px 0px -8% 0px" });
      rvs.forEach(function (e) { io2.observe(e); });
      setTimeout(function () {
        if (!document.querySelector(".rv.in")) rvs.forEach(function (e) { e.classList.add("in"); });
      }, 2500);
    }
  }

  var gallery = $("gallery"), lb = $("lb");
  if (gallery && lb) {
    var shots = all("img", gallery), lbImg = $("lb-img"), li = 0, opener = null;
    var openLb = function (n) {
      li = (n + shots.length) % shots.length;
      lbImg.src = shots[li].getAttribute("data-full") || shots[li].src;
      lbImg.alt = shots[li].alt;
      lb.classList.add("open");
      document.body.style.overflow = "hidden";
      /* the dialog is visibility-hidden until the class lands, and nothing
         inside a visibility:hidden subtree can take focus. Reading a layout
         property flushes the style change synchronously so the close button
         is focusable on this very line; without it focus stayed on the
         thumbnail and the tab trap had nothing to hold. */
      void lb.offsetWidth;
      $("lb-close").focus();
    };
    var closeLb = function () {
      lb.classList.remove("open");
      document.body.style.overflow = "";
      if (opener) { opener.focus(); opener = null; }
    };
    all("button", gallery).forEach(function (b, k) {
      b.addEventListener("click", function () { opener = b; openLb(k); });
    });
    $("lb-close").addEventListener("click", closeLb);
    $("lb-prev").addEventListener("click", function () { openLb(li - 1); });
    $("lb-next").addEventListener("click", function () { openLb(li + 1); });
    lb.addEventListener("click", function (e) { if (e.target === lb) closeLb(); });
    document.addEventListener("keydown", function (e) {
      if (!lb.classList.contains("open")) return;
      if (e.key === "Escape") { closeLb(); return; }
      if (e.key === "ArrowRight") { openLb(li + 1); return; }
      if (e.key === "ArrowLeft") { openLb(li - 1); return; }
      if (e.key === "Tab") {
        var f = lb.querySelectorAll("button");
        if (!f.length) return;
        var first = f[0], lastB = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); lastB.focus(); }
        else if (!e.shiftKey && document.activeElement === lastB) { e.preventDefault(); first.focus(); }
      }
    });
  }

  /* The sticky CTA appears once the hero is behind you and retracts again as
     soon as the footer is in view — otherwise it sat on top of the footer's
     own links all the way to the bottom of the page, which is the sort of
     thing that reads as unfinished. */
  var sticky = $("vd-sticky");
  if (sticky) {
    var foot = document.querySelector(".foot");
    var queuedStick = false;
    var onStick = function () {
      queuedStick = false;
      var past = scrollY > innerHeight * 0.5;
      var footerUp = foot ? foot.getBoundingClientRect().top < innerHeight - 40 : false;
      sticky.classList.toggle("show", past && !footerUp);
    };
    addEventListener("scroll", function () {
      if (queuedStick) return;
      queuedStick = true; requestAnimationFrame(onStick);
    }, { passive: true });
    addEventListener("resize", onStick);
    onStick();
  }

  /* ============================================================
     8. QUICK LOOK  (added in v35)
     The card-wall expand, lifted off the rail. Same white panel, same
     .3s linear geometry, same 250ms-delayed content fade — so opening a
     car from the collection grid feels like opening a card on the wall.
     ============================================================ */
  var focus = $("focus");
  if (focus) {
    var fMain = focus.querySelector(".focus-media img");
    var fThumbs = focus.querySelector(".focus-thumbs");
    var fBody = focus.querySelector(".focus-body");
    var fCar = null, fShot = 0, fOpener = null;

    var paintShot = function () {
      /* the panel is at most ~660px wide, so 800 is already retina there */
      fMain.src = img(fCar.shots[fShot], 800);
      fMain.srcset = srcset(fCar.shots[fShot], [768, 800]);
      fMain.sizes = "(min-width:1024px) 56vw, 100vw";
      fMain.alt = fCar.full + " — кадър " + (fShot + 1);
      all("button", fThumbs).forEach(function (b, n) { b.classList.toggle("is-on", n === fShot); });
    };

    AH.openFocus = function (id, opener) {
      var v = AH.byId(id); if (!v) return;
      fCar = v; fShot = 0; fOpener = opener || null;

      fThumbs.innerHTML = v.shots.map(function (s, n) {
        return '<button type="button" aria-label="Кадър ' + (n + 1) + '">' +
          '<img loading="lazy" decoding="async" width="260" height="160" src="' + img(s, 260) + '" alt=""></button>';
      }).join("");
      all("button", fThumbs).forEach(function (b, n) {
        b.addEventListener("click", function () { fShot = n; paintShot(); });
      });

      var l = lease(v.price, 60);
      fBody.innerHTML = '' +
        '<p class="focus-label">' + v.ref + " · " + esc(v.make) + "</p>" +
        '<h2 class="focus-h">' + esc(v.model) + "</h2>" +
        '<dl class="focus-spec body-s">' +
          "<div><dt>Първа регистрация</dt><dd>" + (v.unreg ? "Нерегистриран" : yrTxt(v)) + "</dd></div>" +
          "<div><dt>Пробег</dt><dd>" + kmTxt(v.km) + "</dd></div>" +
          "<div><dt>Мощност</dt><dd>" + v.hp + " к.с.</dd></div>" +
          "<div><dt>Двигател</dt><dd>" + FUEL[v.fuel] + "</dd></div>" +
          "<div><dt>Скоростна кутия</dt><dd>" + (v.gear === "manual" ? "Ръчна" : "Автоматична") + "</dd></div>" +
          "<div><dt>Цвят</dt><dd>" + esc(v.colour || "—") + "</dd></div>" +
        "</dl>" +
        (v.price == null
          ? '<p class="focus-price">Цена при запитване</p>' +
            '<p class="body-s focus-note">Този автомобил се предлага дискретно. Цената се съобщава при заявка.</p>'
          : '<p class="focus-price">' + priceTxt(v.price) + "</p>" +
            '<p class="body-s focus-note">Лизинг от ' + fmt(l) + " € / месец при 20% първоначална вноска.</p>") +
        '<div class="btn-group focus-cta">' +
          '<a class="btn btn--s btn--primary" href="' + AH.vehicleUrl(v) + '"><span class="btn__label">Пълно досие</span></a>' +
          '<a class="btn btn--s btn--secondary" href="' + AH.conciergeUrl({ v: v.id }) + '"><span class="btn__label">Запитване</span></a>' +
        "</div>";

      paintShot();
      focus.classList.add("is-open");
      focus.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
      void focus.offsetWidth;                      /* flush so focus() lands */
      focus.querySelector(".focus-close").focus();
    };

    var closeFocus = function () {
      focus.classList.remove("is-open");
      focus.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
      if (fOpener) { fOpener.focus(); fOpener = null; }
    };
    focus.querySelector(".focus-close").addEventListener("click", closeFocus);
    focus.addEventListener("click", function (e) { if (e.target === focus) closeFocus(); });
    document.addEventListener("keydown", function (e) {
      if (!focus.classList.contains("is-open")) return;
      if (e.key === "Escape") { closeFocus(); return; }
      if (e.key === "ArrowRight" && fCar) { fShot = (fShot + 1) % fCar.shots.length; paintShot(); }
      if (e.key === "ArrowLeft" && fCar) { fShot = (fShot - 1 + fCar.shots.length) % fCar.shots.length; paintShot(); }
      if (e.key === "Tab") {
        var f = focus.querySelectorAll('a[href],button:not([disabled])');
        if (!f.length) return;
        var a = f[0], z = f[f.length - 1];
        if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
        else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
      }
    });
    /* delegated — the grid renders its cards after this runs */
    document.addEventListener("click", function (e) {
      var b = e.target.closest && e.target.closest("[data-look]");
      if (!b) return;
      e.preventDefault();
      AH.openFocus(b.getAttribute("data-look"), b);
    });
  }

  /* the page scripts call this once they have rendered cards */
  AH.rendered = function (root) {
    all("img", root || document).forEach(function (im) {
      if (im.classList.contains("fade-img")) return;
      im.classList.add("fade-img");
      var done = function () { im.classList.add("is-loaded"); };
      if (im.complete && im.naturalWidth) { done(); return; }
      im.addEventListener("load", done);
      im.addEventListener("error", done);
      setTimeout(done, 6000);
    });
  };
})();
