/* Warm only the vehicle cards a visitor is approaching. This is especially
   useful on touch screens where there is no hover interval before the tap. */
(function () {
  "use strict";
  if (!("IntersectionObserver" in window)) return;
  var coarse = matchMedia("(hover:none), (pointer:coarse)").matches;
  var warmed = Object.create(null), active = 0;
  var MAX_ACTIVE = coarse ? 1 : 2;
  var MAX_WARMED = coarse ? 10 : 24;
  var warmedCount = 0;

  function vehicleId(link) {
    try { return new URL(link.href, location.href).searchParams.get("id") || ""; }
    catch (_) { return ""; }
  }

  function warm(link) {
    if (!link || !window.AH_PREFETCH_VEHICLE || active >= MAX_ACTIVE || warmedCount >= MAX_WARMED) return;
    var connection = navigator.connection;
    if (connection && (connection.saveData || /^(slow-2g|2g)$/.test(connection.effectiveType || ""))) return;
    var id = vehicleId(link);
    if (!/^[a-z0-9-]+$/.test(id) || warmed[id]) return;
    warmed[id] = true;
    warmedCount++;
    active++;
    Promise.resolve(window.AH_PREFETCH_VEHICLE(id)).finally(function () { active = Math.max(0, active - 1); });

    /* HTML prefetch is useful with hover time on desktop, but on a phone it
       competes directly with visible product photos. Touch intent already
       starts the API request from catalog.js, so keep this desktop-only. */
    if (!coarse) {
      var page = document.createElement("link");
      page.rel = "prefetch";
      page.href = link.href;
      document.head.appendChild(page);
    }
  }

  function scheduleWarm(link) {
    var run = function () { warm(link); };
    if ("requestIdleCallback" in window) requestIdleCallback(run, { timeout: coarse ? 900 : 500 });
    else setTimeout(run, coarse ? 220 : 80);
  }

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      io.unobserve(entry.target);
      scheduleWarm(entry.target);
    });
  }, { rootMargin: (coarse ? "220px 0px" : "600px 0px"), threshold: 0.01 });

  function scan(root) {
    if (!root || !root.querySelectorAll) return;
    if (root.matches && root.matches(".lc__link")) io.observe(root);
    root.querySelectorAll(".lc__link").forEach(function (link) { io.observe(link); });
  }

  scan(document);
  new MutationObserver(function (records) {
    records.forEach(function (record) {
      record.addedNodes.forEach(function (node) { if (node.nodeType === 1) scan(node); });
    });
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
