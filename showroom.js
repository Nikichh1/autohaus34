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

  /* The catalogue is intentionally a browse-first surface. Make is the one
     meaningful refinement; all other decisions belong in a vehicle enquiry. */
  var CONTROLS = [{ key: "make", label: "Марка", kind: "list" }];
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
    var C = CONTROLS[0], val = valueOf(S, C, AH.filterOptions(S));
    var h = '<button type="button" class="fsel' + (val ? " is-set" : "") + '"' +
      ' data-pop="make" aria-haspopup="dialog" aria-expanded="false">' +
      '<span class="fsel__t">' + AH.esc(val || C.label) + "</span>" + CARET +
      "</button>";
    if (S.make) h += '<button type="button" class="fsel fsel--clear" data-clear="1">Изчисти</button>';
    return h;
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
    /* NOT eager. `eager` means fetchpriority="high" and no lazy attribute,
       which is right for the layer — its first row IS the first screen — and
       exactly wrong here: this grid sits below a full-height hero, so on a
       phone the first three cards are off screen at load. Measured on a
       1.6Mbps link they pulled 206KB at high priority against the 49KB of
       render-blocking CSS that gates first paint. Below the fold, so lazy. */
    pvGrid.innerHTML = list.slice(0, PREVIEW).map(function (v) {
      return AH.card(v, {});
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

  /* The first paint of this grid is the single longest task on the landing
     page: filter 87 records, sort them, build six cards of markup, parse it
     into ~90 nodes and lay them out — measured at 226-251ms on a 4x-
     throttled phone, all of it inside the window that decides whether the
     page feels responsive. And every pixel of it is below the hero.

     So it waits for the first idle moment. The `timeout` is what makes this
     safe rather than optimistic: on a device that never goes idle it runs
     anyway, a quarter-second in, still long before anyone has scrolled a
     full screen. Re-sorting later calls paintPreview() directly — that IS
     the user waiting for something, and it must not be deferred. */
  if (typeof requestIdleCallback === "function") requestIdleCallback(paintPreview, { timeout: 250 });
  else setTimeout(paintPreview, 1);

  /* ============================================================
     3. THE LAYER
     ============================================================ */
  var cat = $("catalog");
  if (!cat) return;

  var catPanel = cat.querySelector(".cat__panel");
  var catBody = $("cat-body"), catGrid = $("cat-grid"), catBar = $("cat-bar");
  var catCount = $("cat-count"), catHead = $("cat-chead");
  var catPag = $("cat-pag"), catMore = $("cat-more"), catNote = $("cat-note");
  var catEmpty = $("cat-empty"), catSort = $("cat-sort"), catX = $("cat-x");
  /* the stock count used to live here. It is gone from the markup, so
     everything that wrote to it is guarded rather than deleted — the
     filter button's badge is the count now. */
  var headN = catHead ? catHead.querySelector("b") : null;
  var headT = catHead ? catHead.querySelector("span") : null;

  var catTools = $("cat-tools");

  var S = AH.newFilterState();
  var results = [], shown = PAGE;
  var isOpen = false, lastY = 0, opener = null, pushed = false, urlLive = false;

  /* Reserve the single make control above the scrolling grid. There is no
     condensed state now: one control is already compact at every width. */
  if (catTools && catBody) {
    var reserve = function () {
      var h = catTools.getBoundingClientRect().height;
      catBody.style.setProperty("--cat-tools-h", h + "px");
    };
    addEventListener("resize", reserve);
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

  if (catSort) sortSelect(catSort, S.sort);

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
    if (headN) headN.textContent = String(results.length);
    if (headT) headT.textContent = AH.plural(results.length) + " в наличност";
    paintGrid();
    /* whatever panel is open follows the state: the counts inside it are all
       "how many would this give me", and they change with every other
       control */
    if (popKey) paintPop();
    syncURL();
    if (!keepScroll) catBody.scrollTop = 0;
    /* the row was just rebuilt, so how far it overruns has changed, the bar's
       resting height may have moved with it, and scrolling back to the top
       un-condenses the instrument */
    if (AH.catReserve) AH.catReserve();
    if (AH.catEdge) AH.catEdge();
  }

  /* ---- one toggle, spoken by every surface ---- */
  function toggle(t) {
    var k = t.getAttribute("data-make");
    if (k != null) { S.make = S.make === k ? "" : k; apply(true); return true; }
    return false;
  }

  function clearAll() {
    AH.filterClear(S);
    apply();
  }

  if (catSort) catSort.addEventListener("change", function () {
    S.sort = catSort.value;
    apply();
  });
  catMore.addEventListener("click", function () { extend(); });
  $("cat-clear").addEventListener("click", clearAll);

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
     4. THE MAKE MENU
     ============================================================ */
  var wrap = catBar.parentNode;                 /* .fbar2-wrap — not the scroller */
  var pop = $("cat-pop");
  var popKey = null, popAnchor = null;

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

  /* ---- one click handler for the make menu ---- */
  function panelClick(e) {
    var t = e.target.closest && e.target.closest("button");
    if (!t) return;
    var rk = t.getAttribute("data-reset");
    if (rk) {
      if (rk === "make") S.make = "";
      apply(true);
      return;
    }
    if (toggle(t)) closePop();                   /* a choice is a decision */
  }

  pop.addEventListener("click", panelClick);

  catBar.addEventListener("click", function (e) {
    var t = e.target.closest && e.target.closest("button");
    if (!t || !catBar.contains(t)) return;
    if (t.getAttribute("data-clear")) { closePop(true); clearAll(); return; }
    var k = t.getAttribute("data-pop");
    if (k) openPop(k, t);
  });
  /* the row scrolls under a panel that is anchored to it */
  catBar.addEventListener("scroll", function () { if (popKey) placePop(); }, { passive: true });
  addEventListener("resize", function () { if (popKey) placePop(); });

  /* a pointer anywhere else dismisses the dropdown — but not a press on the
     control that owns it, or the toggle would fire twice and re-open it */
  D.addEventListener("pointerdown", function (e) {
    if (!popKey) return;
    if (pop.contains(e.target)) return;
    if (e.target.closest && e.target.closest("[data-pop]")) return;
    closePop(true);
  }, true);

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

  function open(o) {
    o = o || {};
    if (isOpen) return;
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
    }
    if (catSort) catSort.value = S.sort;
    /* a hand-edited ?sort= must not leave the control blank */
    if (catSort && catSort.value !== S.sort) { S.sort = "curated"; catSort.value = S.sort; }

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
    watchTail();
  }

  function close(fromPop) {
    if (!isOpen) return;
    closePop(true);
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

  /* Anything with [data-catalog] opens the room, optionally seeded with its
     make. Every trigger keeps a real href to index.html#avtomobili, which is
     what runs with JS off or on a middle-click. */
  D.addEventListener("click", function (e) {
    var t = e.target.closest && e.target.closest("[data-catalog]");
    if (!t) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button > 0) return;
    e.preventDefault();
    open({
      opener: t,
      make: t.getAttribute("data-make") || ""
    });
  });

  /* A selected make remains shareable; obsolete search/filter parameters are
     ignored so an old link cannot silently narrow the collection. */
  (function boot() {
    var p = new URLSearchParams(location.search);
    if (p.has("make")) {
      S.make = p.get("make") || "";
      open({ fromURL: true });
      return;
    }
    if (location.hash === "#collection") setTimeout(function () { open({}); }, 300);
  })();
})();
