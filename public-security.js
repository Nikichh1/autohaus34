/* AutoHaus public protection layer.
   Keep protection deliberately lightweight: normal browsing and image loading
   must always win over anti-scraping tricks. This module only adds the signed
   enquiry challenge, removes direct full-image gallery links and keeps gallery
   arrows focused on the main frame. It never re-downloads or rewrites images. */
(function () {
  "use strict";

  var nativeFetch = window.fetch.bind(window);
  var challenge = "";
  var challengeAt = 0;
  var challengePromise = null;
  var CHALLENGE_CACHE_MS = 8 * 60 * 1000;
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

  function normalizeImages(root) {
    if (!root) return;
    if (root.nodeType === 1 && root.matches && root.matches("img")) root.setAttribute("draggable", "false");
    if (root.querySelectorAll) root.querySelectorAll("img").forEach(function (img) { img.setAttribute("draggable", "false"); });
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
    normalizeImages(root);
    scrubGalleryLinks(root.nodeType === 1 || root.nodeType === 9 ? root : document);
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
