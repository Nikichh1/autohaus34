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
      if (!image || !image.variants) return;
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

  window.AH_INVENTORY_READY = timedJson("/api/public/vehicles", 4500).then(async function (data) {
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

/* Production polish shared by the landing page and vehicle dossier.
   Kept here so navigation/card/detail fixes arrive before the render modules. */
(function () {
  "use strict";

  var style = document.createElement("style");
  style.id = "ah-production-polish";
  style.textContent = [
    "/* Desktop header: one clear menu trigger instead of duplicated section links. */",
    "@media(min-width:768px){.hd-zone--start>.lnk,.hd-links{display:none!important}.hd-zone--start{gap:0!important}body:not(.ah) .links>a{display:none!important}}",

    "/* Menu: calmer type scale, tighter rhythm and a narrower readable panel. */",
    ".mob__reveal{width:min(90vw,420px)!important}",
    ".mob__sheet{justify-content:flex-start!important;padding-top:calc(var(--plate-h) + 68px)!important}",
    ".mob nav a{font-size:clamp(18px,1.65vw,23px)!important;line-height:1.22!important;padding:10px 0!important;min-height:42px!important}",
    ".mob-foot{margin-top:18px!important}",
    "@media(max-width:767px){.mob__reveal{width:min(92vw,360px)!important;clip-path:none!important;transform:translate3d(-102%,0,0);transition:transform .30s cubic-bezier(.22,.61,.36,1)!important;will-change:transform}.mob.is-open .mob__reveal{clip-path:none!important;transform:translate3d(0,0,0)}.mob__sheet{padding:calc(var(--plate-h) + 58px) 24px max(24px,env(safe-area-inset-bottom))!important}.mob nav a{font-size:19px!important;line-height:25px!important;padding:7px 0!important;min-height:39px!important}.mob__scrim{-webkit-backdrop-filter:none!important;backdrop-filter:none!important;transition-duration:.24s!important}}",

    "/* Vehicle-card metadata: four quiet, purpose-drawn icons instead of generic separators. */",
    ".lc__meta{gap:6px 14px!important;margin-top:7px!important}",
    ".lc__meta-item{display:inline-flex!important;align-items:center;gap:6px;min-width:0;overflow-wrap:anywhere}",
    ".lc__meta-item:not(:last-child)::after{display:none!important}",
    ".lc__meta-item::before{content:\"\";width:13px;height:13px;flex:0 0 13px;background:currentColor;opacity:.84;-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-position:center;mask-position:center;-webkit-mask-size:contain;mask-size:contain}",
    ".lc__meta-item:nth-child(1)::before{-webkit-mask-image:url(\"data:image/svg+xml,%3Csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20viewBox=%270%200%2024%2024%27%3E%3Cg%20fill=%27none%27%20stroke=%27%23000%27%20stroke-width=%271.8%27%20stroke-linecap=%27round%27%3E%3Cpath%20d=%27M6%204v16M18%204v16M6%208h12M12%204v16%27/%3E%3C/g%3E%3C/svg%3E\");mask-image:url(\"data:image/svg+xml,%3Csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20viewBox=%270%200%2024%2024%27%3E%3Cg%20fill=%27none%27%20stroke=%27%23000%27%20stroke-width=%271.8%27%20stroke-linecap=%27round%27%3E%3Cpath%20d=%27M6%204v16M18%204v16M6%208h12M12%204v16%27/%3E%3C/g%3E%3C/svg%3E\")}",
    ".lc__meta-item:nth-child(2)::before{-webkit-mask-image:url(\"data:image/svg+xml,%3Csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20viewBox=%270%200%2024%2024%27%3E%3Cg%20fill=%27none%27%20stroke=%27%23000%27%20stroke-width=%271.8%27%20stroke-linecap=%27round%27%20stroke-linejoin=%27round%27%3E%3Cpath%20d=%27M5%2021V4a1%201%200%200%201%201-1h8a1%201%200%200%201%201%201v17M4%2021h12M7%206h6v5H7zM15%207h2l2%202v7a2%202%200%200%200%202%202V9l-2-2%27/%3E%3C/g%3E%3C/svg%3E\");mask-image:url(\"data:image/svg+xml,%3Csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20viewBox=%270%200%2024%2024%27%3E%3Cg%20fill=%27none%27%20stroke=%27%23000%27%20stroke-width=%271.8%27%20stroke-linecap=%27round%27%20stroke-linejoin=%27round%27%3E%3Cpath%20d=%27M5%2021V4a1%201%200%200%201%201-1h8a1%201%200%200%201%201%201v17M4%2021h12M7%206h6v5H7zM15%207h2l2%202v7a2%202%200%200%200%202%202V9l-2-2%27/%3E%3C/g%3E%3C/svg%3E\")}",
    ".lc__meta-item:nth-child(3)::before{-webkit-mask-image:url(\"data:image/svg+xml,%3Csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20viewBox=%270%200%2024%2024%27%3E%3Cg%20fill=%27none%27%20stroke=%27%23000%27%20stroke-width=%271.8%27%20stroke-linecap=%27round%27%20stroke-linejoin=%27round%27%3E%3Cpath%20d=%27M4%2018a8%208%200%201%201%2016%200M12%2018l4-5%27/%3E%3Ccircle%20cx=%2712%27%20cy=%2718%27%20r=%271%27%20fill=%27%23000%27/%3E%3C/g%3E%3C/svg%3E\");mask-image:url(\"data:image/svg+xml,%3Csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20viewBox=%270%200%2024%2024%27%3E%3Cg%20fill=%27none%27%20stroke=%27%23000%27%20stroke-width=%271.8%27%20stroke-linecap=%27round%27%20stroke-linejoin=%27round%27%3E%3Cpath%20d=%27M4%2018a8%208%200%201%201%2016%200M12%2018l4-5%27/%3E%3Ccircle%20cx=%2712%27%20cy=%2718%27%20r=%271%27%20fill=%27%23000%27/%3E%3C/g%3E%3C/svg%3E\")}",
    ".lc__meta-item:nth-child(4)::before{-webkit-mask-image:url(\"data:image/svg+xml,%3Csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20viewBox=%270%200%2024%2024%27%3E%3Cg%20fill=%27none%27%20stroke=%27%23000%27%20stroke-width=%271.8%27%20stroke-linecap=%27round%27%20stroke-linejoin=%27round%27%3E%3Crect%20x=%274%27%20y=%276%27%20width=%2716%27%20height=%2714%27%20rx=%271%27/%3E%3Cpath%20d=%27M8%203v6M16%203v6M4%2010h16%27/%3E%3C/g%3E%3C/svg%3E\");mask-image:url(\"data:image/svg+xml,%3Csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20viewBox=%270%200%2024%2024%27%3E%3Cg%20fill=%27none%27%20stroke=%27%23000%27%20stroke-width=%271.8%27%20stroke-linecap=%27round%27%20stroke-linejoin=%27round%27%3E%3Crect%20x=%274%27%20y=%276%27%20width=%2716%27%20height=%2714%27%20rx=%271%27/%3E%3Cpath%20d=%27M8%203v6M16%203v6M4%2010h16%27/%3E%3C/g%3E%3C/svg%3E\")}",
    "@media(max-width:599px){.lc__meta{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:5px 8px!important;font-size:10.5px!important;line-height:15px!important}.lc__meta-item{gap:5px}.lc__meta-item::before{width:12px;height:12px;flex-basis:12px}}",

    "/* Vehicle dossier: denser specification and equipment hierarchy without crushing readability. */",
    "body:not(.ah) .dsec{padding-top:20px}",
    "body:not(.ah) .dsec__h{margin-bottom:12px}",
    "body:not(.ah) .dspec>div{padding:8px 0;gap:12px}",
    "body:not(.ah) .dspec dt{font-size:10px;line-height:18px;letter-spacing:.8px}",
    "body:not(.ah) .dspec dd{font-size:13px;line-height:19px;max-width:62%;overflow-wrap:anywhere}",
    "body:not(.ah) .deq-i{grid-template-columns:46px minmax(0,1fr);gap:12px;padding:7px 0;line-height:1.45}",
    "body:not(.ah) .deq-c{font-size:11px;letter-spacing:.04em}",
    "body:not(.ah) .dclamp{max-height:220px}",
    "@media(min-width:760px){body:not(.ah) .dspec{grid-template-columns:repeat(2,minmax(0,1fr));column-gap:32px}body:not(.ah) .dspec>div:nth-child(2){border-top:0;padding-top:0}}",
    "@media(max-width:599px){body:not(.ah) .dspec>div{align-items:flex-start}body:not(.ah) .dspec dd{max-width:58%}body:not(.ah) .deq{font-size:13px}}",

    "/* Contact map and touch performance. */",
    ".ctc__mapbox{border-color:rgba(255,255,255,.2)!important;box-shadow:0 18px 38px rgba(0,0,0,.18)}",
    ".ctc__mapframe{height:clamp(230px,32vh,310px)!important;filter:saturate(.84) contrast(1.03)}",
    "@media(max-width:767px),(hover:none){.lc__pic img{transition:none!important}.lc:hover .lc__pic img,.lc:focus-within .lc__pic img{transform:none!important}.wipe__panel{-webkit-backdrop-filter:none!important;backdrop-filter:none!important}.ctc__mapframe{filter:saturate(.78) contrast(1.02)}html.ah-touch .rv{transition-duration:.32s!important}}"
  ].join("\n");
  document.head.appendChild(style);

  try {
    if (matchMedia("(max-width: 767px), (hover: none)").matches) document.documentElement.classList.add("ah-touch");
  } catch (_) {}

  function polishDom() {
    // Replace the OpenStreetMap embed with a cleaner Google Maps experience.
    var googleMap = "https://www.google.com/maps?q=42.1207165,24.7737244&z=16&output=embed";
    document.querySelectorAll(".ctc__mapframe").forEach(function (frame) {
      frame.setAttribute("data-map-src", googleMap);
      frame.setAttribute("loading", "lazy");
      frame.setAttribute("referrerpolicy", "no-referrer-when-downgrade");
      frame.setAttribute("allowfullscreen", "");
      if (frame.getAttribute("src")) frame.setAttribute("src", googleMap);
    });

    // Keep menu destinations, but prevent the page header behind the open panel
    // from looking like a second navigation column.
    var menu = document.getElementById("mob");
    if (menu && typeof MutationObserver === "function") {
      var sync = function () { document.documentElement.classList.toggle("ah-menu-open", menu.classList.contains("is-open")); };
      new MutationObserver(sync).observe(menu, { attributes: true, attributeFilter: ["class"] });
      sync();
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", polishDom, { once: true });
  else polishDom();
})();
