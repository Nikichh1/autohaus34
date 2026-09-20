/* Public inventory only. Intent-prefetched details survive page navigation;
   fresh data is used normally, with a very short stale-while-revalidate window
   so repeat page visits can paint immediately instead of waiting on a network. */
(function () {
  "use strict";
  window.AH_VEHICLES = window.AH_VEHICLES || [];
  window.AH_MANAGED_VEHICLES = Object.create(null);
  window.AH_IMAGE_VARIANTS = Object.create(null);
  window.AH_INVENTORY_SOURCE = "static";

  var bundledShots = Object.create(null);
  var CACHE_KEY = "autohaus-public-inventory-v2";
  var CHANGE_KEY = "autohaus-inventory-changed";
  var MAX_AGE = 30000;
  var STALE_AGE = 90000;
  var MAX_ENTRIES = 12;
  var pending = Object.create(null);
  var persistentCache;

  function revision() {
    try { return window.localStorage.getItem(CHANGE_KEY) || ""; } catch (_) { return ""; }
  }

  function readCache() {
    if (persistentCache) return persistentCache;
    var entries;
    try { entries = JSON.parse(window.localStorage.getItem(CACHE_KEY) || "{}"); } catch (_) {}
    persistentCache = entries && typeof entries === "object" && !Array.isArray(entries) ? entries : {};
    return persistentCache;
  }

  function validPayload(data, id, allowStale) {
    if (!data || data.authoritative !== true) return false;
    if (!allowStale && data.fresh_until != null && Number(data.fresh_until) <= Date.now()) return false;
    var vehicles = id && data.vehicle ? [data.vehicle] : data.vehicles;
    return Array.isArray(vehicles) && vehicles.every(function (v) {
      return v && typeof v.id === "string" && (!id || v.id === id) &&
        typeof v.make === "string" && typeof v.model === "string" &&
        Array.isArray(v.shots) && Array.isArray(v.tags);
    });
  }

  function cacheHit(key, id, currentRevision, allowStale) {
    var hit = readCache()[key];
    if (!hit || hit.revision !== currentRevision) return null;
    var limit = allowStale ? Number(hit.staleUntil || hit.expires) : Number(hit.expires);
    if (limit <= Date.now() || !validPayload(hit.data, id, allowStale)) return null;
    return hit.data;
  }

  function cachePut(key, data, currentRevision) {
    var now = Date.now();
    var expires = Math.min(Number(data.fresh_until) || 0, now + MAX_AGE);
    if (expires <= now || revision() !== currentRevision) return;
    var entries = readCache();
    Object.keys(entries).forEach(function (k) {
      if (!entries[k] || Number(entries[k].staleUntil || entries[k].expires) <= now || entries[k].revision !== currentRevision) delete entries[k];
    });
    entries[key] = { data: data, expires: expires, staleUntil: now + STALE_AGE, revision: currentRevision };
    Object.keys(entries).sort(function (a, b) { return Number(entries[b].staleUntil || 0) - Number(entries[a].staleUntil || 0); })
      .slice(MAX_ENTRIES).forEach(function (k) { delete entries[k]; });
    try { window.localStorage.setItem(CACHE_KEY, JSON.stringify(entries)); } catch (_) {}
  }

  function directVariants(url) {
    return { jpg400: url, jpg800: url, jpg1280: url, webp400: url, webp800: url, webp1280: url };
  }

  function primeVehicleCover(v) {
    if (!v || !Array.isArray(v.managed_images) || !v.managed_images[0]) return;
    var variants = v.managed_images[0].variants || {};
    var useWebp = /\.webp(?:$|\?)/i.test(variants.webp1280 || "") &&
      /\.webp(?:$|\?)/i.test(variants.webp800 || "");
    var hi = useWebp ? variants.webp1280 : variants.jpg1280;
    var mid = useWebp ? variants.webp800 : variants.jpg800;
    if (!hi || !mid || document.querySelector('link[data-ah-vehicle-cover="' + v.id + '"]')) return;
    var link = document.createElement("link");
    link.rel = "preload";
    link.as = "image";
    link.href = hi;
    link.fetchPriority = "high";
    link.type = useWebp ? "image/webp" : "image/jpeg";
    link.setAttribute("imagesrcset", mid + " 800w, " + hi + " 1280w");
    link.setAttribute("imagesizes", "(min-width:1024px) 66vw, 100vw");
    link.setAttribute("data-ah-vehicle-cover", v.id);
    document.head.appendChild(link);
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
    (v.shots || []).forEach(function (url) {
      if (url && !bundledShots[url] && !window.AH_IMAGE_VARIANTS[url]) window.AH_IMAGE_VARIANTS[url] = directVariants(url);
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

  function networkLoad(id, prefetch, currentRevision, key) {
    var requestKey = key + ":" + currentRevision;
    if (pending[requestKey]) return pending[requestKey];
    var refreshedAt = Number(currentRevision);
    var refresh = refreshedAt > 0 && Date.now() - refreshedAt < MAX_AGE;
    var url = "/api/public/vehicles" + (id ? "?id=" + encodeURIComponent(id) : "");
    if (refresh) url += (id ? "&" : "?") + "fresh=" + encodeURIComponent(currentRevision);
    pending[requestKey] = timedJson(url, prefetch ? 4500 : 8000, refresh).then(function (data) {
      if (revision() !== currentRevision) return prefetch ? null : loadInventory(id, false);
      if (validPayload(data, id, false)) cachePut(key, data, currentRevision);
      return data;
    }).finally(function () { delete pending[requestKey]; });
    return pending[requestKey];
  }

  function loadInventory(id, prefetch) {
    var currentRevision = revision();
    var key = id ? "vehicle:" + id : "catalog";
    var fresh = cacheHit(key, id, currentRevision, false);
    if (fresh) return Promise.resolve(fresh);

    var stale = cacheHit(key, id, currentRevision, true);
    if (stale) {
      // Paint from the last known-good payload now and refresh it in parallel.
      networkLoad(id, true, currentRevision, key);
      return Promise.resolve(stale);
    }
    return networkLoad(id, prefetch, currentRevision, key);
  }

  window.AH_PREFETCH_VEHICLE = function (id) {
    if (typeof id !== "string" || !/^[a-z0-9-]+$/.test(id)) return Promise.resolve(null);
    if (Object.keys(pending).length >= 3 && !pending["vehicle:" + id + ":" + revision()]) return Promise.resolve(null);
    return loadInventory(id, true);
  };

  var path = location.pathname;
  var isVehiclePage = /(?:^|\/)vehicle\.html$/.test(path);
  var isConciergePage = /(?:^|\/)concierge\.html$/.test(path);
  var isCatalogPage = path === "/" || /(?:^|\/)index\.html$/.test(path);
  var params = new URLSearchParams(location.search);
  var requestedId = isVehiclePage ? params.get("id") : "";
  if (requestedId && !/^[a-z0-9-]+$/.test(requestedId)) requestedId = "";
  var request = requestedId ? loadInventory(requestedId, false)
    : (isCatalogPage || isConciergePage) ? loadInventory("", false) : Promise.resolve(null);

  var ready = request.then(function (data) {
    var vehicles = requestedId && data && data.vehicle ? [data.vehicle] : data && data.vehicles;
    if (!validPayload(data, requestedId, true)) return;

    window.AH_VEHICLES = vehicles;
    window.AH_INVENTORY_SOURCE = "managed";
    if (requestedId && vehicles[0]) primeVehicleCover(vehicles[0]);
    vehicles.forEach(indexVehicle);
  });
  if (typeof window.AH_INVENTORY_RESOLVE === "function") {
    ready.then(window.AH_INVENTORY_RESOLVE, window.AH_INVENTORY_RESOLVE);
  } else {
    window.AH_INVENTORY_READY = ready;
  }
})();
