/* AutoHaus admin request accelerator.
   It keeps only short-lived, same-session GET responses and invalidates them
   after every vehicle write. Nothing is acknowledged before the server saves. */
(function () {
  "use strict";

  var nativeFetch = window.fetch.bind(window);
  var CACHE_KEY = "autohaus-admin-fast-cache-v1";
  var TTL = 20000;
  var memory = Object.create(null);
  var pending = Object.create(null);

  function urlOf(input) {
    try { return new URL(typeof input === "string" ? input : input && input.url, location.href); }
    catch (_) { return null; }
  }

  function cacheKey(url) {
    if (!url || url.origin !== location.origin || url.pathname !== "/api/admin/vehicles") return "";
    if (url.searchParams.get("action")) return "";
    var id = url.searchParams.get("id") || "";
    return id ? "vehicle:" + id : "vehicles";
  }

  function loadStored() {
    try {
      var parsed = JSON.parse(sessionStorage.getItem(CACHE_KEY) || "{}");
      if (parsed && typeof parsed === "object") memory = parsed;
    } catch (_) {}
  }

  function persist() {
    try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(memory)); } catch (_) {}
  }

  function put(key, status, headers, text) {
    if (!key || status < 200 || status >= 300 || !text) return;
    memory[key] = {
      expires: Date.now() + TTL,
      status: status,
      type: headers.get("Content-Type") || "application/json; charset=utf-8",
      text: text
    };
    persist();
  }

  function hit(key) {
    var item = key && memory[key];
    if (!item) return null;
    if (Number(item.expires) <= Date.now()) {
      delete memory[key];
      persist();
      return null;
    }
    return new Response(item.text, {
      status: item.status || 200,
      headers: { "Content-Type": item.type || "application/json; charset=utf-8", "X-AutoHaus-Cache": "HIT" }
    });
  }

  function invalidate() {
    memory = Object.create(null);
    try { sessionStorage.removeItem(CACHE_KEY); } catch (_) {}
  }

  function network(input, init, key) {
    if (key && pending[key]) return pending[key].then(function (payload) {
      return new Response(payload.text, { status: payload.status, headers: { "Content-Type": payload.type } });
    });
    var request = nativeFetch(input, init).then(async function (response) {
      if (!key) return response;
      var text = await response.clone().text();
      put(key, response.status, response.headers, text);
      return response;
    });
    if (key) {
      pending[key] = request.then(async function (response) {
        var text = await response.clone().text();
        return { status: response.status, type: response.headers.get("Content-Type") || "application/json; charset=utf-8", text: text };
      }).finally(function () { delete pending[key]; });
    }
    return request;
  }

  loadStored();

  window.fetch = function (input, init) {
    init = init || {};
    var url = urlOf(input);
    var method = String(init.method || (input && input.method) || "GET").toUpperCase();
    var key = cacheKey(url);

    if (key && method === "GET") {
      var cached = hit(key);
      if (cached) return Promise.resolve(cached);
      return network(input, init, key);
    }

    var isVehicleWrite = url && url.origin === location.origin && url.pathname === "/api/admin/vehicles" && method !== "GET" && method !== "HEAD";
    if (!isVehicleWrite) return nativeFetch(input, init);
    return nativeFetch(input, init).then(function (response) {
      if (response.ok) invalidate();
      return response;
    });
  };

  /* Start the request before the larger editor bundle runs. On a direct edit
     URL, warm both the compact inventory and that one vehicle in parallel. */
  function warm(url) {
    try { window.fetch(url, { credentials: "same-origin", headers: { Accept: "application/json" } }); } catch (_) {}
  }
  warm("/api/admin/vehicles");
  var match = location.hash.match(/^#edit=([0-9a-f-]{36})$/i);
  if (match) warm("/api/admin/vehicles?id=" + encodeURIComponent(match[1]));
})();
