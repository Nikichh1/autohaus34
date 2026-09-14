/* AutoHaus inventory: resolve managed data before rendering vehicle UI.
   The bundled snapshot is the fallback; no blocking XHR or evaluated code. */
(function () {
  "use strict";
  window.AH_VEHICLES = window.AH_VEHICLES || [];
  window.AH_MANAGED_VEHICLES = Object.create(null);
  window.AH_IMAGE_VARIANTS = Object.create(null);
  window.AH_INVENTORY_SOURCE = "static";

  // Remember which exact WordPress shots are already bundled locally. A live
  // vehicle can keep its slug while receiving new photos; only exact matches
  // may safely use img/v/*.
  var bundledShots = Object.create(null);
  (window.AH_LOCAL_PHOTOS || []).forEach(function(url) { bundledShots[url] = true; });
  window.AH_VEHICLES.forEach(function (v) {
    (v.shots || []).forEach(function (url) { if (url) bundledShots[url] = true; });
  });

  function directVariants(url) {
    return { jpg400: url, jpg800: url, jpg1280: url, webp400: url, webp800: url, webp1280: url };
  }

  function indexVehicle(v) {
    if (!v || !v.id) return;
    window.AH_MANAGED_VEHICLES[v.id] = v;
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

  window.AH_INVENTORY_READY = timedJson("/api/public/vehicles", 12000).then(async function (data) {
    if (!data || data.authoritative !== true || !Array.isArray(data.vehicles)) return;
    var valid = data.vehicles.every(function (v) {
      return v && typeof v.id === "string" && typeof v.make === "string" &&
        typeof v.model === "string" && Array.isArray(v.shots) && Array.isArray(v.tags);
    });
    if (!valid) return;

    window.AH_VEHICLES = data.vehicles;
    window.AH_INVENTORY_SOURCE = "managed";
    data.vehicles.forEach(indexVehicle);

    // The collection gets a compact payload. On the dossier page only the one
    // selected vehicle receives descriptions/equipment/full image metadata.
    var isVehiclePage = /(?:^|\/)vehicle\.html$/.test(location.pathname);
    var id = isVehiclePage ? new URLSearchParams(location.search).get("id") : "";
    if (!id || !/^[a-z0-9-]+$/.test(id)) return;

    var detail = await timedJson("/api/public/vehicles?id=" + encodeURIComponent(id), 4500);
    if (!detail || detail.authoritative !== true || !detail.vehicle || detail.vehicle.id !== id) return;
    var at = window.AH_VEHICLES.findIndex(function (v) { return v.id === id; });
    if (at >= 0) window.AH_VEHICLES[at] = detail.vehicle;
    else window.AH_VEHICLES.push(detail.vehicle);
    indexVehicle(detail.vehicle);
  });
})();
