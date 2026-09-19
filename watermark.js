/* AutoHaus public product watermark.
   One container can render at most one watermark: the mark is a CSS pseudo
   element, never an appended DOM node. This avoids duplicate overlays even
   if the script re-runs or the gallery changes images repeatedly. */
(function () {
  "use strict";

  var ROOT = document.documentElement;
  var TARGET_SELECTOR = ".lc__pic,.dgal__f,.dthumb,#lb-stage";
  var enabled = false;
  var lastFetch = 0;
  var bodyObserver = null;

  function clamp(value, min, max, fallback) {
    value = Number(value);
    return Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
  }

  function installStyle() {
    if (document.getElementById("ah-watermark-v4-style")) return;

    /* Remove the old injected style if an older version of the script happened
       to run before this one on a stale/cached page. */
    var legacyStyle = document.getElementById("ah-watermark-v3-style");
    if (legacyStyle) legacyStyle.remove();

    var style = document.createElement("style");
    style.id = "ah-watermark-v4-style";
    style.textContent = [
      ".ah-watermark-target{position:relative!important;isolation:isolate}",
      ".ah-watermark-v4-on [data-ah-watermark-mode=overlay]::before{content:\"\";position:absolute;left:50%;top:50%;width:var(--ah-watermark-size,34%);max-width:360px;min-width:92px;aspect-ratio:481.9/85;transform:translate(-50%,-50%);pointer-events:none!important;z-index:40;background:transparent url('/autohaus.svg') center/contain no-repeat!important;opacity:var(--ah-watermark-opacity,.25);filter:none!important;box-shadow:none!important;border:0!important}",
      ".ah-watermark-v4-on .lc__pic[data-ah-watermark-mode=overlay]::before{max-width:260px;min-width:70px}",
      ".ah-watermark-v4-on .dgal__f[data-ah-watermark-mode=overlay]::before{max-width:380px}",
      ".ah-watermark-v4-on .dthumb[data-ah-watermark-mode=overlay]::before{max-width:72%;min-width:0}",
      ".ah-watermark-v4-on #lb-stage[data-ah-watermark-mode=overlay]::before{max-width:460px}",
      "html.lb-open .dgallery [data-ah-watermark-mode=overlay]::before{display:none!important}",
      "html.lb-open #lb-stage[data-ah-watermark-mode=overlay]::before{display:block!important}",
      ".lb .x{z-index:200!important;pointer-events:auto!important}",
      ".lb__nav{position:relative;z-index:200}",
      "#lb-stage{z-index:1}",
      "@media(max-width:767px){.ah-watermark-v4-on .dgal__f[data-ah-watermark-mode=overlay]::before{min-width:82px}.ah-watermark-v4-on .lc__pic[data-ah-watermark-mode=overlay]::before{min-width:66px}}"
    ].join("");
    document.head.appendChild(style);
  }

  function removeOldRuntimeMarks(root) {
    var scope = root && root.querySelectorAll ? root : document;
    scope.querySelectorAll(".ah-watermark-mark").forEach(function (mark) {
      mark.remove();
    });
    ROOT.classList.remove("ah-watermark-on", "ah-watermark-v2-on");
  }

  function imageSource(target) {
    var img = target && target.querySelector && target.querySelector("img");
    return img ? String(img.currentSrc || img.src || "") : "";
  }

  function hasEmbeddedAutoHausWatermark(target) {
    if (!target || !target.getAttribute) return false;

    /* Never infer embedded watermarks from legacy/source URLs. Some old
       AutoHaus images have no baked-in mark, and URL rewriting makes hostname
       heuristics unreliable. Only explicit per-image metadata can suppress the
       single public overlay. */
    return target.getAttribute("data-ah-watermark-embedded") === "1";
  }

  function markTarget(target) {
    if (!target || target.nodeType !== 1) return;
    removeOldRuntimeMarks(target);

    target.classList.add("ah-watermark-target");
    target.dataset.ahWatermarkMode = hasEmbeddedAutoHausWatermark(target) ? "embedded" : "overlay";
  }

  function decorate(root) {
    if (!root || root.nodeType !== 1 && root.nodeType !== 9) return;
    if (root.nodeType === 1 && root.matches && root.matches(TARGET_SELECTOR)) markTarget(root);
    if (!root.querySelectorAll) return;
    root.querySelectorAll(TARGET_SELECTOR).forEach(markTarget);
  }

  function applySettings(settings) {
    settings = settings || {};
    var transparency = clamp(settings.watermark_transparency, 0, 100, 75);
    var size = clamp(settings.watermark_size, 10, 60, 34);
    var opacity = (100 - transparency) / 100;

    enabled = settings.watermark_enabled === true;
    ROOT.style.setProperty("--ah-watermark-opacity", String(opacity));
    ROOT.style.setProperty("--ah-watermark-size", String(size) + "%");
    ROOT.classList.toggle("ah-watermark-v4-on", enabled);
    ROOT.classList.remove("ah-watermark-on", "ah-watermark-v2-on");

    removeOldRuntimeMarks(document);
    decorate(document);

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
      if (attempt < 2) {
        setTimeout(function () { fetchSettings(attempt + 1); }, 900 * (attempt + 1));
      } else {
        console.warn("AutoHaus watermark settings unavailable", error);
      }
      return null;
    });
  }

  function closestTarget(node) {
    if (!node || node.nodeType !== 1 || !node.closest) return null;
    return node.closest(TARGET_SELECTOR);
  }

  function observe() {
    if (!document.body || bodyObserver) return;

    bodyObserver = new MutationObserver(function (records) {
      records.forEach(function (record) {
        record.addedNodes.forEach(function (node) {
          if (!node || node.nodeType !== 1) return;
          removeOldRuntimeMarks(node);
          decorate(node);
          var owner = closestTarget(node);
          if (owner) markTarget(owner);
        });
      });
    });
    bodyObserver.observe(document.body, { childList: true, subtree: true });

    /* A gallery/lightbox reuses <img> elements and changes src. Re-evaluate
       only that image surface after the new image has actually loaded. */
    document.addEventListener("load", function (event) {
      var image = event.target;
      if (!image || image.tagName !== "IMG") return;
      var owner = closestTarget(image);
      if (owner) markTarget(owner);
    }, true);
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

    close.addEventListener("pointerdown", function (event) {
      event.stopPropagation();
    });
  }

  function init() {
    installStyle();
    removeOldRuntimeMarks(document);
    decorate(document);
    observe();
    installLightboxUX();
    fetchSettings(0);
  }

  window.AH_WATERMARK_REFRESH = function () { return fetchSettings(0); };
  window.AH_WATERMARK_SYNC = function (target) {
    if (target && target.nodeType === 1) markTarget(target);
  };

  window.addEventListener("focus", function () {
    if (Date.now() - lastFetch > 15000) fetchSettings(0);
  });

  document.addEventListener("visibilitychange", function () {
    if (!document.hidden && Date.now() - lastFetch > 15000) fetchSettings(0);
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
