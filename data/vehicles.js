/* AutoHaus inventory: resolve managed data before rendering vehicle UI.
   The bundled snapshot is the fallback; no blocking XHR or evaluated code. */
(function () {
  "use strict";
  window.AH_VEHICLES = window.AH_VEHICLES || [];
  window.AH_MANAGED_VEHICLES = Object.create(null);
  window.AH_IMAGE_VARIANTS = Object.create(null);
  window.AH_INVENTORY_SOURCE = "static";
  var controller = typeof AbortController === "function" ? new AbortController() : null;
  var timer;
  var timeout = new Promise(function (resolve) {
    timer = setTimeout(function () {
      if (controller) controller.abort();
      resolve(null);
    }, 4500);
  });
  var request = fetch("/api/public/vehicles", {
    headers: { Accept: "application/json" },
    credentials: "omit",
    signal: controller ? controller.signal : undefined
  }).then(function (response) {
    return response.ok ? response.json() : null;
  }).catch(function () { return null; });
  window.AH_INVENTORY_READY = Promise.race([request, timeout]).then(function (data) {
    clearTimeout(timer);
    if (!data || data.authoritative !== true || !Array.isArray(data.vehicles)) return;
    // An intentionally empty managed inventory stays empty. Only an unavailable
    // or unconfigured backend selects the static fallback.
    var valid = data.vehicles.every(function (v) {
      return v && typeof v.id === "string" && typeof v.make === "string" &&
        typeof v.model === "string" && Array.isArray(v.shots) && Array.isArray(v.tags);
    });
    if (!valid) return;
    window.AH_VEHICLES = data.vehicles;
    window.AH_INVENTORY_SOURCE = "managed";
    data.vehicles.forEach(function (v) {
      window.AH_MANAGED_VEHICLES[v.id] = v;
      (v.managed_images || []).forEach(function (image) {
        if (!image || !image.variants) return;
        var variants = image.variants;
        [image.original, variants.jpg1280, variants.jpg800, variants.jpg400].forEach(function (url) {
          if (url) window.AH_IMAGE_VARIANTS[url] = variants;
        });
      });
    });
  });
})();
