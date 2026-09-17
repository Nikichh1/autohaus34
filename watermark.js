/* AutoHaus public product watermark.
   The global admin setting is read on every public page load and applied to
   every product-photo surface, including content rendered after page load. */
(function () {
  "use strict";

  var ROOT = document.documentElement;
  var TARGET_SELECTOR = ".lc__pic,.dgal__f,.dthumb,#lb-stage";
  var enabled = false;
  var lastFetch = 0;
  var bodyObserver = null;
  var rootObserver = null;

  function clamp(value, min, max) {
    value = Number(value);
    return Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : min;
  }

  function installStyle() {
    if (document.getElementById("ah-watermark-v2-style")) return;
    var style = document.createElement("style");
    style.id = "ah-watermark-v2-style";
    style.textContent = [
      ".ah-watermark-target{position:relative!important;isolation:isolate}",
      ".ah-watermark-mark{display:none;position:absolute;left:50%;top:50%;width:34%;max-width:360px;min-width:92px;aspect-ratio:481.9/85;transform:translate(-50%,-50%);pointer-events:none;z-index:40}",
      ".ah-watermark-v2-on .ah-watermark-mark{display:block}",
      ".ah-watermark-mark::before{content:\"\";position:absolute;inset:0;background:url('/autohaus.svg') center/contain no-repeat;filter:brightness(0);opacity:var(--ah-watermark-opacity,.25);transform:translate(1px,1px)}",
      ".ah-watermark-mark>img{position:absolute;inset:0;display:block;width:100%;height:100%;object-fit:contain;opacity:var(--ah-watermark-opacity,.25);filter:drop-shadow(0 1px 1px rgba(0,0,0,.72)) drop-shadow(0 0 3px rgba(0,0,0,.34));user-select:none;-webkit-user-drag:none}",
      ".lc__pic>.ah-watermark-mark{width:38%;max-width:230px}",
      ".dgal__f>.ah-watermark-mark{width:32%;max-width:340px}",
      ".dthumb>.ah-watermark-mark{width:48%;min-width:0;max-width:48%}",
      "#lb-stage>.ah-watermark-mark{width:30%;max-width:390px}",
      "@media(max-width:767px){.dgal__f>.ah-watermark-mark{width:42%;min-width:86px}.lc__pic>.ah-watermark-mark{width:42%;min-width:72px}}
    ].join("");
    document.head.appendChild(style);
  }

  function removeLegacyOverlay() {
    /* The previous implementation used a pseudo-element controlled by this
       class. Keep it disabled so there can never be two watermarks. */
    if (ROOT.classList.contains("ah-watermark-on")) ROOT.classList.remove("ah-watermark-on");
  }

  function markerFor(target) {
    if (!target || target.nodeType !== 1) return;
    target.classList.add("ah-watermark-target");
    if (target.querySelector(":scope > .ah-watermark-mark")) return;
    var mark = document.createElement("span");
    mark.className = "ah-watermark-mark";
    mark.setAttribute("aria-hidden", "true");
    var image = document.createElement("img");
    image.src = "/autohaus.svg";
    image.alt = "";
    image.draggable = false;
    image.decoding = "async";
    mark.appendChild(image);
    target.appendChild(mark);
  }

  function decorate(root) {
    if (!root || root.nodeType !== 1 && root.nodeType !== 9) return;
    if (root.nodeType === 1 && root.matches && root.matches(TARGET_SELECTOR)) markerFor(root);
    if (!root.querySelectorAll) return;
    root.querySelectorAll(TARGET_SELECTOR).forEach(markerFor);
  }

  function applySettings(settings) {
    settings = settings || {};
    var transparency = clamp(settings.watermark_transparency, 0, 100);
    var opacity = (100 - transparency) / 100;
    enabled = settings.watermark_enabled === true;
    ROOT.style.setProperty("--ah-watermark-opacity", String(opacity));
    ROOT.classList.toggle("ah-watermark-v2-on", enabled);
    removeLegacyOverlay();
    if (enabled) decorate(document);
    window.dispatchEvent(new CustomEvent("ah:watermarkchange", { detail: {
      enabled: enabled,
      transparency: transparency,
      opacity: opacity
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
      if (attempt < 2) {
        setTimeout(function () { fetchSettings(attempt + 1); }, 900 * (attempt + 1));
      } else {
        console.warn("AutoHaus watermark settings unavailable", error);
      }
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

  function init() {
    installStyle();
    removeLegacyOverlay();
    observe();
    decorate(document);
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
