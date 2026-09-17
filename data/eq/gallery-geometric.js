/* AutoHaus desktop vehicle gallery — clean premium layout, desktop only. */
(function () {
  "use strict";
  if (typeof document === "undefined" || document.getElementById("ah-geometric-gallery-v4")) return;

  var style = document.createElement("style");
  style.id = "ah-geometric-gallery-v4";
  style.textContent = [
    "@media(min-width:1024px){",

    /* One coherent component: gallery above, thumbnails + controls together below. */
    ".dgallery{display:grid;grid-template-columns:minmax(0,1fr) auto;grid-template-rows:auto auto;column-gap:22px;row-gap:0;align-items:start;min-width:0}",
    ".dgal-wrap{grid-column:1 / -1;grid-row:1;position:relative}",
    ".dgal-wrap::before,.dgal-wrap::after{display:none!important}",

    /* Precise 2:1 composition. Ratio is updated from the selected image so full-frame contain stays aligned. */
    ".dgal{--ah-gallery-ratio:2.449;position:relative;display:grid;grid-template-columns:minmax(0,2fr) minmax(280px,1fr);grid-template-rows:1fr 1fr;gap:4px;aspect-ratio:var(--ah-gallery-ratio);align-items:stretch;overflow:hidden;border:1px solid rgba(19,19,18,.16);border-radius:0;background:#e9e7e2;box-shadow:0 10px 30px rgba(20,19,18,.045)}",
    ".dgal::before,.dgal::after{display:none!important}",
    ".dgal__f{position:relative;display:block;width:100%;height:100%;min-width:0;overflow:hidden;border:0!important;border-radius:0!important;background:#f2f0ec;cursor:zoom-in}",
    ".dgal__f picture,.dgal__f img{display:block;width:100%;height:100%}",
    ".dgal__f img{object-fit:contain;object-position:center;background:#f2f0ec;transform:none!important;transition:filter var(--ui-dur) var(--ui-ease),opacity var(--ui-dur) var(--ui-ease)}",
    ".dgal__main{grid-column:1;grid-row:1 / 3;aspect-ratio:auto!important}",
    ".dgal__side{display:block;grid-column:2;aspect-ratio:auto!important}",
    ".dgal__main + .dgal__side{grid-row:1}",
    ".dgal__main + .dgal__side + .dgal__side{grid-row:2}",
    ".dgal__f:hover img,.dgal__f:focus-visible img{filter:brightness(.985)}",
    ".dgal__n{display:none!important}",

    /* Single and two-image states stay composed instead of becoming oversized. */
    ".dgal--1{display:block;aspect-ratio:auto;max-width:min(1120px,78vw);margin-inline:auto;overflow:visible;border:0;background:transparent;box-shadow:none}",
    ".dgal--1 .dgal__main{display:block;width:100%;height:auto;overflow:hidden;border:1px solid rgba(19,19,18,.16)!important;background:#f2f0ec}",
    ".dgal--1 .dgal__main picture,.dgal--1 .dgal__main img{display:block;width:auto;max-width:100%;height:auto;max-height:72vh;margin-inline:auto;background:#f2f0ec}",
    ".dgal--2{grid-template-columns:repeat(2,minmax(0,1fr));grid-template-rows:1fr;aspect-ratio:var(--ah-gallery-ratio);max-width:1500px;margin-inline:auto}",
    ".dgal--2 .dgal__main,.dgal--2 .dgal__side{grid-column:auto;grid-row:1;aspect-ratio:auto!important}",

    /* Bottom row: no dead space, no detached controls, no decorative orange ticks. */
    ".dthumbs{grid-column:1;grid-row:2;display:flex;align-items:center;gap:8px;min-width:0;overflow-x:auto;overscroll-behavior-x:contain;scroll-snap-type:x proximity;padding:10px 0 0;margin:0;scrollbar-width:none}",
    ".dthumbs::-webkit-scrollbar{display:none}",
    ".dthumb{position:relative;flex:0 0 86px;aspect-ratio:1.5;display:block;padding:0;border:1px solid transparent;background:transparent;opacity:.52;overflow:hidden;scroll-snap-align:start;clip-path:none!important;box-shadow:none!important;transition:opacity var(--ui-dur) var(--ui-ease),border-color var(--ui-dur) var(--ui-ease),transform var(--ui-dur) var(--ui-ease)}",
    ".dthumb picture,.dthumb img{display:block;width:100%;height:100%;object-fit:contain;background:#f2f0ec}",
    ".dthumb::before,.dthumb::after{display:none!important}",
    ".dthumb:hover,.dthumb:focus-visible{opacity:.86;border-color:rgba(19,19,18,.34);transform:translateY(-1px)}",
    ".dthumb.is-active{opacity:1;border-color:var(--ink);transform:none}",

    ".dgal-bar{grid-column:2;grid-row:2;display:flex;align-items:center;justify-content:flex-end;gap:8px;min-height:0;padding:10px 0 0;margin:0;align-self:start}",
    ".dgal-bar__n{display:inline-flex;align-items:center;justify-content:center;height:36px;min-width:52px;padding:0 4px;background:transparent!important;border:0!important;color:var(--ink-2);font-size:11px;line-height:1;font-weight:600;letter-spacing:.08em;font-variant-numeric:tabular-nums;clip-path:none!important}",
    ".dgal-controls{display:flex;align-items:center;gap:4px}",
    ".dgal-controls button{display:grid;place-items:center;width:36px;height:36px;padding:0;border:1px solid rgba(19,19,18,.20);background:#fff;color:var(--ink);cursor:pointer;border-radius:0;clip-path:none!important;overflow:hidden;box-shadow:none;transition:background-color var(--ui-dur) var(--ui-ease),color var(--ui-dur) var(--ui-ease),border-color var(--ui-dur) var(--ui-ease)}",
    ".dgal-controls button::before,.dgal-controls button::after{display:none!important}",
    ".dgal-controls button:hover,.dgal-controls button:focus-visible{background:var(--ink);color:#fff;border-color:var(--ink)}",
    ".dgal-controls svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:1.5}",

    /* A single image has no useful gallery controls; collapse the second row completely. */
    ".dgal-wrap.ah-gal-single ~ .dgal-bar{display:none}",
    "}"
  ].join("");
  document.head.appendChild(style);
})();

/* Keep the selected image and side images distinct, and size the desktop mosaic
   from the actual selected image ratio so contain does not create fake bars. */
(function () {
  "use strict";
  if (typeof document === "undefined") return;

  function init() {
    var gal = document.getElementById("dgal");
    if (!gal || gal.dataset.ahGeometricV4 === "1") return;

    var wrap = document.getElementById("dgal-wrap");
    var main = gal.querySelector(".dgal__main");
    var sides = Array.prototype.slice.call(gal.querySelectorAll(".dgal__side"));
    if (!main) return;

    var mq = matchMedia("(min-width:1024px)");
    var frames = [main].concat(sides);
    var seed = frames.map(function (frame) {
      var picture = frame.querySelector("picture");
      var counter = frame.querySelector(".dgal__n");
      return {
        i: Number(frame.dataset.i || 0),
        href: frame.getAttribute("href") || "",
        aria: frame.getAttribute("aria-label") || "",
        picture: picture ? picture.outerHTML : "",
        counter: counter ? counter.textContent : ""
      };
    });

    gal.dataset.ahGeometricV4 = "1";
    if (wrap && gal.classList.contains("dgal--1")) wrap.classList.add("ah-gal-single");

    function paint(frame, shot) {
      if (!frame || !shot) return;
      frame.dataset.i = String(shot.i);
      frame.setAttribute("href", shot.href);
      frame.setAttribute("aria-label", shot.aria);
      var picture = frame.querySelector("picture");
      if (picture && shot.picture) picture.outerHTML = shot.picture;
      var counter = frame.querySelector(".dgal__n");
      if (counter) counter.textContent = shot.counter;
    }

    function restoreSides() {
      sides.forEach(function (frame, index) {
        if (seed[index + 1]) paint(frame, seed[index + 1]);
      });
    }

    function syncSides() {
      if (!mq.matches || !sides.length) {
        if (!mq.matches) restoreSides();
        return;
      }
      var selected = Number(main.dataset.i || 0);
      var pool = seed.filter(function (shot) { return shot.i !== selected; });
      if (pool.length < sides.length) pool = seed.slice();
      sides.forEach(function (frame, index) {
        paint(frame, pool[index % pool.length]);
      });
    }

    function applyRatio() {
      if (!mq.matches || gal.classList.contains("dgal--1")) return;
      var img = main.querySelector("img");
      if (!img || !img.naturalWidth || !img.naturalHeight) return;

      var r = img.naturalWidth / img.naturalHeight;
      if (!isFinite(r) || r < .6 || r > 3.2) return;

      /* Three-image composition: main width is 2/3 of the gallery and full
         height, side width is 1/3 and half height. 1.5 * photo ratio makes
         all three cells match the photo ratio when the shoot is consistent. */
      var multiplier = gal.classList.contains("dgal--2") ? 2 : 1.5;
      gal.style.setProperty("--ah-gallery-ratio", String((r * multiplier).toFixed(5)));
    }

    function syncAll() {
      syncSides();
      requestAnimationFrame(applyRatio);
    }

    main.addEventListener("load", function (event) {
      if (event.target && event.target.tagName === "IMG") applyRatio();
    }, true);

    new MutationObserver(syncAll).observe(main, {
      attributes: true,
      attributeFilter: ["data-i"],
      childList: true,
      subtree: true
    });

    if (mq.addEventListener) mq.addEventListener("change", syncAll);
    else if (mq.addListener) mq.addListener(syncAll);
    addEventListener("resize", applyRatio, { passive: true });

    syncAll();
    var firstImg = main.querySelector("img");
    if (firstImg && !firstImg.complete) firstImg.addEventListener("load", applyRatio, { once: true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else setTimeout(init, 0);
})();
