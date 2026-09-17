/* AutoHaus geometric desktop gallery enhancement. Vehicle pages only. */
(function () {
  "use strict";
  if (typeof document === "undefined" || document.getElementById("ah-geometric-gallery-v3")) return;
  var style = document.createElement("style");
  style.id = "ah-geometric-gallery-v3";
  style.textContent = [
    "@media(min-width:1024px){",
    ".dgallery{position:relative}",
    ".dgal-wrap{position:relative}",
    ".dgal-wrap::before,.dgal-wrap::after{content:\"\";position:absolute;z-index:8;pointer-events:none;width:66px;height:3px;background:var(--primary);clip-path:polygon(0 0,100% 0,88% 100%,0 100%)}",
    ".dgal-wrap::before{left:0;top:-1px}",
    ".dgal-wrap::after{right:0;bottom:-1px;transform:rotate(180deg)}",
    ".dgal{--ah-gallery-ratio:2.449;position:relative;display:grid;grid-template-columns:minmax(0,2fr) minmax(280px,1fr);grid-template-rows:1fr 1fr;gap:0;aspect-ratio:var(--ah-gallery-ratio);align-items:stretch;overflow:hidden;border:1px solid rgba(20,19,18,.24);border-radius:0;background:#efede7;box-shadow:none}",
    ".dgal::before{content:\"\";position:absolute;z-index:7;pointer-events:none;top:0;bottom:0;left:66.666666%;width:1px;background:rgba(20,19,18,.26)}",
    ".dgal::after{content:\"\";position:absolute;z-index:8;pointer-events:none;top:0;left:calc(66.666666% - 1px);width:3px;height:56px;background:var(--primary);clip-path:polygon(0 0,100% 0,100% 82%,0 100%)}",
    ".dgal__f{position:relative;display:block;width:100%;height:100%;min-width:0;overflow:hidden;border:0;border-radius:0;background:#efede7}",
    ".dgal__f picture,.dgal__f img{display:block;width:100%;height:100%}",
    ".dgal__f img{object-fit:contain;object-position:center;background:#efede7;transform:none;transition:filter var(--ui-dur) var(--ui-ease)}",
    ".dgal__main{grid-column:1;grid-row:1 / 3;aspect-ratio:auto}",
    ".dgal__side{display:block;grid-column:2;aspect-ratio:auto}",
    ".dgal__main + .dgal__side{grid-row:1}",
    ".dgal__main + .dgal__side + .dgal__side{grid-row:2;border-top:1px solid rgba(20,19,18,.26)}",
    ".dgal__f:hover img,.dgal__f:focus-visible img{filter:brightness(.985)}",
    ".dgal__n{display:none}",
    ".dgal--1{display:block;aspect-ratio:auto;max-width:min(1180px,78vw);margin-inline:auto;overflow:visible;border:0;background:transparent;box-shadow:none}",
    ".dgal--1::before,.dgal--1::after{display:none}",
    ".dgal--1 .dgal__main{display:block;width:100%;height:auto;overflow:hidden;border:1px solid rgba(20,19,18,.24);background:#efede7}",
    ".dgal--1 .dgal__main picture,.dgal--1 .dgal__main img{width:auto;max-width:100%;height:auto;max-height:74vh;margin-inline:auto;background:#efede7}",
    ".dgal--2{grid-template-columns:repeat(2,minmax(0,1fr));grid-template-rows:1fr;aspect-ratio:var(--ah-gallery-ratio);max-width:1500px;margin-inline:auto}",
    ".dgal--2::before{left:50%}",
    ".dgal--2::after{left:calc(50% - 1px)}",
    ".dgal--2 .dgal__main,.dgal--2 .dgal__side{grid-column:auto;grid-row:1;aspect-ratio:auto;border-top:0}",
    ".dthumbs{gap:8px;padding:14px 0 6px;scrollbar-width:thin}",
    ".dthumb{position:relative;flex:0 0 92px;aspect-ratio:1.5;padding:1px;border:0;background:rgba(20,19,18,.20);opacity:.64;clip-path:polygon(0 0,calc(100% - 11px) 0,100% 11px,100% 100%,0 100%);transition:opacity var(--ui-dur) var(--ui-ease),background-color var(--ui-dur) var(--ui-ease),transform var(--ui-dur) var(--ui-ease)}",
    ".dthumb picture,.dthumb img{display:block;width:100%;height:100%;object-fit:contain;background:#efede7}",
    ".dthumb:hover,.dthumb:focus-visible{opacity:.94;background:var(--ink);transform:translateY(-1px)}",
    ".dthumb.is-active{opacity:1;background:var(--ink);box-shadow:none}",
    ".dthumb.is-active::before{content:\"\";position:absolute;z-index:2;left:0;top:0;width:34px;height:3px;background:var(--primary);clip-path:polygon(0 0,100% 0,88% 100%,0 100%)}",
    ".dgal-bar{justify-content:flex-end;gap:8px;min-height:42px;padding-top:8px}",
    ".dgal-bar__n{display:inline-flex;align-items:center;justify-content:center;min-width:62px;height:36px;padding:0 15px;border:1px solid rgba(20,19,18,.18);border-left:3px solid var(--primary);background:transparent;color:var(--ink);font-size:11px;line-height:1;font-weight:600;letter-spacing:.13em;clip-path:polygon(0 0,calc(100% - 9px) 0,100% 9px,100% 100%,0 100%)}",
    ".dgal-controls{gap:4px}",
    ".dgal-controls button{position:relative;width:40px;height:36px;border:1px solid rgba(20,19,18,.22);background:transparent;color:var(--ink);overflow:hidden;clip-path:polygon(0 0,calc(100% - 8px) 0,100% 8px,100% 100%,0 100%);transition:background-color var(--ui-dur) var(--ui-ease),border-color var(--ui-dur) var(--ui-ease)}",
    ".dgal-controls button::after{content:\"\";position:absolute;right:-8px;top:-8px;width:16px;height:16px;background:var(--primary);transform:rotate(45deg);opacity:0;transition:opacity var(--ui-dur) var(--ui-ease)}",
    ".dgal-controls button:hover,.dgal-controls button:focus-visible{background:rgba(20,19,18,.045);border-color:var(--ink)}",
    ".dgal-controls button:hover::after,.dgal-controls button:focus-visible::after{opacity:1}",
    ".dgal-wrap.ah-gal-single::before,.dgal-wrap.ah-gal-single::after{display:none}",
    "}"
  ].join("");
  document.head.appendChild(style);
})();

/* Align the mosaic to the native image ratio and keep supporting frames distinct. */
(function () {
  "use strict";
  if (typeof document === "undefined") return;

  function init() {
    var gal = document.getElementById("dgal");
    if (!gal || gal.dataset.ahGeometricV3 === "1") return;
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

    gal.dataset.ahGeometricV3 = "1";
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
      if (!isFinite(r) || r < 0.55 || r > 3.4) return;
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
