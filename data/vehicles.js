/* AutoHaus public inventory loader.
   A catalogue/API problem must never leave the homepage as an empty 120vh
   placeholder or keep the UI waiting forever. */
(function () {
  "use strict";
  window.AH_VEHICLES = window.AH_VEHICLES || [];
  window.AH_MANAGED_VEHICLES = Object.create(null);
  window.AH_IMAGE_VARIANTS = Object.create(null);
  window.AH_INVENTORY_SOURCE = "static";

  var bundledShots = Object.create(null);
  var CACHE_KEY = "autohaus-public-inventory-v3";
  var CHANGE_KEY = "autohaus-inventory-changed";
  var MAX_AGE = 30000;
  var STALE_AGE = 30 * 60 * 1000;
  var MAX_ENTRIES = 20;
  var pending = Object.create(null);
  var persistentCache;
  var SUPABASE_URL = "https://ajoiqomflplhadyhxvfe.supabase.co";
  var SUPABASE_KEY = "sb_publishable_gBEUBrOjT_JsBRjAnGL9PQ_ra-1hY0g";
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
    if (id && data.vehicle == null) return data.error === "Vehicle not found";
    var vehicles = id ? [data.vehicle] : data.vehicles;
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
  function cachePut(key, data, currentRevision, id) {
    if (!validPayload(data, id, false)) return;
    var now = Date.now();
    var expires = Math.min(Number(data.fresh_until) || (now + MAX_AGE), now + MAX_AGE);
    if (expires <= now || revision() !== currentRevision) return;
    var entries = readCache();
    Object.keys(entries).forEach(function (k) {
      if (!entries[k] || Number(entries[k].staleUntil || entries[k].expires) <= now || entries[k].revision !== currentRevision) delete entries[k];
    });
    entries[key] = { data: data, expires: expires, staleUntil: now + STALE_AGE, revision: currentRevision };
    Object.keys(entries).sort(function (a, b) {
      return Number(entries[b].staleUntil || 0) - Number(entries[a].staleUntil || 0);
    }).slice(MAX_ENTRIES).forEach(function (k) { delete entries[k]; });
    try { window.localStorage.setItem(CACHE_KEY, JSON.stringify(entries)); } catch (_) {}
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
    (v.shots || []).forEach(function (url) {
      if (url && !bundledShots[url] && !window.AH_IMAGE_VARIANTS[url]) window.AH_IMAGE_VARIANTS[url] = directVariants(url);
    });
  }
  function timedJson(url, ms, refresh) {
    var controller = typeof AbortController === "function" ? new AbortController() : null;
    var timer;
    var timeout = new Promise(function (resolve) {
      timer = setTimeout(function () { if (controller) controller.abort(); resolve(null); }, ms || 3500);
    });
    var request = fetch(url, {
      headers: { Accept: "application/json" }, credentials: "omit",
      cache: refresh ? "no-cache" : "default", keepalive: true,
      signal: controller ? controller.signal : undefined
    }).then(function (response) {
      return response.ok || response.status === 404 ? response.json() : null;
    }).catch(function () { return null; });
    return Promise.race([request, timeout]).then(function (data) { clearTimeout(timer); return data; });
  }
  function apiLoad(id, refresh) {
    var url = "/api/public/vehicles" + (id ? "?id=" + encodeURIComponent(id) : "");
    if (refresh) url += (id ? "&" : "?") + "fresh=" + Date.now();
    return timedJson(url, refresh ? 4500 : 2500, refresh);
  }

  function rowImageList(row) {
    if (Array.isArray(row.images)) return row.images;
    return row.cover && typeof row.cover === "object" ? [row.cover] : [];
  }
  function rowToVehicle(row, detail) {
    row = row || {};
    var images = rowImageList(row);
    var shots = images.map(function (image) {
      var variants = image && image.variants || {};
      return variants.jpg1280 || image && image.original || "";
    }).filter(Boolean);
    var vehicle = {
      id: row.slug || "",
      db_id: row.id,
      ref: row.ref || "",
      make: row.make || "",
      model: row.model || "",
      full: row.full_name || [row.make, row.model].filter(Boolean).join(" "),
      body_type: row.body_type || "",
      year: row.first_registration_year,
      month: row.first_registration_month,
      unreg: !!row.unregistered,
      km: row.mileage,
      hp: row.horsepower,
      fuel: row.fuel || "",
      gear: row.transmission || "",
      colour: row.colour || "",
      price: row.price == null ? null : Number(row.price),
      chapter: row.chapter || "saloon",
      tags: Array.isArray(row.tags) ? row.tags : [],
      notes: detail && Array.isArray(row.notes) ? row.notes : [],
      notes_en: detail && Array.isArray(row.notes_en) ? row.notes_en : [],
      shots: shots,
      managed_images: images,
      description_bg: detail ? (row.description_bg || "") : "",
      description_en: detail ? (row.description_en || "") : "",
      equipment_bg: detail && Array.isArray(row.equipment_bg) ? row.equipment_bg : [],
      equipment_en: detail && Array.isArray(row.equipment_en) ? row.equipment_en : []
    };
    return vehicle;
  }
  function supabaseJson(path, ms) {
    var controller = typeof AbortController === "function" ? new AbortController() : null;
    var timer;
    var timeout = new Promise(function (resolve) {
      timer = setTimeout(function () { if (controller) controller.abort(); resolve(null); }, ms || 3500);
    });
    var request = fetch(SUPABASE_URL + "/rest/v1/" + path, {
      method: "GET",
      headers: {
        Accept: "application/json",
        apikey: SUPABASE_KEY,
        Authorization: "Bearer " + SUPABASE_KEY
      },
      credentials: "omit",
      cache: "no-store",
      signal: controller ? controller.signal : undefined
    }).then(function (response) {
      return response.ok ? response.json() : null;
    }).catch(function () { return null; });
    return Promise.race([request, timeout]).then(function (data) { clearTimeout(timer); return data; });
  }
  function directLoad(id) {
    var common = "id,slug,ref,make,model,full_name,body_type,colour,transmission,fuel,mileage,first_registration_year,first_registration_month,unregistered,horsepower,price,chapter,tags,sort_order,updated_at";
    if (id) {
      var detailFields = common + ",notes,notes_en,description_bg,description_en,equipment_bg,equipment_en,images";
      return supabaseJson("vehicles?published=eq.true&slug=eq." + encodeURIComponent(id) + "&select=" + encodeURIComponent(detailFields) + "&limit=1", 4200)
        .then(function (rows) {
          if (!Array.isArray(rows)) return null;
          if (!rows.length) return { ok: false, authoritative: true, vehicle: null, vehicles: [], error: "Vehicle not found", fresh_until: Date.now() + 15000 };
          return { ok: true, authoritative: true, vehicle: rowToVehicle(rows[0], true), fresh_until: Date.now() + 15000 };
        });
    }
    var listFields = common + ",cover:images->0";
    return supabaseJson("vehicles?published=eq.true&select=" + encodeURIComponent(listFields) + "&order=updated_at.desc,sort_order.asc", 4200)
      .then(function (rows) {
        if (!Array.isArray(rows) || !rows.length) return null;
        return {
          ok: true,
          authoritative: true,
          count: rows.length,
          vehicles: rows.map(function (row) { return rowToVehicle(row, false); }),
          fresh_until: Date.now() + 15000
        };
      });
  }
  function networkLoad(id, currentRevision, key) {
    var requestKey = key + ":" + currentRevision;
    if (pending[requestKey]) return pending[requestKey];
    pending[requestKey] = apiLoad(id, false).then(function (data) {
      return validPayload(data, id, false) ? data : apiLoad(id, true);
    }).then(function (data) {
      return validPayload(data, id, false) ? data : directLoad(id);
    }).then(function (data) {
      if (revision() !== currentRevision) return loadInventory(id, true);
      if (validPayload(data, id, false)) cachePut(key, data, currentRevision, id);
      return data;
    });
    pending[requestKey].then(function () { delete pending[requestKey]; }, function () { delete pending[requestKey]; });
    return pending[requestKey];
  }
  function loadInventory(id, force) {
    var currentRevision = revision();
    var key = id ? "vehicle:" + id : "catalog";
    if (!force) {
      var fresh = cacheHit(key, id, currentRevision, false);
      if (fresh) return Promise.resolve(fresh);
      var stale = cacheHit(key, id, currentRevision, true);
      if (stale) { networkLoad(id, currentRevision, key); return Promise.resolve(stale); }
    }
    return networkLoad(id, currentRevision, key);
  }
  function applyPayload(data, id) {
    if (!validPayload(data, id, true)) return false;
    if (id && !data.vehicle) return true;
    var vehicles = id ? [data.vehicle] : data.vehicles;
    window.AH_VEHICLES = vehicles;
    window.AH_INVENTORY_SOURCE = "managed";
    vehicles.forEach(indexVehicle);
    if (window.AH) window.AH.all = vehicles;
    return true;
  }

  window.AH_PREFETCH_VEHICLE = function (id) {
    if (typeof id !== "string" || !/^[a-z0-9-]+$/.test(id)) return Promise.resolve(null);
    return loadInventory(id, false);
  };
  window.AH_RELOAD_INVENTORY = function () {
    return loadInventory("", true).then(function (data) { return applyPayload(data, "") ? data : null; });
  };

  function esc(value) {
    return String(value == null ? "" : value).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function fallbackCard(v) {
    var shot = v && v.shots && v.shots[0] || "";
    var price = v && v.price != null ? Math.round(v.price).toLocaleString("bg-BG") + " €" : "Цена при запитване";
    var name = v && (v.full || [v.make, v.model].filter(Boolean).join(" ")) || "";
    return '<article class="lc"><a class="lc__link" href="vehicle.html?id=' + encodeURIComponent(v.id) + '">' +
      '<span class="lc__pic">' + (shot ? '<img loading="lazy" decoding="async" src="' + esc(shot) + '" alt="' + esc(name) + '">' : "") + '</span>' +
      '<span class="lc__body"><span class="lc__price">' + esc(price) + '</span><span class="lc__name">' + esc(name) + '</span></span></a></article>';
  }
  function revealCriticalUI() {
    if (!document.querySelectorAll) return;
    Array.prototype.forEach.call(document.querySelectorAll("[data-reveal], .wcard-item"), function (el) { el.classList.add("is-in"); });
  }
  function loadingState() {
    var grid = document.getElementById("pv-grid");
    if (!grid || grid.children.length) return;
    var head = document.querySelector("#avtomobili .csec__head");
    if (head) head.classList.add("is-in");
    grid.style.minHeight = "180px";
    grid.innerHTML = '<div data-ah-catalog-loading style="grid-column:1/-1;display:flex;align-items:center;justify-content:center;min-height:180px;font-size:13px;letter-spacing:.06em;text-transform:uppercase">Зареждане на автомобили…</div>';
  }
  function recoverPreview() {
    revealCriticalUI();
    var grid = document.getElementById("pv-grid");
    if (!grid) return;
    var loading = grid.querySelector("[data-ah-catalog-loading]");
    if (loading) loading.remove();
    if (grid.querySelector(".lc")) { grid.style.minHeight = ""; return; }
    grid.innerHTML = "";
    grid.style.minHeight = "0";
    var list = Array.isArray(window.AH_VEHICLES) ? window.AH_VEHICLES : [];
    if (list.length) {
      if (window.AH) window.AH.all = list;
      grid.innerHTML = list.slice(0, 6).map(function (v) {
        return window.AH && typeof window.AH.card === "function" ? window.AH.card(v, {}) : fallbackCard(v);
      }).join("");
      return;
    }
    grid.innerHTML = '<div style="grid-column:1/-1;padding:56px 0;text-align:center"><p style="margin:0 0 18px">Каталогът временно не можа да се зареди.</p><button type="button" class="btn btn--s btn--primary" data-ah-retry-catalog>Опитай отново</button></div>';
    var retry = grid.querySelector("[data-ah-retry-catalog]");
    if (retry) retry.addEventListener("click", function () {
      retry.disabled = true; retry.textContent = "Зареждане…";
      window.AH_RELOAD_INVENTORY().then(function (data) {
        if (data && data.vehicles && data.vehicles.length) { grid.innerHTML = ""; recoverPreview(); }
        else { retry.disabled = false; retry.textContent = "Опитай отново"; }
      }).catch(function () { retry.disabled = false; retry.textContent = "Опитай отново"; });
    });
  }
  function afterDom(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn, { once: true });
    else fn();
  }

  afterDom(function () { loadingState(); setTimeout(revealCriticalUI, 2200); });

  var path = location.pathname;
  var isVehiclePage = /(?:^|\/)vehicle\.html$/.test(path);
  var isConciergePage = /(?:^|\/)concierge\.html$/.test(path);
  var isCatalogPage = path === "/" || /(?:^|\/)index\.html$/.test(path);
  var params = new URLSearchParams(location.search);
  var requestedId = isVehiclePage ? params.get("id") : "";
  if (requestedId && !/^[a-z0-9-]+$/.test(requestedId)) requestedId = "";
  var request = requestedId ? loadInventory(requestedId, false) :
    (isCatalogPage || isConciergePage) ? loadInventory("", false) : Promise.resolve(null);

  var ready = request.then(function (data) {
    applyPayload(data, requestedId);
    return data;
  }).catch(function () { return null; });

  // UI modules subscribe to one deterministic promise. A data outage may
  // produce an empty catalogue message, but it must never freeze navigation,
  // scrolling, menus or the rest of the landing page.
  window.AH_INVENTORY_READY = ready;

  var watchdog = setTimeout(function () {
    revealCriticalUI();
    if (isCatalogPage) afterDom(recoverPreview);
  }, 5500);

  ready.then(function () {
    clearTimeout(watchdog);
    revealCriticalUI();
    if (isCatalogPage) afterDom(function () { setTimeout(recoverPreview, 80); });
  }, function () {
    clearTimeout(watchdog);
    revealCriticalUI();
    if (isCatalogPage) afterDom(recoverPreview);
  });
})();
