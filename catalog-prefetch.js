/* Warm only the vehicle cards a visitor is approaching. This is especially
   useful on touch screens where there is no hover interval before the tap. */
(function () {
  "use strict";
  if (!("IntersectionObserver" in window)) return;
  var warmed = Object.create(null), active = 0, MAX_ACTIVE = 4;

  function vehicleId(link) {
    try { return new URL(link.href, location.href).searchParams.get("id") || ""; }
    catch (_) { return ""; }
  }

  function warm(link) {
    if (!link || !window.AH_PREFETCH_VEHICLE || active >= MAX_ACTIVE) return;
    var id = vehicleId(link);
    if (!/^[a-z0-9-]+$/.test(id) || warmed[id]) return;
    warmed[id] = true; active++;
    Promise.resolve(window.AH_PREFETCH_VEHICLE(id)).finally(function () { active = Math.max(0, active - 1); });

    var page = document.createElement("link");
    page.rel = "prefetch";
    page.href = link.href;
    document.head.appendChild(page);
  }

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      io.unobserve(entry.target);
      warm(entry.target);
    });
  }, { rootMargin: "700px 0px", threshold: 0.01 });

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
