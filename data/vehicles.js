/* Public inventory only. Intent-prefetched details survive page navigation;
   every cache layer shares the server's short, absolute freshness deadline. */
(function () {
  "use strict";
  window.AH_VEHICLES = window.AH_VEHICLES || [];
  window.AH_MANAGED_VEHICLES = Object.create(null);
  window.AH_IMAGE_VARIANTS = Object.create(null);
  window.AH_INVENTORY_SOURCE = "static";

  var bundledShots = Object.create(null);
  var CACHE_KEY = "autohaus-public-inventory-v1";
  var CHANGE_KEY = "autohaus-inventory-changed";
  var MAX_AGE = 30000;
  var MAX_ENTRIES = 12;
  var pending = Object.create(null);
  var sessionCache;

  function revision() {
    try { return window.localStorage.getItem(CHANGE_KEY) || ""; } catch (_) { return ""; }
  }

  function readCache() {
    if (sessionCache) return sessionCache;
    var entries;
    try { entries = JSON.parse(window.sessionStorage.getItem(CACHE_KEY) || "{}"); } catch (_) {}
    sessionCache = entries && typeof entries === "object" && !Array.isArray(entries) ? entries : {};
    return sessionCache;
  }

  function validPayload(data, id) {
    if (!data || data.authoritative !== true) return false;
    if (data.fresh_until != null && Number(data.fresh_until) <= Date.now()) return false;
    var vehicles = id && data.vehicle ? [data.vehicle] : data.vehicles;
    return Array.isArray(vehicles) && vehicles.every(function (v) {
      return v && typeof v.id === "string" && (!id || v.id === id) &&
        typeof v.make === "string" && typeof v.model === "string" &&
        Array.isArray(v.shots) && Array.isArray(v.tags);
    });
  }

  function cacheHit(key, id, currentRevision) {
    var hit = readCache()[key];
    return hit && hit.revision === currentRevision && hit.expires > Date.now() &&
      hit.expires <= Date.now() + MAX_AGE && validPayload(hit.data, id) ? hit.data : null;
  }

  function cachePut(key, data, currentRevision) {
    var now = Date.now();
    var expires = Math.min(Number(data.fresh_until) || 0, now + MAX_AGE);
    if (expires <= now || revision() !== currentRevision) return;
    var entries = readCache();
    Object.keys(entries).forEach(function (k) {
      if (!entries[k] || entries[k].expires <= now || entries[k].revision !== currentRevision) delete entries[k];
    });
    entries[key] = { data: data, expires: expires, revision: currentRevision };
    Object.keys(entries).sort(function (a, b) { return entries[b].expires - entries[a].expires; })
      .slice(MAX_ENTRIES).forEach(function (k) { delete entries[k]; });
    try { window.sessionStorage.setItem(CACHE_KEY, JSON.stringify(entries)); } catch (_) {}
  }

  function directVariants(url) {
    return { jpg400: url, jpg800: url, jpg1280: url, webp400: url, webp800: url, webp1280: url };
  }

  function indexVehicle(v) {
    if (!v || !v.id) return;
    window.AH_MANAGED_VEHICLES[v.id] = v;
    (v.local_shots || []).forEach(function (url) { if (url) bundledShots[url] = true; });
    (v.managed_images || []).forEach(function (image) {
      if (!image || !image.variants || !Object.keys(image.variants).length) return;
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

  function timedJson(url, ms, refresh) {
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
      cache: refresh ? "no-cache" : "default",
      keepalive: true,
      signal: controller ? controller.signal : undefined
    }).then(function (response) {
      return response.ok || response.status === 404 ? response.json() : null;
    }).catch(function () { return null; });
    return Promise.race([request, timeout]).then(function (data) {
      clearTimeout(timer);
      return data;
    });
  }

  function loadInventory(id, prefetch) {
    var currentRevision = revision();
    var key = id ? "vehicle:" + id : "catalog";
    var hit = cacheHit(key, id, currentRevision);
    if (hit) return Promise.resolve(hit);
    var requestKey = key + ":" + currentRevision;
    if (pending[requestKey]) return pending[requestKey];
    var refreshedAt = Number(currentRevision);
    var refresh = refreshedAt > 0 && Date.now() - refreshedAt < MAX_AGE;
    var url = "/api/public/vehicles" + (id ? "?id=" + encodeURIComponent(id) : "");
    if (refresh) url += (id ? "&" : "?") + "fresh=" + encodeURIComponent(currentRevision);
    pending[requestKey] = timedJson(url, prefetch ? 4500 : 8000, refresh).then(function (data) {
      // An edit published while this request was in flight invalidates it too.
      if (revision() !== currentRevision) return prefetch ? null : loadInventory(id, false);
      if (validPayload(data, id)) cachePut(key, data, currentRevision);
      return data;
    }).then(function (data) {
      delete pending[requestKey];
      return data;
    });
    return pending[requestKey];
  }

  window.AH_PREFETCH_VEHICLE = function (id) {
    if (typeof id !== "string" || !/^[a-z0-9-]+$/.test(id)) return Promise.resolve(null);
    // Avoid filling the connection queue while a pointer crosses many cards.
    if (Object.keys(pending).length >= 2 && !pending["vehicle:" + id + ":" + revision()]) return Promise.resolve(null);
    return loadInventory(id, true);
  };

  var path = location.pathname;
  var isVehiclePage = /(?:^|\/)vehicle\.html$/.test(path);
  var isConciergePage = /(?:^|\/)concierge\.html$/.test(path);
  var isCatalogPage = path === "/" || /(?:^|\/)index\.html$/.test(path);
  var params = new URLSearchParams(location.search);
  var requestedId = isVehiclePage ? params.get("id") : "";
  if (requestedId && !/^[a-z0-9-]+$/.test(requestedId)) requestedId = "";
  /* Homepage recovery path: the bundled snapshot is already complete enough
     to render and must never wait on an API before navigation becomes usable. */
  if (isCatalogPage) {
    window.AH_VEHICLES.forEach(indexVehicle);
    window.AH_INVENTORY_READY = Promise.resolve();
  } else {
    var request = requestedId ? loadInventory(requestedId, false)
      : isConciergePage ? loadInventory("", false) : Promise.resolve(null);

    var ready = request.then(function (data) {
      var vehicles = requestedId && data && data.vehicle ? [data.vehicle] : data && data.vehicles;
      if (!validPayload(data, requestedId)) return;

      window.AH_VEHICLES = vehicles;
      window.AH_INVENTORY_SOURCE = "managed";
      vehicles.forEach(indexVehicle);
    });
    if (typeof window.AH_INVENTORY_RESOLVE === "function") {
      ready.then(window.AH_INVENTORY_RESOLVE, window.AH_INVENTORY_RESOLVE);
    } else {
      window.AH_INVENTORY_READY = ready;
    }
  }
})();
