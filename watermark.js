/* AutoHaus public product watermark.
   One dedicated watermark system owns every product-photo surface. The mark
   is drawn through an SVG alpha mask, not as a translucent image box, so only
   the logo pixels are painted and the photograph behind it is never covered by
   a grey rectangle. */
(function () {
  "use strict";

  var ROOT = document.documentElement;
  var TARGET_SELECTOR = ".lc__pic,.dgal__f,.dthumb,#lb-stage";
  var enabled = false;
  var lastFetch = 0;
  var bodyObserver = null;
  var rootObserver = null;

  function clamp(value, min, max, fallback) {
    value = Number(value);
    return Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
  }

  function installStyle() {
    if (document.getElementById("ah-watermark-v4-style")) return;
    var style = document.createElement("style");
    style.id = "ah-watermark-v4-style";
    style.textContent = [
      ".ah-watermark-target{position:relative!important;isolation:isolate}",
      ".ah-watermark-mark{display:none;position:absolute;left:50%;top:50%;width:var(--ah-watermark-size,34%);max-width:360px;min-width:92px;aspect-ratio:481.9/85;transform:translate(-50%,-50%);pointer-events:none!important;z-index:40;background:transparent!important;box-shadow:none!important;border:0!important;overflow:visible!important}",
      ".ah-watermark-v2-on .ah-watermark-mark{display:block}",
      ".ah-watermark-mark::before{content:\"\";position:absolute;inset:0;background:rgba(255,255,255,var(--ah-watermark-opacity,.25));-webkit-mask:url('/autohaus.svg') center/contain no-repeat;mask:url('/autohaus.svg') center/contain no-repeat;filter:drop-shadow(0 1px 1px rgba(0,0,0,.72)) drop-shadow(0 0 3px rgba(0,0,0,.34));pointer-events:none!important}",
      ".ah-watermark-mark>img{display:none!important}",
      ".lc__pic>.ah-watermark-mark{max-width:260px;min-width:70px}",
      ".dgal__f>.ah-watermark-mark{max-width:380px}",
      ".dthumb>.ah-watermark-mark{min-width:0;max-width:70%}",
      "#lb-stage>.ah-watermark-mark{max-width:460px}",
      ".lb .x{z-index:200!important;pointer-events:auto!important}",
      ".lb__nav{position:relative;z-index:200}",
      "#lb-stage{z-index:1}",
      "@media(max-width:767px){.dgal__f>.ah-watermark-mark{min-width:82px}.lc__pic>.ah-watermark-mark{min-width:66px}}"
    ].join("");
    document.head.appendChild(style);
  }

  function removeLegacyOverlay() {
    ROOT.classList.remove("ah-watermark-on");
  }

  function markerFor(target) {
    if (!target || target.nodeType !== 1) return;
    target.classList.add("ah-watermark-target");
    if (target.querySelector(":scope > .ah-watermark-mark")) return;
    var mark = document.createElement("span");
    mark.className = "ah-watermark-mark";
    mark.setAttribute("aria-hidden", "true");
    target.appendChild(mark);
  }

  function decorate(root) {
    if (!root || root.nodeType !== 1 && root.nodeType !== 9) return;
    if (root.nodeType === 1 && root.matches && root.matches(TARGET_SELECTOR)) markerFor(root);
    if (root.querySelectorAll) root.querySelectorAll(TARGET_SELECTOR).forEach(markerFor);
  }

  function applySettings(settings) {
    settings = settings || {};
    var transparency = clamp(settings.watermark_transparency, 0, 100, 75);
    var size = clamp(settings.watermark_size, 10, 60, 34);
    var opacity = (100 - transparency) / 100;
    enabled = settings.watermark_enabled === true;
    ROOT.style.setProperty("--ah-watermark-opacity", String(opacity));
    ROOT.style.setProperty("--ah-watermark-size", String(size) + "%");
    ROOT.classList.toggle("ah-watermark-v2-on", enabled);
    removeLegacyOverlay();
    if (enabled) decorate(document);
    window.dispatchEvent(new CustomEvent("ah:watermarkchange", { detail: {
      enabled: enabled,
      transparency: transparency,
      opacity: opacity,
      size: size
    }}));
  }

  function fetchSettings(attempt) {
    attempt = attempt || 0;
    lastFetch = Date.now();
    return fetch("/api/public/vehicles?settings=1&_=" + lastFetch, {
      method: "GET",
      headers: { Accept: "application/json" },
      credentials: "omit",
      cache: "no-store"
    }).then(function (response) {
      if (!response.ok) throw new Error("watermark settings " + response.status);
      return response.json();
    }).then(function (data) {
      if (!data || data.ok !== true || !data.settings) throw new Error("invalid watermark settings");
      applySettings(data.settings);
      return data.settings;
    }).catch(function (error) {
      if (attempt < 2) setTimeout(function () { fetchSettings(attempt + 1); }, 900 * (attempt + 1));
      else console.warn("AutoHaus watermark settings unavailable", error);
      return null;
    });
  }

  function observe() {
    if (document.body && !bodyObserver) {
      bodyObserver = new MutationObserver(function (records) {
        removeLegacyOverlay();
        if (!enabled) return;
        records.forEach(function (record) {
          record.addedNodes.forEach(function (node) {
            if (node.nodeType === 1) decorate(node);
          });
        });
      });
      bodyObserver.observe(document.body, { childList: true, subtree: true });
    }
    if (!rootObserver) {
      rootObserver = new MutationObserver(removeLegacyOverlay);
      rootObserver.observe(ROOT, { attributes: true, attributeFilter: ["class"] });
    }
  }

  function installLightboxUX() {
    var lb = document.getElementById("lb");
    var stage = document.getElementById("lb-stage");
    var close = document.getElementById("lb-close");
    if (!lb || !stage || !close || lb.dataset.ahCloseFix === "1") return;
    lb.dataset.ahCloseFix = "1";
    stage.addEventListener("click", function (event) {
      if (event.target === stage) close.click();
    });
    close.addEventListener("pointerdown", function (event) { event.stopPropagation(); });
  }

  function init() {
    installStyle();
    removeLegacyOverlay();
    observe();
    decorate(document);
    installLightboxUX();
    fetchSettings(0);
  }

  window.AH_WATERMARK_REFRESH = function () { return fetchSettings(0); };
  window.addEventListener("focus", function () {
    if (Date.now() - lastFetch > 15000) fetchSettings(0);
  });
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden && Date.now() - lastFetch > 15000) fetchSettings(0);
  });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
