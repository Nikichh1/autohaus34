/* AutoHaus public protection layer.
   - Adds a short-lived signed challenge to enquiry submissions without adding
     any visible CAPTCHA or extra step for a normal visitor.
   - Removes direct full-image gallery links and de-links rendered product
     images from their source URLs after they are already decoded. This blocks
     common DOM-based image extractors while preserving normal rendering,
     caching, responsive loading and the gallery UX.
   This is deterrence, not DRM: pixels displayed by a browser can never be made
   mathematically impossible to capture. */
(function () {
  "use strict";

  var nativeFetch = window.fetch.bind(window);
  var challenge = "";
  var challengeAt = 0;
  var challengePromise = null;
  var CHALLENGE_CACHE_MS = 8 * 60 * 1000;
  var IMAGE_SELECTOR = ".lc__pic img,.dgal__f img,.dthumb img,#lb-stage img";
  var idle = window.requestIdleCallback || function (fn) { return setTimeout(fn, 900); };

  function urlFor(input) {
    try { return new URL(typeof input === "string" ? input : input && input.url, location.href); }
    catch (_) { return null; }
  }

  function getChallenge(force) {
    if (!force && challenge && Date.now() - challengeAt < CHALLENGE_CACHE_MS) return Promise.resolve(challenge);
    if (challengePromise) return challengePromise;
    challengePromise = nativeFetch("/api/inquiry?challenge=1", {
      method: "GET",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
      cache: "no-store"
    }).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (data) {
        if (!response.ok || !data || data.ok !== true || typeof data.challenge !== "string" || !data.challenge) {
          throw new Error("challenge unavailable");
        }
        challenge = data.challenge;
        challengeAt = Date.now();
        return challenge;
      });
    }).finally(function () { challengePromise = null; });
    return challengePromise;
  }

  /* All public enquiry code already uses fetch with a JSON body. Wrapping it
     here lets vehicle.js and concierge.js stay simple and means a bot posting
     straight at /api/inquiry does not get the server-signed browser challenge. */
  window.fetch = function (input, init) {
    init = init || {};
    var url = urlFor(input);
    var method = String(init.method || "GET").toUpperCase();
    var isInquiry = url && url.origin === location.origin && url.pathname === "/api/inquiry" &&
      method === "POST" && typeof init.body === "string";
    if (!isInquiry) return nativeFetch(input, init);

    var parsed;
    try { parsed = JSON.parse(init.body); }
    catch (_) { return nativeFetch(input, init); }

    return getChallenge(false).catch(function () { return getChallenge(true); }).then(function (token) {
      parsed.challenge = token;
      var headers = new Headers(init.headers || {});
      if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
      if (!headers.has("Accept")) headers.set("Accept", "application/json");
      return nativeFetch(input, Object.assign({}, init, {
        credentials: "same-origin",
        headers: headers,
        body: JSON.stringify(parsed)
      }));
    });
  };

  function scrubGalleryLinks(root) {
    if (!root || !root.querySelectorAll) return;
    root.querySelectorAll(".dgal__f[href]").forEach(function (link) {
      if (link.dataset.ahSourceLinkScrubbed === "1") return;
      link.dataset.ahSourceLinkScrubbed = "1";
      link.setAttribute("href", "#photo-" + ((Number(link.dataset.i) || 0) + 1));
      link.removeAttribute("download");
    });
  }

  function deLinkImage(img) {
    if (!img || !img.isConnected || img.dataset.ahImageShieldState) return;
    var sourceUrl = img.currentSrc || img.src;
    if (!sourceUrl || /^(?:blob:|data:)/i.test(sourceUrl)) return;
    var url = urlFor(sourceUrl);
    if (!url || !/^https?:$/.test(url.protocol)) return;

    img.dataset.ahImageShieldState = "working";
    nativeFetch(url.href, {
      method: "GET",
      credentials: url.origin === location.origin ? "same-origin" : "omit",
      mode: url.origin === location.origin ? "same-origin" : "cors",
      cache: "force-cache",
      referrerPolicy: "same-origin"
    }).then(function (response) {
      if (!response.ok) throw new Error("image fetch " + response.status);
      return response.blob();
    }).then(function (blob) {
      if (!img.isConnected || !blob || !/^image\//i.test(blob.type || "image/unknown")) throw new Error("image changed");
      var objectUrl = URL.createObjectURL(blob);
      var picture = img.closest("picture");

      /* The visible pixels are already decoded before this runs. Replacing the
         DOM URL with a short-lived object URL happens during idle time and
         does not introduce another network download because force-cache is
         used. Common extractors that inspect <img src/srcset> after rendering
         therefore receive an already-revoked blob URL instead of the clean
         source path. */
      if (picture) picture.querySelectorAll("source").forEach(function (source) {
        source.removeAttribute("srcset");
        source.removeAttribute("sizes");
      });
      img.removeAttribute("srcset");
      img.removeAttribute("sizes");
      img.src = objectUrl;
      img.dataset.ahImageShieldState = "done";
      img.setAttribute("draggable", "false");
      img.style.webkitUserDrag = "none";
      var decoded = img.decode ? img.decode().catch(function () {}) : Promise.resolve();
      decoded.finally(function () {
        setTimeout(function () { URL.revokeObjectURL(objectUrl); }, 1200);
      });
    }).catch(function () {
      /* CORS/privacy extensions can reject the secondary cache read. Keep the
         original image untouched in that case; protection must never make a
         legitimate visitor lose a photograph. */
      if (img) img.dataset.ahImageShieldState = "fallback";
    });
  }

  function armImage(img) {
    if (!img || img.dataset.ahImageShieldArmed === "1") return;
    img.dataset.ahImageShieldArmed = "1";
    img.setAttribute("draggable", "false");
    function schedule() {
      idle(function () { deLinkImage(img); }, { timeout: 2600 });
    }
    if (img.complete && img.naturalWidth) schedule();
    else img.addEventListener("load", schedule, { once: true, passive: true });
  }

  function protectImages(root) {
    if (!root) return;
    if (root.nodeType === 1 && root.matches && root.matches(IMAGE_SELECTOR)) armImage(root);
    if (root.querySelectorAll) root.querySelectorAll(IMAGE_SELECTOR).forEach(armImage);
    scrubGalleryLinks(root.nodeType === 1 || root.nodeType === 9 ? root : document);
  }

  function installMainOnlyGalleryArrows(root) {
    if (!root || !root.querySelectorAll) return;
    ["prev", "next"].forEach(function (direction) {
      var button = root.querySelector("#dgal-" + direction) || document.getElementById("dgal-" + direction);
      if (!button || button.dataset.ahMainOnly === "1") return;
      button.dataset.ahMainOnly = "1";
      button.addEventListener("click", function (event) {
        var main = document.querySelector("#dgal .dgal__main");
        var thumbs = Array.prototype.slice.call(document.querySelectorAll("#dthumbs .dthumb"));
        if (!main || thumbs.length < 2) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        var current = Number(main.dataset.i) || 0;
        var step = direction === "next" ? 1 : -1;
        var next = (current + step + thumbs.length) % thumbs.length;
        thumbs[next].click();
      }, true);
    });
  }

  function protectNode(root) {
    protectImages(root);
    installMainOnlyGalleryArrows(root.nodeType === 9 ? document : root);
  }

  function init() {
    protectNode(document);
    var observer = new MutationObserver(function (records) {
      records.forEach(function (record) {
        record.addedNodes.forEach(function (node) {
          if (node.nodeType === 1) protectNode(node);
        });
      });
    });
    if (document.body) observer.observe(document.body, { childList: true, subtree: true });

    /* Warm the invisible anti-spam challenge without delaying rendering or
       form interaction. It is also refreshed on intent so a long-open tab is
       never punished. */
    idle(function () { getChallenge(false).catch(function () {}); }, { timeout: 3500 });
    ["pointerdown", "focusin", "touchstart"].forEach(function (name) {
      document.addEventListener(name, function (event) {
        if (event.target && event.target.closest && event.target.closest("form")) getChallenge(false).catch(function () {});
      }, { passive: true, capture: true });
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
