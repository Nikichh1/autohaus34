/* ============================================================
   AUTOHAUS — THE DISCOVERY PREVIEW + THE EXPANDING CATALOG LAYER  (v41)

   Two halves of one idea, and the idea is JamesEdition's: a landing page
   whose job is discovery, and a catalog that is a room rather than a page.

   1. THE PREVIEW (in the flow of index.html)
      · "Разгледай по марка" — their Popular Makes row.
      · "Колекцията" — their Trending grid, but live: the same pill row, the
        same count-and-sort line and the same .lc card the catalog uses.
      The pills here do not filter in place. The preview is a doorway; the
      layer is the room. Filtering in place would answer the question and
      leave the reader on a landing page with six cars on it.

   2. THE LAYER (.cat, over everything)
      Same .cgrid, same .lc, same column count as the preview — so opening
      it reads as that section growing rather than a second page arriving.
      The page behind does not unload: it is pinned and recedes, and closing
      returns the reader to the exact pixel they left.

   Everything here goes through the AH engine (catalog.js + main.js). There
   is no second definition of "matches", "sorts" or "how a card looks"
   anywhere in this file — the preview, the layer and index.html#avtomobili must
   never be able to give different answers to the same question.
   ============================================================ */
(function () {
  "use strict";
  var D = document, AH = window.AH;
  if (!AH || !AH.all || !AH.all.length || !AH.card) return;

  /* their "Next" page is one screen of results; 12 keeps a 2-, 3- and
     4-column grid whole, which 10 does not */
  var PAGE = 12;
  var PREVIEW = 6;        /* their Trending grid is six cards */

  var $ = function (id) { return D.getElementById(id); };
  var all = function (sel, root) {
    return Array.prototype.slice.call((root || D).querySelectorAll(sel));
  };

  var PLURAL = function (n) { return n + " " + AH.plural(n); };

  /* ============================================================
     1. THE INSTRUMENT

     What was here: one gold "Филтри" pill, four marque pills out of
     fourteen, and everything else — the other ten marques, price, year,
     mileage, engine, chapter — behind a 400px drawer that slid in from the
     left and rendered its chips in white on paper, i.e. invisible. A buyer
     who wanted an Audi could not see that Audi existed, and a buyer who
     opened the drawer to find out could not read it.

     What it is now: eight NAMED CONTROLS in one row, each opening a panel
     under itself. A control states its own question when empty ("Марка")
     and its own answer when set ("Mercedes-Benz"), which is what keeps
     eight of them inside 720px — narrower than the four pills they replace
     were. Every filter this collection can answer is visible as a word
     before anything is clicked; nothing is hidden behind a count.

     ONE renderer, three surfaces. `panelBody(kind)` returns the inside of a
     control's panel, and it is used verbatim by the dropdown at 900+ and by
     the stacked sheet below it. A filter cannot behave differently
     depending on the width of the screen it is read on, because there is
     only one description of it.
     ============================================================ */

  var B = AH.catalogBounds;

  /* The controls, in the order a buyer at this value actually narrows:
     whose, then how much, then how new, then how far it has been, then how
     hard it pulls, then what it drinks, then which shelf of the room. */
  var CONTROLS = [
    { key: "make",    label: "Марка",    kind: "list" },
    { key: "model",   label: "Модел",    kind: "list", dependent: true },
    { key: "price",   label: "Цена",     kind: "range", unit: "€",     group: 1,
      min: B.price[0], max: B.price[1], step: 1000, sMin: "priceMin", sMax: "priceMax" },
    { key: "year",    label: "Година",   kind: "range", unit: "",      group: 0,
      min: B.year[0],  max: B.year[1],  step: 1,    sMin: "yearMin",  sMax: "yearMax" },
    { key: "km",      label: "Пробег",   kind: "range", unit: "км",    group: 1,
      min: B.km[0],    max: B.km[1],    step: 1000, sMin: "kmMin",    sMax: "kmMax" },
    { key: "hp",      label: "Мощност",  kind: "range", unit: "к.с.",  group: 0,
      min: B.hp[0],    max: B.hp[1],    step: 10,   sMin: "hpMin",    sMax: "hpMax" },
    { key: "fuel",    label: "Двигател", kind: "list" },
    { key: "chapter", label: "Раздел",   kind: "list" }
  ];
  var BY_KEY = {};
  CONTROLS.forEach(function (c) { BY_KEY[c.key] = c; });

  function fmtNum(C, n) { return C.group ? AH.fmt(n) : String(n); }
  function fmtVal(C, n) { return fmtNum(C, n) + (C.unit ? " " + C.unit : ""); }

  /* what the control says on its face: its question, or its answer */
  function valueOf(S, C, O) {
    if (C.kind === "list") {
      if (C.key === "make") return S.make || "";
      if (C.key === "model") return S.model || "";
      if (C.key === "fuel") {
        var f = (O.fuels || []).filter(function (x) { return x.key === S.fuel; })[0];
        return f ? f.name : "";
      }
      if (C.key === "chapter") {
        var c = (O.chapters || []).filter(function (x) { return x.key === S.chapter; })[0];
        return c ? c.name : "";
      }
      return "";
    }
    var lo = S[C.sMin], hi = S[C.sMax];
    if (lo == null && hi == null) return "";
    if (lo != null && hi != null) return fmtNum(C, lo) + "–" + fmtVal(C, hi);
    if (lo != null) return "от " + fmtVal(C, lo);
    return "до " + fmtVal(C, hi);
  }

  var CARET = '<svg class="fsel__c" viewBox="0 0 12 8" aria-hidden="true">' +
    '<path d="M1,2 L6,7 L11,2"/></svg>';

  /* ---- the row ---------------------------------------------------------- */
  function barHTML(S) {
    var h = [];
    if (!mqRail.matches) {
      /* one control, and it opens all of them */
      var n = AH.filterBadge(S);
      h.push('<button type="button" class="fsel fsel--all" data-sheet="1"' +
        ' aria-haspopup="dialog" aria-expanded="false">' +
        '<svg class="fsel__f" viewBox="0 0 16 16" aria-hidden="true">' +
          '<path d="M1,3.5 H15 M3.5,8 H12.5 M6,12.5 H10"/></svg>' +
        '<span class="fsel__t">Филтри</span>' +
        (n ? '<span class="fsel__n">' + n + "</span>" : "") + "</button>");
    } else {
      var O = AH.filterOptions(S);
      CONTROLS.forEach(function (C) {
        /* their dependent-control rule: a control that cannot yet answer
           anything is not offered. Модел needs a marque first. */
        if (C.dependent && !S.make) return;
        var val = valueOf(S, C, O);
        h.push('<button type="button" class="fsel' + (val ? " is-set" : "") + '"' +
          ' data-pop="' + C.key + '" aria-haspopup="dialog" aria-expanded="false">' +
          '<span class="fsel__t">' + AH.esc(val || C.label) + "</span>" + CARET +
          "</button>");
      });
    }
    if (AH.filterDirty(S))
      h.push('<button type="button" class="fsel fsel--clear" data-clear="1">Изчисти</button>');
    return h.join("");
  }

  /* ---- the inside of one control's panel, wherever it is shown ---------- */
  function optRows(kind, opts, cur) {
    if (!opts.length) return '<p class="fpop__none">Няма опции тук.</p>';
    return '<div class="fopts">' + opts.map(function (o) {
      var on = cur === o.key;
      return '<button type="button" class="fopt' + (on ? " is-on" : "") + '"' +
        (o.n === 0 && !on ? " disabled" : "") +
        ' aria-pressed="' + (on ? "true" : "false") + '"' +
        " data-" + kind + '="' + AH.esc(o.key) + '">' +
        '<span class="fopt__n">' + AH.esc(o.name) + "</span>" +
        (o.n != null ? '<span class="fopt__c">' + o.n + "</span>" : "") +
        '<svg class="fopt__k" viewBox="0 0 16 16" aria-hidden="true"><path d="M3,8.5 L6.5,12 L13,4.5"/></svg>' +
        "</button>";
    }).join("") + "</div>";
  }

  function rangeBody(C, S) {
    var lo = S[C.sMin] == null ? C.min : S[C.sMin];
    var hi = S[C.sMax] == null ? C.max : S[C.sMax];
    var span = C.max - C.min || 1;
    return '' +
      '<div class="frng" data-range="' + C.key + '">' +
        '<p class="frng__read"><b>' + fmtNum(C, lo) + "</b> – <b>" + fmtNum(C, hi) + "</b>" +
          (C.unit ? ' <em>' + C.unit + "</em>" : "") + "</p>" +
        '<div class="frng__track">' +
          '<i class="frng__fill" style="left:' + ((lo - C.min) / span * 100) +
            "%;width:" + ((hi - lo) / span * 100) + '%"></i>' +
          '<input type="range" class="frng__a" min="' + C.min + '" max="' + C.max +
            '" step="' + C.step + '" value="' + lo + '" aria-label="' + AH.esc(C.label) + ' — минимум">' +
          '<input type="range" class="frng__b" min="' + C.min + '" max="' + C.max +
            '" step="' + C.step + '" value="' + hi + '" aria-label="' + AH.esc(C.label) + ' — максимум">' +
        "</div>" +
        '<div class="frng__io">' +
          '<label><span>От</span><input type="text" inputmode="numeric" autocomplete="off" class="frng__ia" value="' +
            (S[C.sMin] == null ? "" : fmtNum(C, lo)) + '" placeholder="' + fmtNum(C, C.min) + '"></label>' +
          '<label><span>До</span><input type="text" inputmode="numeric" autocomplete="off" class="frng__ib" value="' +
            (S[C.sMax] == null ? "" : fmtNum(C, hi)) + '" placeholder="' + fmtNum(C, C.max) + '"></label>' +
        "</div>" +
      "</div>";
  }

  function panelBody(key, S) {
    var C = BY_KEY[key], O = AH.filterOptions(S);
    if (C.kind === "range") return rangeBody(C, S);
    if (key === "make") return optRows("make", O.makes, S.make);
    if (key === "model") return optRows("model", O.models, S.model);
    if (key === "fuel") return optRows("fuel", O.fuels, S.fuel);
    return optRows("chapter", O.chapters, S.chapter);
  }

  function sortSelect(sel, val) {
    sel.innerHTML = AH.catalogSorts.map(function (s) {
      return '<option value="' + s.key + '">' + AH.esc(s.name) + "</option>";
    }).join("");
    sel.value = val;
  }

  /* ============================================================
     2. THE PREVIEW
     ============================================================ */
  var pvMrow = $("pv-mrow"), pvBar = $("pv-bar"), pvGrid = $("pv-grid"),
      pvSort = $("pv-sort"), pvMore = $("pv-more");
  var pvSortKey = "curated";

  if (pvMrow) {
    pvMrow.innerHTML = AH.marques(14).map(function (m) {
      return AH.marqueTile(m);
    }).join("");
    if (AH.rendered) AH.rendered(pvMrow);
  }

  function paintPreview() {
    if (!pvGrid) return;
    var S = AH.newFilterState();
    S.sort = pvSortKey;
    var list = AH.filterResults(S);
    pvGrid.innerHTML = list.slice(0, PREVIEW).map(function (v, i) {
      return AH.card(v, { eager: i < 3 });
    }).join("");
    if (AH.rendered) AH.rendered(pvGrid);
  }

  /* The landing preview used to render the full pill row — every marque, then
     the chapters — above its twelve cards. Two problems, one cause: it was a
     weaker duplicate of the instrument that lives one click away, and it was
     long enough to scroll off the right edge at every width, which is what
     made the filters look broken. The preview is a SELECTION now. The count,
     the sort and "Виж всички" stay; the searching is the catalogue's job. */
  if (pvBar) pvBar.remove();
  if (pvSort) {
    sortSelect(pvSort, pvSortKey);
    pvSort.addEventListener("change", function () {
      pvSortKey = pvSort.value;
      paintPreview();
    });
  }
  if (pvMore) pvMore.textContent = "Виж всички " + PLURAL(AH.all.length);
  paintPreview();

  /* ============================================================
     3. THE LAYER
     ============================================================ */
  var cat = $("catalog");
  if (!cat) return;

  var catPanel = cat.querySelector(".cat__panel");
  var catBody = $("cat-body"), catGrid = $("cat-grid"), catBar = $("cat-bar");
  var catCount = $("cat-count"), catHead = $("cat-chead");
  var catPag = $("cat-pag"), catMore = $("cat-more"), catNote = $("cat-note");
  var catEmpty = $("cat-empty"), catSort = $("cat-sort");
  var catQ = $("cat-q"), catQX = $("cat-qx"), catX = $("cat-x");
  var headN = catHead.querySelector("b"), headT = catHead.querySelector("span");

  var catTools = $("cat-tools");

  var S = AH.newFilterState();
  var results = [], shown = PAGE;
  var isOpen = false, lastY = 0, opener = null, pushed = false, urlLive = false;

  /* ---- the filter instrument's two states ------------------------------
     Identical to index.html#avtomobili, because it IS index.html#avtomobili's markup and
     rules — the layer only supplies the trigger. On the page that is a
     sentinel leaving the top of the viewport; here it is this panel's own
     body starting to scroll, which is the same moment for the same reason:
     results have begun passing under the controls. */
  if (catTools && catBody) {
    var condensed = false;
    /* The body reserves the bar's AT-REST height and keeps it, condensed or
       not. Measured with the condense off, because reading it while condensed
       would reserve 62px and let the first row start under the bar. */
    var reserve = function () {
      var had = catTools.classList.contains("is-condensed");
      if (had) catTools.classList.remove("is-condensed");
      var h = catTools.getBoundingClientRect().height;
      if (had) catTools.classList.add("is-condensed");
      catBody.style.setProperty("--cat-tools-h", h + "px");
    };
    var condense = function () {
      /* Hysteresis. One threshold means a gesture that lands near it can be
         pushed back across by the bar's own change, and the state chatters.
         Engage at 96, release at 8: the gap is wider than the 86px the bar
         gives back, so no consequence of condensing can un-condense it. */
      var want = condensed ? catBody.scrollTop > 8 : catBody.scrollTop > 96;
      if (want === condensed) return;
      condensed = want;
      /* the same FLIP the collection page uses, so the instrument morphs the
         same way through the same curve wherever you meet it. The bar overlays
         the results rather than sitting above them (see .cat__panel), so its
         height changing cannot resize the scroller under the gesture. */
      /* the FLIP has to be handed the GRID ITEMS, and the filter row's grid
         item is the wrapper now, not the scroller inside it — animating the
         child while its parent jumps to a new grid area is two movements
         where the morph assumes one */
      AH.morph(catTools, [catTools.querySelector(".fsearch"),
                          catTools.querySelector(".fbar2-wrap") || catTools.querySelector(".fbar2"),
                          catTools.querySelector(".chead__count"), catTools.querySelector(".chead__sort")],
        function () { catTools.classList.toggle("is-condensed", want); });
      if (AH.catEdge) AH.catEdge();
    };
    catBody.addEventListener("scroll", condense, { passive: true });
    addEventListener("resize", reserve);
    AH.catCondense = condense;
    AH.catReserve = reserve;
  }
  /* and the same trailing fade on the pill row, for the same reason: it
     scrolls, and without the fade nothing says so */
  if (catBar) {
    var catEdge = function () {
      var over = catBar.scrollWidth - catBar.clientWidth;
      catBar.classList.toggle("is-end", over <= 1 || catBar.scrollLeft >= over - 1);
    };
    catBar.addEventListener("scroll", catEdge, { passive: true });
    addEventListener("resize", catEdge);
    /* Coalesced to one frame. The bar's width changes on every frame of the
       340ms morph, so an unthrottled observer ran catEdge 58 times per
       condense — and catEdge reads scrollWidth, which is a forced synchronous
       layout each time, in the middle of the one animation that must not
       stutter. Once per frame, at most, and only when something changed. */
    if ("ResizeObserver" in window) {
      var edgeQueued = false;
      new ResizeObserver(function () {
        if (edgeQueued) return;
        edgeQueued = true;
        requestAnimationFrame(function () { edgeQueued = false; catEdge(); });
      }).observe(catBar);
    }
    AH.catEdge = catEdge;
  }

  /* ============================================================
     THE EXPANSION

     The layer must not arrive — the preview must grow into it. The panel is
     clipped to the preview grid's own rectangle, and that inset animates to
     zero, so the surface unfolds from exactly where the reader was already
     looking. Because the grid inside the layer is the same grid at the same
     column count, the cards do not move: only the room opens around them.

     clip-path and opacity are both compositor properties, so this costs no
     layout on the machines the rest of the site was tuned for.
     ============================================================ */
  var panel = cat.querySelector(".cat__panel");
  var reduceMo = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var closeTimer = null;

  /* The rectangle to grow from has to be something the reader can actually
     see, or the animation originates off-screen and reads as a wipe. So:
     prefer the cards they clicked near, clip that to the viewport, and if
     what is left is too thin to grow from, fall back to the trigger itself —
     which is on screen by definition, because they just clicked it. */
  function visible(r) {
    if (!r || !r.width || !r.height) return null;
    var top = Math.max(0, r.top), bottom = Math.min(innerHeight, r.bottom);
    var left = Math.max(0, r.left), right = Math.min(innerWidth, r.right);
    if (bottom - top < 80 || right - left < 80) return null;
    return { top: top, bottom: bottom, left: left, right: right };
  }
  function sourceRect(from) {
    var cand = [];
    if (from && from.closest) {
      var g = from.closest(".csec");
      if (g) { var inner = g.querySelector(".cgrid"); if (inner) cand.push(inner); cand.push(g); }
    }
    cand.push($("pv-grid"));
    cand.push(D.querySelector(".cgrid"));
    for (var i = 0; i < cand.length; i++) {
      if (!cand[i]) continue;
      var v = visible(cand[i].getBoundingClientRect());
      if (v) return v;
    }
    /* the trigger itself — always on screen, so always a valid origin */
    if (from && from.getBoundingClientRect) {
      var r = from.getBoundingClientRect();
      if (r.width && r.height) {
        return { top: Math.max(0, r.top), bottom: Math.min(innerHeight, r.bottom),
                 left: Math.max(0, r.left), right: Math.min(innerWidth, r.right) };
      }
    }
    return null;
  }
  function insetFor(r) {
    var vw = innerWidth, vh = innerHeight;
    var t = Math.max(0, Math.min(vh, r.top));
    var l = Math.max(0, Math.min(vw, r.left));
    var rt = Math.max(0, vw - Math.min(vw, r.right));
    var bt = Math.max(0, vh - Math.min(vh, r.bottom));
    return "inset(" + t + "px " + rt + "px " + bt + "px " + l + "px)";
  }
  function growFrom(from) {
    if (!panel || reduceMo) return;
    var r = sourceRect(from);
    if (!r) return;
    if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
    panel.style.transition = "none";
    panel.style.clipPath = insetFor(r);
    void panel.offsetWidth;                    /* commit the start state */
    panel.style.transition = "";
    requestAnimationFrame(function () { panel.style.clipPath = "inset(0px)"; });
  }
  function shrinkTo(from) {
    if (!panel || reduceMo) { if (panel) panel.style.clipPath = ""; return; }
    var r = sourceRect(from);
    /* is-closing drops the stagger delays: without it the panel finishes
       before its contents and you watch an empty box collapse */
    cat.classList.add("is-closing");
    if (r) panel.style.clipPath = insetFor(r);
    closeTimer = setTimeout(function () {
      cat.classList.remove("is-closing");
      panel.style.transition = "none";
      panel.style.clipPath = "inset(0px)";
      void panel.offsetWidth;
      panel.style.transition = "";
      closeTimer = null;
    }, 640);
  }

  sortSelect(catSort, S.sort);

  function paintGrid() {
    catGrid.innerHTML = results.slice(0, shown).map(function (v, i) {
      return AH.card(v, { eager: i < 3 });
    }).join("");
    afterGrid();
  }

  /* paging appends rather than repaints: a repaint would drop and re-request
     every photograph already on screen */
  function extend() {
    if (shown >= results.length) return;
    var from = shown;
    shown = Math.min(shown + PAGE, results.length);
    catGrid.insertAdjacentHTML("beforeend",
      results.slice(from, shown).map(function (v) {
        return AH.card(v, {});
      }).join(""));
    afterGrid();
  }

  function afterGrid() {
    var seen = Math.min(shown, results.length);
    var left = results.length - seen;
    catPag.hidden = left <= 0;
    if (!catPag.hidden) {
      catMore.textContent = "Още " + PLURAL(Math.min(PAGE, left));
      catNote.textContent = seen + " от " + results.length;
    }
    catEmpty.hidden = results.length > 0;
    if (AH.rendered) AH.rendered(catGrid);
  }

  function apply(keepScroll) {
    results = AH.filterResults(S);
    shown = PAGE;
    catBar.innerHTML = barHTML(S);
    catCount.textContent = PLURAL(results.length);
    headN.textContent = String(results.length);
    headT.textContent = AH.plural(results.length) + " в наличност";
    paintGrid();
    /* whatever panel is open follows the state: the counts inside it are all
       "how many would this give me", and they change with every other
       control */
    if (popKey) paintPop();
    if (sheetOpen) paintSheet();
    syncURL();
    if (!keepScroll) catBody.scrollTop = 0;
    /* the row was just rebuilt, so how far it overruns has changed, the bar's
       resting height may have moved with it, and scrolling back to the top
       un-condenses the instrument */
    if (AH.catReserve) AH.catReserve();
    if (AH.catEdge) AH.catEdge();
    if (AH.catCondense) AH.catCondense();
  }

  /* ---- one toggle, spoken by every surface ---- */
  function toggle(t) {
    var k = t.getAttribute("data-make");
    if (k != null) { S.make = S.make === k ? "" : k; S.model = ""; apply(true); return true; }
    k = t.getAttribute("data-model");
    if (k != null) { S.model = S.model === k ? "" : k; apply(true); return true; }
    k = t.getAttribute("data-chapter");
    if (k != null) { S.chapter = S.chapter === k ? "" : k; S.tag = ""; apply(true); return true; }
    k = t.getAttribute("data-fuel");
    if (k != null) { S.fuel = S.fuel === k ? "" : k; apply(true); return true; }
    return false;
  }

  function clearAll() {
    AH.filterClear(S);
    if (catQ) { catQ.value = ""; catQX.hidden = true; }
    apply();
  }

  catSort.addEventListener("change", function () {
    S.sort = catSort.value;
    apply();
  });
  catMore.addEventListener("click", function () { extend(); });
  $("cat-clear").addEventListener("click", clearAll);

  /* ---- search: one rAF of coalescing, so a fast typist filters once ---- */
  if (catQ) {
    var pending = false;
    var onType = function () {
      if (pending) return;
      pending = true;
      requestAnimationFrame(function () {
        pending = false;
        var val = catQ.value.trim();
        if (val === S.q) return;
        S.q = val;
        catQX.hidden = !val;
        apply();
      });
    };
    catQ.addEventListener("input", onType);
    catQ.addEventListener("search", onType);
    catQX.addEventListener("click", function () {
      catQ.value = ""; S.q = ""; catQX.hidden = true; apply(); catQ.focus();
    });
  }

  /* ---- auto-extend: the button stays, but nobody should have to press it */
  var tailIO = null;
  function watchTail() {
    if (!("IntersectionObserver" in window)) return;
    if (!tailIO) {
      tailIO = new IntersectionObserver(function (es) {
        if (isOpen && es[0].isIntersecting) extend();
      }, { root: catBody, rootMargin: "600px 0px" });
    }
    tailIO.disconnect();
    tailIO.observe(catPag);
  }

  /* ============================================================
     4. THE PANELS

     A control's panel opens UNDER the control from 768 up, and as a sheet
     over the room below it — but it is the same panel, because both take
     their inside from panelBody(). The sheet simply stacks every control's
     panel with its name above it, which is what a phone has room to do and
     a dropdown does not.
     ============================================================ */
  var wrap = catBar.parentNode;                 /* .fbar2-wrap — not the scroller */
  var pop = $("cat-pop");
  var sheet = $("fsheet"), sheetBody = $("fsheet-body"), sheetN = $("fsheet-n");
  var popKey = null, popAnchor = null;
  var sheetOpen = false, sheetOpener = null;
  /* Below this the eight controls no longer fit a row without the tail going
     behind a scroll nobody finds — which is the exact fault this instrument
     was rebuilt to end. So below it there is one control, and it opens all
     eight at once. */
  var mqRail = matchMedia("(min-width:768px)");

  function numOf(s) {
    var d = String(s == null ? "" : s).replace(/[^\d]/g, "");
    return d === "" ? null : parseInt(d, 10);
  }

  /* ---- the dropdown ---------------------------------------------------- */
  function popHTML(key) {
    var C = BY_KEY[key];
    return '<div class="fpop__h">' + AH.esc(C.label) + "</div>" +
      '<div class="fpop__b">' + panelBody(key, S) + "</div>" +
      '<div class="fpop__f">' +
        '<button type="button" class="fpop__reset" data-reset="' + key + '">Изчисти</button>' +
        '<span class="fpop__n">' + PLURAL(AH.filterResults(S).length) + "</span>" +
      "</div>";
  }

  function placePop() {
    if (!popAnchor || !pop) return;
    var wr = wrap.getBoundingClientRect(), ar = popAnchor.getBoundingClientRect();
    pop.style.top = (ar.bottom - wr.top + 8) + "px";
    /* measure, then clamp inside the instrument's own width — a panel that
       hangs off the right edge of a scrolling row is unreachable */
    pop.style.left = "0px";
    var w = pop.offsetWidth;
    var x = Math.max(0, Math.min(ar.left - wr.left, wr.width - w));
    pop.style.left = x + "px";
  }

  function paintPop() {
    if (!popKey) return;
    /* the row is rebuilt on every apply, so the button this panel hangs off
       is a different element than the one that opened it */
    popAnchor = catBar.querySelector('[data-pop="' + popKey + '"]');
    if (!popAnchor) { closePop(true); return; }
    popAnchor.setAttribute("aria-expanded", "true");
    popAnchor.classList.add("is-open");
    pop.innerHTML = popHTML(popKey);
    listEdge();
    placePop();
  }

  /* the fade at the foot of a scrolling option list means "there is more",
     so it has to go once there is not */
  function listEdge() {
    var l = pop.querySelector(".fopts");
    if (!l) return;
    var over = l.scrollHeight - l.clientHeight;
    l.classList.toggle("is-end", over <= 1 || l.scrollTop >= over - 1);
  }
  pop.addEventListener("scroll", function (e) {
    if (e.target.classList && e.target.classList.contains("fopts")) listEdge();
  }, true);

  function openPop(key, anchor) {
    if (popKey === key) { closePop(); return; }
    closePop(true);
    popKey = key; popAnchor = anchor;
    pop.hidden = false;
    paintPop();
    var first = pop.querySelector("input,button:not(:disabled)");
    if (first) first.focus({ preventScroll: true });
  }

  function closePop(silent) {
    if (!popKey) return;
    popKey = null;
    pop.hidden = true;
    pop.innerHTML = "";
    all("[data-pop]", catBar).forEach(function (b) {
      b.setAttribute("aria-expanded", "false");
      b.classList.remove("is-open");
    });
    if (!silent && popAnchor && popAnchor.parentNode) popAnchor.focus({ preventScroll: true });
    popAnchor = null;
  }

  /* ---- the sheet ------------------------------------------------------- */
  function paintSheet() {
    sheetBody.innerHTML = CONTROLS.map(function (C) {
      if (C.dependent && !S.make) return "";
      return '<section class="fgrp"><h3 class="fgrp__h">' + AH.esc(C.label) + "</h3>" +
        panelBody(C.key, S) + "</section>";
    }).join("");
    sheetN.textContent = "Покажи " + PLURAL(AH.filterResults(S).length);
  }

  function openSheet(t) {
    if (sheetOpen) return;
    sheetOpen = true;
    sheetOpener = t || null;
    paintSheet();
    sheet.classList.add("is-open");
    sheet.setAttribute("aria-hidden", "false");
    if (t) t.setAttribute("aria-expanded", "true");
    void sheet.offsetWidth;
    $("fsheet-x").focus({ preventScroll: true });
  }

  function closeSheet(silent) {
    if (!sheetOpen) return;
    sheetOpen = false;
    sheet.classList.remove("is-open");
    sheet.setAttribute("aria-hidden", "true");
    all("[data-sheet]", catBar).forEach(function (b) {
      b.setAttribute("aria-expanded", "false");
    });
    if (!silent) {
      var back = sheetOpener && sheetOpener.parentNode ? sheetOpener : catX;
      back.focus({ preventScroll: true });
    }
    sheetOpener = null;
  }

  /* ---- the range control, wherever it is rendered ----------------------
     Dragging must not re-filter: eighty cards re-rendering per frame is what
     makes a slider feel broken. The thumb moves and the readout follows on
     `input`; the results follow on `change`, i.e. when the finger lifts. */
  function rangeCtx(el) {
    var box = el.closest(".frng");
    if (!box) return null;
    var C = BY_KEY[box.getAttribute("data-range")];
    return { C: C, box: box,
      a: box.querySelector(".frng__a"), b: box.querySelector(".frng__b"),
      ia: box.querySelector(".frng__ia"), ib: box.querySelector(".frng__ib"),
      fill: box.querySelector(".frng__fill"), read: box.querySelector(".frng__read") };
  }
  function drawRange(R) {
    var span = R.C.max - R.C.min || 1, lo = +R.a.value, hi = +R.b.value;
    R.fill.style.left = ((lo - R.C.min) / span * 100) + "%";
    R.fill.style.width = ((hi - lo) / span * 100) + "%";
    R.read.innerHTML = "<b>" + fmtNum(R.C, lo) + "</b> – <b>" + fmtNum(R.C, hi) + "</b>" +
      (R.C.unit ? " <em>" + R.C.unit + "</em>" : "");
  }
  function commitRange(R) {
    /* a handle parked on its own end means "no limit here", not "exactly the
       extreme" — otherwise clearing a range would be impossible by dragging */
    S[R.C.sMin] = +R.a.value <= R.C.min ? null : +R.a.value;
    S[R.C.sMax] = +R.b.value >= R.C.max ? null : +R.b.value;
  }

  function onRangeInput(e) {
    var t = e.target;
    if (!t.classList || !t.classList.contains("frng__a") && !t.classList.contains("frng__b")) return;
    var R = rangeCtx(t); if (!R) return;
    /* each thumb is clamped against the other rather than swapped with it: a
       handle that jumps past its neighbour loses the pointer */
    if (t === R.a && +R.a.value > +R.b.value) R.a.value = R.b.value;
    if (t === R.b && +R.b.value < +R.a.value) R.b.value = R.a.value;
    drawRange(R);
    R.ia.value = +R.a.value <= R.C.min ? "" : fmtNum(R.C, +R.a.value);
    R.ib.value = +R.b.value >= R.C.max ? "" : fmtNum(R.C, +R.b.value);
  }

  function onRangeChange(e) {
    var t = e.target, R = rangeCtx(t);
    if (!R) return;
    if (t === R.a || t === R.b) { commitRange(R); apply(true); return; }
    if (t === R.ia || t === R.ib) {
      var lo = numOf(R.ia.value), hi = numOf(R.ib.value);
      if (lo == null) lo = R.C.min;
      if (hi == null) hi = R.C.max;
      lo = Math.max(R.C.min, Math.min(R.C.max, lo));
      hi = Math.max(R.C.min, Math.min(R.C.max, hi));
      if (lo > hi) { var s = lo; lo = hi; hi = s; }
      R.a.value = String(lo); R.b.value = String(hi);
      commitRange(R); apply(true);
    }
  }

  /* ---- one click handler per surface ---- */
  function panelClick(e, isSheet) {
    var t = e.target.closest && e.target.closest("button");
    if (!t) return;
    var rk = t.getAttribute("data-reset");
    if (rk) {
      var C = BY_KEY[rk];
      if (C.kind === "range") { S[C.sMin] = null; S[C.sMax] = null; }
      else if (rk === "make") { S.make = ""; S.model = ""; }
      else if (rk === "model") S.model = "";
      else if (rk === "fuel") S.fuel = "";
      else { S.chapter = ""; S.tag = ""; }
      apply(true);
      return;
    }
    if (toggle(t) && !isSheet) closePop();      /* a choice is a decision */
  }

  pop.addEventListener("click", function (e) { panelClick(e, false); });
  pop.addEventListener("input", onRangeInput);
  pop.addEventListener("change", onRangeChange);
  sheetBody.addEventListener("click", function (e) { panelClick(e, true); });
  sheetBody.addEventListener("input", onRangeInput);
  sheetBody.addEventListener("change", onRangeChange);

  catBar.addEventListener("click", function (e) {
    var t = e.target.closest && e.target.closest("button");
    if (!t || !catBar.contains(t)) return;
    if (t.getAttribute("data-clear")) { closePop(true); clearAll(); return; }
    if (t.getAttribute("data-sheet")) { openSheet(t); return; }
    var k = t.getAttribute("data-pop");
    if (k) openPop(k, t);
  });
  /* the row scrolls under a panel that is anchored to it */
  catBar.addEventListener("scroll", function () { if (popKey) placePop(); }, { passive: true });
  addEventListener("resize", function () { if (popKey) placePop(); });

  $("fsheet-x").addEventListener("click", function () { closeSheet(); });
  $("fsheet-scrim").addEventListener("click", function () { closeSheet(); });
  $("fsheet-apply").addEventListener("click", function () { closeSheet(); });
  $("fsheet-clear").addEventListener("click", function () { clearAll(); });

  /* a pointer anywhere else dismisses the dropdown — but not a press on the
     control that owns it, or the toggle would fire twice and re-open it */
  D.addEventListener("pointerdown", function (e) {
    if (!popKey) return;
    if (pop.contains(e.target)) return;
    if (e.target.closest && e.target.closest("[data-pop]")) return;
    closePop(true);
  }, true);

  /* crossing the breakpoint changes which instrument is on screen */
  var onRail = function () {
    closePop(true);
    if (mqRail.matches) closeSheet(true);
    if (isOpen) apply(true);
  };
  if (mqRail.addEventListener) mqRail.addEventListener("change", onRail);
  else if (mqRail.addListener) mqRail.addListener(onRail);

  /* ============================================================
     5. OPEN / CLOSE

     The landing page keeps its scroll position by being PINNED rather than
     hidden: `overflow:hidden` alone collapses the offset and returns the
     reader to the top when the layer closes.
     ============================================================ */
  function urlFor() {
    var q = AH.filterToQuery(S);
    return location.pathname + (q ? "?" + q : "") + "#collection";
  }
  function syncURL() {
    if (!urlLive) return;                     /* never touch history mid-open */
    try { history.replaceState({ cat: 1 }, "", urlFor()); } catch (e) {}
  }

  /* "open the room with the filters showing". From 768 up every control is
     already on screen, so there is nothing to reveal — which is the whole
     point of the rail. Below it, the sheet is the filters. */
  function revealFilters() { if (!mqRail.matches) openSheet(null); }

  function open(o) {
    o = o || {};
    if (isOpen) { if (o.drawer) revealFilters(); return; }
    isOpen = true;
    opener = o.opener || null;
    urlLive = false;

    /* a trigger SEEDS the room: it does not add to whatever was there last
       time. Opening "Porsche" from the landing page must give Porsche, not
       Porsche plus a price window somebody set an hour ago. */
    if (!o.fromURL) {
      AH.filterClear(S);
      S.sort = pvSortKey;
      if (o.make) S.make = o.make;
      if (o.chapter) S.chapter = o.chapter;
      if (o.tag) S.tag = o.tag;
    }
    if (catQ) { catQ.value = S.q; catQX.hidden = !S.q; }
    catSort.value = S.sort;
    /* a hand-edited ?sort= must not leave the control blank */
    if (catSort.value !== S.sort) { S.sort = "curated"; catSort.value = S.sort; }

    lastY = window.scrollY || window.pageYOffset || 0;
    D.body.style.top = (-lastY) + "px";
    D.documentElement.classList.add("shw-open");

    apply();
    /* the clip start state must be committed BEFORE is-open, or the first
       painted frame is already full-screen and there is nothing to grow */
    growFrom(opener);
    cat.classList.add("is-open");
    cat.setAttribute("aria-hidden", "false");
    void cat.offsetWidth;                     /* flush so focus() lands */
    catX.focus({ preventScroll: true });

    /* Android's back gesture should close the layer, not leave the site.
       A room arrived at through the URL already owns its history entry. */
    if (!o.fromURL) {
      try { history.pushState({ cat: 1 }, "", urlFor()); pushed = true; } catch (e) {}
    }
    urlLive = true;
    if (o.drawer) revealFilters();
    watchTail();
  }

  function close(fromPop) {
    if (!isOpen) return;
    closePop(true);
    closeSheet(true);
    isOpen = false;
    urlLive = false;
    /* run the inset backwards to the rectangle the reader came from. This
       has to be issued while the body is still pinned, so the source
       element is still where it was when the layer opened. */
    shrinkTo(opener);
    cat.classList.remove("is-open");
    cat.setAttribute("aria-hidden", "true");
    D.documentElement.classList.remove("shw-open");
    D.body.style.top = "";

    /* Restoring the offset is the whole promise of this pattern, and it is
       fragile: the document only regains its height once `position:fixed`
       comes off the body, so a scroll issued in the same tick lands against
       a page that is still zero-height. Set it directly, then re-assert on
       the next frame once layout has settled. `scroll-behavior:smooth` on
       <html> would animate the jump, so it is suspended for the hop. */
    var restore = function () {
      var prev = D.documentElement.style.scrollBehavior;
      D.documentElement.style.scrollBehavior = "auto";
      D.documentElement.scrollTop = lastY;
      window.scrollTo(0, lastY);
      D.documentElement.style.scrollBehavior = prev;
    };
    restore();
    requestAnimationFrame(function () { requestAnimationFrame(restore); });

    if (opener) { opener.focus({ preventScroll: true }); opener = null; }
    if (!fromPop) {
      if (pushed) { try { history.back(); } catch (e) {} }
      else { try { history.replaceState({}, "", location.pathname); } catch (e) {} }
    }
    pushed = false;
    if (tailIO) tailIO.disconnect();
  }

  AH.openCatalog = open;
  AH.openShowroom = open;                     /* v40 name, still honoured */

  catX.addEventListener("click", function () { close(); });
  cat.querySelector(".cat__scrim").addEventListener("click", function () { close(); });
  addEventListener("popstate", function () { if (isOpen) close(true); });

  function trap(e, root) {
    var f = all('a[href],button:not([disabled]),select,input:not([disabled])', root)
      .filter(function (el) {
        return el.getAttribute("tabindex") !== "-1" && el.offsetParent !== null;
      });
    if (!f.length) return;
    var a = f[0], z = f[f.length - 1];
    if (e.shiftKey && D.activeElement === a) { e.preventDefault(); z.focus(); }
    else if (!e.shiftKey && D.activeElement === z) { e.preventDefault(); a.focus(); }
  }

  D.addEventListener("keydown", function (e) {
    if (sheetOpen) {
      if (e.key === "Escape") { closeSheet(); return; }
      if (e.key === "Tab") trap(e, sheet.querySelector(".fsheet__panel"));
      return;
    }
    /* a dropdown is not modal: Escape gives it back, Tab simply leaves it,
       and leaving is what dismisses it */
    if (popKey) {
      if (e.key === "Escape") { closePop(); return; }
      if (e.key === "Tab") {
        setTimeout(function () {
          if (popKey && !pop.contains(D.activeElement) &&
              !(D.activeElement && D.activeElement.getAttribute &&
                D.activeElement.getAttribute("data-pop") === popKey)) closePop(true);
        }, 0);
      }
    }
    if (!isOpen) return;
    if (e.key === "Escape") { close(); return; }
    if (e.key === "Tab") trap(e, catPanel);
  });

  /* Anything with [data-catalog] opens the room, seeded from its own
     data-make / data-chapter / data-tag. Every trigger keeps a real href to
     index.html#avtomobili, which is what runs with JS off or on a middle-click. */
  D.addEventListener("click", function (e) {
    var t = e.target.closest && e.target.closest("[data-catalog]");
    if (!t) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button > 0) return;
    e.preventDefault();
    open({
      opener: t,
      make: t.getAttribute("data-make") || "",
      chapter: t.getAttribute("data-chapter") || "",
      tag: t.getAttribute("data-tag") || "",
      drawer: !!t.getAttribute("data-drawer")
    });
  });

  /* A filtered room is a shareable URL: arriving with one opens it. */
  (function boot() {
    var KEYS = ["q", "make", "model", "chapter", "tag", "fuel", "sort",
                "yearMin", "yearMax", "priceMin", "priceMax", "kmMin", "kmMax"];
    var p = new URLSearchParams(location.search);
    for (var i = 0; i < KEYS.length; i++) {
      if (p.has(KEYS[i])) {
        AH.filterFromQuery(S);
        open({ fromURL: true });
        return;
      }
    }
    if (location.hash === "#collection") setTimeout(function () { open({}); }, 300);
  })();
})();
