/* AutoHaus inventory: resolve managed data before rendering vehicle UI.
   The bundled snapshot is the fallback; no blocking XHR or evaluated code. */
(function () {
  "use strict";
  window.AH_VEHICLES = window.AH_VEHICLES || [];
  window.AH_MANAGED_VEHICLES = Object.create(null);
  window.AH_IMAGE_VARIANTS = Object.create(null);
  window.AH_INVENTORY_SOURCE = "static";

  var bundledShots = Object.create(null);

  function directVariants(url) {
    return { jpg400: url, jpg800: url, jpg1280: url, webp400: url, webp800: url, webp1280: url };
  }

  function indexVehicle(v) {
    if (!v || !v.id) return;
    window.AH_MANAGED_VEHICLES[v.id] = v;
    (v.local_shots || []).forEach(function (url) { if (url) bundledShots[url] = true; });
    (v.managed_images || []).forEach(function (image) {
      if (!image || bundledShots[image.original] || !image.variants || !Object.keys(image.variants).length) return;
      var variants = image.variants;
      [image.original, variants.jpg1280, variants.jpg800, variants.jpg400].forEach(function (url) {
        if (url) window.AH_IMAGE_VARIANTS[url] = variants;
      });
    });
    // New/changed live photos do not exist in the bundled img/v directory.
    // Mark them as direct remote variants so the image helper never invents
    // a local path that can 404.
    (v.shots || []).forEach(function (url) {
      if (url && !bundledShots[url] && !window.AH_IMAGE_VARIANTS[url]) {
        window.AH_IMAGE_VARIANTS[url] = directVariants(url);
      }
    });
  }

  function timedJson(url, ms) {
    var controller = typeof AbortController === "function" ? new AbortController() : null;
    var timer;
    var timeout = new Promise(function (resolve) {
      timer = setTimeout(function () {
        if (controller) controller.abort();
        resolve(null);
      }, ms || 4500);
    });
    var request = fetch(url, {
      headers: { Accept: "application/json" },
      credentials: "omit",
      signal: controller ? controller.signal : undefined
    }).then(function (response) {
      return response.ok ? response.json() : null;
    }).catch(function () { return null; });
    return Promise.race([request, timeout]).then(function (data) {
      clearTimeout(timer);
      return data;
    });
  }

  var path = location.pathname;
  var isVehiclePage = /(?:^|\/)vehicle\.html$/.test(path);
  var isConciergePage = /(?:^|\/)concierge\.html$/.test(path);
  var isCatalogPage = path === "/" || /(?:^|\/)index\.html$/.test(path);
  var params = new URLSearchParams(location.search);
  var requestedId = isVehiclePage ? params.get("id") : "";
  if (requestedId && !/^[a-z0-9-]+$/.test(requestedId)) requestedId = "";
  var request = requestedId ? timedJson("/api/public/vehicles?id=" + encodeURIComponent(requestedId), 8000)
    : (isCatalogPage || isConciergePage) ? timedJson("/api/public/vehicles", 8000) : Promise.resolve(null);

  window.AH_INVENTORY_READY = request.then(function (data) {
    var vehicles = requestedId && data && data.vehicle ? [data.vehicle] : data && data.vehicles;
    if (!data || data.authoritative !== true || !Array.isArray(vehicles)) return;
    var valid = vehicles.every(function (v) {
      return v && typeof v.id === "string" && typeof v.make === "string" &&
        typeof v.model === "string" && Array.isArray(v.shots) && Array.isArray(v.tags);
    });
    if (!valid) return;

    window.AH_VEHICLES = vehicles;
    window.AH_INVENTORY_SOURCE = "managed";
    vehicles.forEach(indexVehicle);
  });
})();
