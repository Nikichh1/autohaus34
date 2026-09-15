/* Passive local-fixture diagnostics. Never shipped in dist or production. */
(function () {
  var stats = { lcp: 0, cls: 0, errors: [], firstProducts: 0, firstPhoto: 0 };
  function observe(type, fn) {
    try { new PerformanceObserver(function (list) { list.getEntries().forEach(fn); }).observe({ type: type, buffered: true }); } catch (_) {}
  }
  observe('largest-contentful-paint', function (entry) { stats.lcp = entry.startTime; });
  observe('layout-shift', function (entry) { if (!entry.hadRecentInput) stats.cls += entry.value; });
  addEventListener('error', function (event) { if (event.message) stats.errors.push(event.message); });
  addEventListener('unhandledrejection', function (event) { stats.errors.push(String(event.reason)); });
  function snapshot() {
    var cards = document.querySelectorAll('#cat-grid .lc, #pv-grid .lc');
    if (cards.length && !stats.firstProducts) stats.firstProducts = performance.now();
    var photo = document.querySelector('.dgal__main img');
    if (photo && photo.complete && photo.naturalWidth && !stats.firstPhoto) stats.firstPhoto = performance.now();
    var resources = performance.getEntriesByType('resource').map(function (r) {
      return { name: new URL(r.name).pathname, start: Math.round(r.startTime), duration: Math.round(r.duration), bytes: r.transferSize };
    });
    var paints = performance.getEntriesByType('paint').map(function (p) { return { name: p.name, time: Math.round(p.startTime) }; });
    document.documentElement.dataset.performance = JSON.stringify(Object.assign({}, stats, { resources: resources, paints: paints }));
  }
  // Observation only: do not scroll, click, preload or otherwise alter the app.
  setInterval(snapshot, 100);
})();
