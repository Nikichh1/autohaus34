/* AutoHaus geometric desktop gallery enhancement. Loaded by data/photo-insets.js only on vehicle pages. */
(function () {
  "use strict";
  if (typeof document === "undefined" || document.getElementById("ah-desktop-gallery-fit")) return;
  var style = document.createElement("style");
  style.id = "ah-desktop-gallery-fit";
  style.textContent = [
    "@media(min-width:1024px){",
    ".dgallery{position:relative}",
    ".dgal-wrap{position:relative}",
    ".dgal-wrap::before,.dgal-wrap::after{content:\"\";position:absolute;z-index:6;pointer-events:none;height:3px;width:54px;background:var(--primary);transform:skewX(-34deg)}",
    ".dgal-wrap::before{left:0;top:-1px;transform-origin:left center}",
    ".dgal-wrap::after{right:0;bottom:-1px;transform-origin:right center}",
    ".dgal{--ah-gal-gap:5px;position:relative;display:grid;grid-template-columns:minmax(0,2fr) minmax(270px,1fr);grid-template-rows:1fr 1fr;column-gap:var(--ah-gal-gap);row-gap:0;aspect-ratio:2.457 / 1;align-items:stretch;overflow:hidden;border:1px solid rgba(20,19,18,.20);border-radius:0;background:var(--paper-2);box-shadow:0 14px 34px rgba(20,19,18,.055)}",
    ".dgal::before{content:\"\";position:absolute;z-index:5;pointer-events:none;top:0;bottom:0;left:calc(66.6667% - 1px);width:1px;background:linear-gradient(to bottom,var(--primary) 0 52px,rgba(20,19,18,.20) 52px 100%)}",
    ".dgal::after{content:\"\";position:absolute;z-index:5;pointer-events:none;right:0;top:0;width:74px;height:1px;background:linear-gradient(to left,var(--ink),transparent)}",
    ".dgal__f{position:relative;display:block;width:100%;height:100%;min-width:0;overflow:hidden;border:0;border-radius:0;background:#f1efe9}",
    ".dgal__f picture,.dgal__f img{display:block;width:100%;height:100%}",
    ".dgal__f img{object-fit:contain;object-position:center;background:#f1efe9;transform:none;transition:filter var(--ui-dur) var(--ui-ease)}",
    ".dgal__main{grid-column:1;grid-row:1 / 3;aspect-ratio:auto}",
    ".dgal__side{display:block;grid-column:2;aspect-ratio:auto}",
    ".dgal__main + .dgal__side{grid-row:1}",
    ".dgal__main + .dgal__side + .dgal__side{grid-row:2;border-top:1px solid rgba(20,19,18,.22)}",
    ".dgal__f:hover img,.dgal__f:focus-visible img{filter:brightness(.985)}",
    ".dgal__n{display:none}",
    ".dgal--1{display:block;aspect-ratio:auto;max-width:min(1180px,78vw);margin-inline:auto;overflow:visible;border:0;background:transparent;box-shadow:none}",
    ".dgal--1::before,.dgal--1::after{display:none}",
    ".dgal--1 .dgal__main{display:block;width:100%;height:auto;overflow:hidden;border:1px solid rgba(20,19,18,.20);background:#f1efe9;box-shadow:0 14px 34px rgba(20,19,18,.055)}",
    ".dgal--1 .dgal__main picture,.dgal--1 .dgal__main img{width:auto;max-width:100%;height:auto;max-height:74vh;margin-inline:auto;background:#f1efe9}",
    ".dgal--2{grid-template-columns:repeat(2,minmax(0,1fr));grid-template-rows:1fr;aspect-ratio:3.275 / 1;max-width:1500px;margin-inline:auto}",
    ".dgal--2::before{left:50%;background:linear-gradient(to bottom,var(--primary) 0 52px,rgba(20,19,18,.20) 52px 100%)}",
    ".dgal--2 .dgal__main,.dgal--2 .dgal__side{grid-column:auto;grid-row:1;aspect-ratio:auto;border-top:0}",
    ".dthumbs{gap:8px;padding:13px 0 7px;scrollbar-width:thin}",
    ".dthumb{position:relative;flex:0 0 92px;aspect-ratio:1.5;padding:1px;border:0;background:rgba(20,19,18,.18);opacity:.66;clip-path:polygon(0 0,calc(100% - 10px) 0,100% 10px,100% 100%,0 100%);transition:opacity var(--ui-dur) var(--ui-ease),background-color var(--ui-dur) var(--ui-ease),transform var(--ui-dur) var(--ui-ease)}",
    ".dthumb picture,.dthumb img{display:block;width:100%;height:100%;object-fit:contain;background:#f1efe9}",
    ".dthumb:hover,.dthumb:focus-visible{opacity:.9;background:var(--ink);transform:translateY(-1px)}",
    ".dthumb.is-active{opacity:1;background:var(--ink);box-shadow:none}",
    ".dthumb.is-active::after{content:\"\";position:absolute;left:0;bottom:0;width:32px;height:3px;background:var(--primary);clip-path:polygon(0 0,100% 0,86% 100%,0 100%)}",
    ".dgal-bar{justify-content:flex-end;gap:10px;min-height:42px;padding-top:8px}",
    ".dgal-bar__n{display:inline-flex;align-items:center;min-width:58px;height:36px;padding:0 16px 0 12px;border-left:2px solid var(--primary);background:rgba(20,19,18,.045);color:var(--ink);font-size:11px;line-height:1;font-weight:600;letter-spacing:.12em;clip-path:polygon(0 0,calc(100% - 9px) 0,100% 9px,100% 100%,0 100%)}",
    ".dgal-controls{gap:5px}",
    ".dgal-controls button{position:relative;width:38px;height:36px;border:1px solid rgba(20,19,18,.22);background:transparent;color:var(--ink);overflow:hidden;transition:background-color var(--ui-dur) var(--ui-ease),border-color var(--ui-dur) var(--ui-ease)}",
    ".dgal-controls button::after{content:\"\";position:absolute;right:-7px;top:-7px;width:14px;height:14px;background:var(--primary);transform:rotate(45deg);opacity:0;transition:opacity var(--ui-dur) var(--ui-ease)}",
    ".dgal-controls button:hover,.dgal-controls button:focus-visible{background:rgba(20,19,18,.045);border-color:var(--ink)}",
    ".dgal-controls button:hover::after,.dgal-controls button:focus-visible::after{opacity:1}",
    "}"
  ].join("");
  document.head.appendChild(style);
})();

(function () {
  "use strict";
  if (typeof document === "undefined") return;
  function init() {
    var gal = document.getElementById("dgal");
    if (!gal || gal.dataset.ahSideSync === "1") return;
    var main = gal.querySelector(".dgal__main");
    var sides = Array.prototype.slice.call(gal.querySelectorAll(".dgal__side"));
    if (!main || !sides.length) return;
    var frames = [main].concat(sides);
    var seed = frames.map(function (frame) {
      var picture = frame.querySelector("picture");
      var counter = frame.querySelector(".dgal__n");
      return { i:Number(frame.dataset.i || 0), href:frame.getAttribute("href") || "", aria:frame.getAttribute("aria-label") || "", picture:picture ? picture.outerHTML : "", counter:counter ? counter.textContent : "" };
    });
    gal.dataset.ahSideSync = "1";
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
    function sync() {
      if (!matchMedia("(min-width:1024px)").matches) return;
      var selected = Number(main.dataset.i || 0);
      var pool = seed.filter(function (shot) { return shot.i !== selected; });
      if (pool.length < sides.length) pool = seed.slice();
      sides.forEach(function (frame, index) { paint(frame, pool[index % pool.length]); });
    }
    new MutationObserver(sync).observe(main, { attributes:true, attributeFilter:["data-i"] });
    addEventListener("resize", sync, { passive:true });
    sync();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once:true });
  else setTimeout(init, 0);
})();
