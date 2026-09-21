/* AutoHaus inventory: one controller for navigation, editing, photos and Gemini review. */
(function () {
  "use strict";
  var D = document, view = D.getElementById("admin-view"), toastEl = D.getElementById("toast");
  var lang = "bg";
  try { localStorage.removeItem("ah-admin-language"); } catch (_) {}
  try { sessionStorage.removeItem("autohaus-admin-fast-cache-v1"); } catch (_) {}
  var adminUserKey = D.body.dataset.adminUser || "admin";
  var legacyDraftKey = "autohaus-admin-draft:" + adminUserKey;
  var draftKey = "autohaus-admin-draft-v2:" + adminUserKey;
  try { sessionStorage.removeItem(legacyDraftKey); } catch (_) {}
  var state = { vehicles: [], current: null, route: "", dirty: false, saved: false,
    saveBusy: false, uploadBusy: false, aiBusy: false, search: "", filter: "all", removed: [], failedFiles: [], canImport: false, aiNeedsReview: false, reviewNotes: [] };
  var imageSorter = null, draftTimer, searchFrame;
  var detailCache = new Map(), detailRequests = new Map(), detailVersions = new Map();
  var role = D.body.dataset.adminRole || "viewer";
  window.AH_ADMIN = { go: go, t: t, canLeave: canLeave, canWrite: role !== "viewer", canManage: ["owner", "admin"].includes(role) };
  function inventoryChanged() { writeStorage("localStorage", "autohaus-inventory-changed", String(Date.now())); }
  function invalidateDetail(id) {
    detailCache.delete(id); detailRequests.delete(id);
    detailVersions.set(id, (detailVersions.get(id) || 0) + 1);
  }
  function rememberDetail(vehicle) {
    invalidateDetail(vehicle.id);
    detailCache.set(vehicle.id, { vehicle: vehicle, at: Date.now() });
    if (detailCache.size > 20) detailCache.delete(detailCache.keys().next().value);
    state.vehicles = state.vehicles.map(function (item) { return item.id === vehicle.id ? vehicle : item; });
  }
  function loadDetail(id) {
    var cached = detailCache.get(id);
    if (cached && Date.now() - cached.at < 30000) return Promise.resolve(cached.vehicle);
    if (detailRequests.has(id)) return detailRequests.get(id);
    var version = detailVersions.get(id) || 0;
    var request = api("/api/admin/vehicles?id=" + encodeURIComponent(id)).then(function (data) {
      if ((detailVersions.get(id) || 0) !== version) return loadDetail(id);
      if (!data.vehicle || !data.vehicle.id) throw new Error(t("Автомобилът не е намерен", "Car not found"));
      rememberDetail(data.vehicle); return data.vehicle;
    }).finally(function () { if (detailRequests.get(id) === request) detailRequests.delete(id); });
    detailRequests.set(id, request); return request;
  }
  function t(bg, en) { return bg; }
  function esc(v) { return String(v == null ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;"); }
  function clone(v) { return JSON.parse(JSON.stringify(v)); }
  function lines(v) { return (Array.isArray(v) ? v : []).join("\n"); }
  function splitLines(v) { return String(v || "").split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean); }
  function slugify(v) { return String(v || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 180); }
  function readStorage(storage, key) { try { return window[storage].getItem(key); } catch (_) { return null; } }
  function writeStorage(storage, key, v) { try { if (v == null) window[storage].removeItem(key); else window[storage].setItem(key, v); } catch (_) {} }
  function money(v) { return v == null || v === "" ? "—" : new Intl.NumberFormat(lang === "bg" ? "bg-BG" : "en-GB", { maximumFractionDigits: 0 }).format(Number(v)) + " €"; }
  function mileage(v) { return v == null || v === "" ? "—" : new Intl.NumberFormat(lang === "bg" ? "bg-BG" : "en-GB").format(Number(v)) + t(" км", " km"); }
  function imageUrl(img, size) {
    var v = (img || {}).variants || {};
    if (size >= 800) return v.webp800 || v.jpg800 || v.webp1280 || v.jpg1280 || v.webp400 || v.jpg400 || (img || {}).original || "";
    return v.webp400 || v.jpg400 || v.webp800 || v.jpg800 || (img || {}).original || "";
  }
  function isResponsiveImage(img) {
    var variants = img && img.variants || {}, keys = ["jpg400", "jpg800", "jpg1280", "webp400", "webp800", "webp1280"];
    var urls = keys.map(function (key) { return variants[key]; });
    return /^vehicles\/[0-9a-f-]{36}$/i.test(String(img && img.public_id || "")) &&
      urls.every(Boolean) && new Set(urls).size === keys.length;
  }
  function carName(v) { return v.full_name || [v.make, v.model].filter(Boolean).join(" "); }
  function isBusy() { return state.saveBusy || state.uploadBusy || state.aiBusy; }
  function toast(message, error) {
    toastEl.textContent = message; toastEl.className = "toast is-on" + (error ? " is-error" : "");
    clearTimeout(toastEl.__timer); toastEl.__timer = setTimeout(function () { toastEl.classList.remove("is-on"); }, 4500);
  }
  async function api(url, options) {
    options = options || {};
    options.credentials = "same-origin";
    options.headers = Object.assign({ Accept: "application/json" }, options.headers || {});
    if (options.body && typeof options.body !== "string") {
      options.headers["Content-Type"] = "application/json"; options.body = JSON.stringify(options.body);
    }
    var response;
    try { response = await fetch(url, options); }
    catch (error) {
      if (error && error.code === "TRANSLATION_UNAVAILABLE") throw error;
      throw new Error(t("Няма връзка. Промените са запазени на този екран. Опитайте отново.", "Connection unavailable. Your changes remain on this screen. Try again."));
    }
    var data = await response.json().catch(function () { return {}; });
    if (!response.ok) {
      var error = new Error(data.error || t("Заявката не успя. Опитайте отново.", "The request failed. Try again."));
      error.status = response.status; error.code = data.code || "";
      if (response.status === 401) { persistDraft(); showAuthExpired(); error.message = t("Сесията изтече. Влезте отново, за да запишете.", "Your session expired. Sign in again to save."); }
      throw error;
    }
    return data;
  }
  function showAuthExpired() {
    var banner = D.getElementById("auth-notice");
    if (!banner) return;
    banner.hidden = false;
    banner.innerHTML = '<span>' + t("Сесията изтече. Промените са запазени в този раздел.", "Session expired. Your changes are kept in this tab.") +
      '</span><a class="secondary" href="/admin/login.html">' + t("Влезте отново", "Sign in again") + '</a>';
  }
  function persistDraft() {
    clearTimeout(draftTimer);
    if (!state.current || !state.dirty || !D.getElementById("car-form")) return;
    var form = collectForm();
    if (!form) return;
    writeStorage("sessionStorage", draftKey, JSON.stringify({ vehicle: Object.assign({}, state.current, form), route: state.route,
      source: "", needsReview: false, removed: state.removed, at: Date.now() }));
  }
  function clearDraft() { clearTimeout(draftTimer); writeStorage("sessionStorage", draftKey, null); }
  function draft() {
    try {
      var value = JSON.parse(readStorage("sessionStorage", draftKey) || "null");
      return value && value.vehicle && Date.now() - value.at < 86400000 ? value : null;
    } catch (_) { return null; }
  }
  function setDirty() {
    state.dirty = true; state.saved = false; updateSaveState();
    clearTimeout(draftTimer); draftTimer = setTimeout(persistDraft, 250);
  }
  function updateSaveState() {
    var busy = isBusy(), save = D.getElementById("save-car"), publish = D.getElementById("publish-car");
    if (busy && imageSorter) imageSorter.cancel();
    var text = state.saveBusy ? t("Записване…", "Saving…") : state.uploadBusy ? t("Качване на снимки…", "Uploading photos…") :
      state.aiBusy ? t("Обработване…", "Processing…") : state.dirty ? t("Незаписани промени", "Unsaved changes") :
      state.saved ? t("Записано", "Saved") : state.current && !state.current.id ? t("Нова чернова", "New draft") : t("Всички промени са записани", "All changes saved");
    var el = D.getElementById("save-state");
    if (el) { el.textContent = text; el.className = "save-state" + (state.dirty ? " is-dirty" : " is-saved"); }
    if (save) { save.disabled = busy; save.textContent = state.saveBusy ? t("Записване…", "Saving…") : state.current.published ? t("Запиши промените", "Save changes") : t("Запиши чернова", "Save draft"); }
    if (publish) { publish.disabled = busy; publish.textContent = t("Публикувай", "Publish"); }
    ["delete-car", "unpublish-car", "choose-images", "take-photo", "retry-images"].forEach(function (id) {
      var button = D.getElementById(id); if (button) button.disabled = busy;
    });
    var fields = D.getElementById("editor-fields");
    if (fields) fields.disabled = !!state.saveBusy || role === "viewer";
    view.querySelectorAll(".image-actions button,.cover-button").forEach(function (button) {
      button.disabled = busy || role === "viewer" || (button.classList.contains("image-drag-handle") && (state.current.images || []).length < 2);
    });
    var form = D.getElementById("car-form");
    if (form) form.setAttribute("aria-busy", busy ? "true" : "false");
  }
  function markNav(route) {
    D.querySelectorAll("[data-route]").forEach(function (button) {
      var active = button.dataset.route === route || (route.indexOf("edit=") === 0 && button.dataset.route === "cars");
      button.classList.toggle("is-on", active);
      if (active) button.setAttribute("aria-current", "page"); else button.removeAttribute("aria-current");
    });
  }
  function requestedRoute() { var h = location.hash.slice(1); return h || "dashboard"; }
  function canLeave() {
    if (isBusy()) { toast(t("Изчакайте текущата операция да завърши.", "Wait for the current operation to finish.")); return false; }
    return !state.dirty || confirm(t("Имате незаписани промени. Да ги отхвърлим?", "You have unsaved changes. Discard them?"));
  }
  function go(route, fromHistory) {
    if (route === state.route) { closeMenu(); return; }
    if (!canLeave()) { if (fromHistory) history.replaceState(null, "", "#" + state.route); return; }
    clearDraft(); state.dirty = false; state.current = null;
    if (!fromHistory) history.pushState(null, "", "#" + route);
    renderRoute(route); closeMenu(); window.scrollTo(0, 0);
  }
  function closeMenu() { D.body.classList.remove("menu-open"); D.getElementById("mobile-menu").setAttribute("aria-expanded", "false"); D.getElementById("menu-backdrop").hidden = true; }
  function translateShell() {
    lang = "bg";
    D.documentElement.lang = "bg";
    D.querySelectorAll("[data-bg]").forEach(function (el) { el.textContent = el.dataset.bg; });
  }
  async function loadVehicles(recover) {
    var initialRoute = requestedRoute();
    var savedDraft = recover ? draft() : null;
    if (savedDraft && savedDraft.route !== initialRoute) savedDraft = null;
    var request = api("/api/admin/vehicles");
    // Recover only the exact editor route the user reopened. A stale draft
    // must never hijack Dashboard/Cars navigation or replace current images.
    if (savedDraft) {
      state.route = savedDraft.route;
      editor(savedDraft.vehicle, !savedDraft.vehicle.id, savedDraft);
    } else if (initialRoute === "new" || initialRoute.indexOf("edit=") === 0) renderRoute(initialRoute);
    else view.innerHTML = '<div class="empty"><strong>' + t("Зареждане…", "Loading…") + '</strong></div>';
    try {
      var data = await request;
      state.vehicles = Array.isArray(data.vehicles) ? data.vehicles : []; state.canImport = data.can_import === true;
      detailCache.forEach(function (cached) {
        var index = state.vehicles.findIndex(function (vehicle) { return vehicle.id === cached.vehicle.id; });
        if (index >= 0 && String(cached.vehicle.updated_at) >= String(state.vehicles[index].updated_at)) state.vehicles[index] = cached.vehicle;
      });
      if (!state.current && state.route.indexOf("edit=") !== 0) renderRoute(requestedRoute());
    } catch (error) {
      if (state.current || state.route.indexOf("edit=") === 0) { toast(error.message, true); return; }
      view.innerHTML = '<section class="card empty"><h1>' + t("Автомобилите не са достъпни", "Inventory unavailable") + '</h1><p>' + esc(error.message) +
        '</p><button class="primary" id="reload-inventory">' + t("Опитай отново", "Try again") + '</button></section>';
      D.getElementById("reload-inventory").onclick = function () { loadVehicles(true); };
    }
  }
  function bootstrapBanner() {
    if (!state.canImport) return "";
    return '<div class="bootstrap"><p><strong>' + t("Добавете текущите автомобили", "Import the current inventory") + '</strong>' +
      t("Снимките и оборудването ще бъдат добавени автоматично.", "Photos and equipment are included automatically.") +
      '</p><button class="primary" id="bootstrap">' + t("Импортирай", "Import") + '</button></div>';
  }
  function inventoryCards(list) {
    if (!list.length) return '<div class="empty"><strong>' + t("Няма автомобили", "No cars found") + '</strong>' + t("Променете търсенето или добавете автомобил.", "Change your search or add a car.") + '</div>';
    return '<div class="inventory-list">' + list.map(function (v) {
      var src = imageUrl((v.images || [])[0], 400);
      return '<article class="inventory-card"><a class="car-cell" href="#edit=' + encodeURIComponent(v.id) + '" data-edit="' + esc(v.id) + '">' +
        (src ? '<img class="car-thumb" src="' + esc(src) + '" alt="" loading="lazy" decoding="async" width="128" height="80">' : '<span class="car-thumb car-thumb--empty">' + t("Без снимка", "No photo") + '</span>') +
        '<span class="car-name"><strong>' + esc(carName(v)) + '</strong><span>' + esc(v.ref || v.slug || "") + '</span></span></a>' +
        '<dl class="car-facts"><div><dt>' + t("Цена", "Price") + '</dt><dd>' + esc(money(v.price)) + '</dd></div><div><dt>' + t("Пробег", "Mileage") + '</dt><dd>' + esc(mileage(v.mileage)) + '</dd></div></dl>' +
        '<div class="inventory-footer">' + pill(v.published) + '<div class="row-actions"><button class="button button--quiet" data-quick-publish="' + esc(v.id) + '">' +
        (v.published ? t("Скрий", "Unpublish") : t("Публикувай", "Publish")) + '</button><a class="secondary" href="#edit=' + encodeURIComponent(v.id) + '" data-edit="' + esc(v.id) + '">' +
        t("Редактирай", "Edit") + '</a></div></div></article>';
    }).join("") + '</div>';
  }
  function pill(published) { return '<span class="pill ' + (published ? "pill--live" : "pill--draft") + '">' + (published ? t("Публикуван", "Published") : t("Чернова", "Draft")) + '</span>'; }
  function dashboard() {
    var published = state.vehicles.filter(function (v) { return v.published; }).length;
    view.innerHTML = '<div class="view-head"><div class="view-title"><p>AutoHaus</p><h1>' + t("Начало", "Overview") + '</h1></div><button class="primary" data-go="new">' + t("+ Добави автомобил", "+ Add car") + '</button></div>' +
      bootstrapBanner() + '<div class="stat-grid">' +
      [[t("Всички", "All cars"), state.vehicles.length, "all"], [t("Публикувани", "Published"), published, "published"], [t("Чернови", "Drafts"), state.vehicles.length - published, "draft"]].map(function (item) {
        return '<button class="stat-card" data-stat-filter="' + item[2] + '"><span>' + item[0] + '</span><strong>' + item[1] + '</strong></button>';
      }).join("") + '</div><section class="panel"><div class="panel-head"><h2>' + t("Последно редактирани", "Recently edited") + '</h2><button class="button button--quiet" data-go="cars">' + t("Виж всички", "View all") +
      '</button></div>' + inventoryCards(state.vehicles.slice(0, 6)) + '</section>';
    bindCommon();
    D.querySelectorAll("[data-stat-filter]").forEach(function (button) { button.onclick = function () { state.filter = button.dataset.statFilter; go("cars"); }; });
  }
  function cars() {
    view.innerHTML = '<div class="view-head"><div class="view-title"><h1>' + t("Автомобили", "Cars") + '</h1><p>' + state.vehicles.length + ' ' + t("автомобила", "cars") +
      '</p></div><button class="primary" data-go="new">' + t("+ Добави автомобил", "+ Add car") + '</button></div>' + bootstrapBanner() +
      '<section class="panel"><div class="inventory-tools"><label class="search-field"><span class="sr-only">' + t("Търси автомобили", "Search cars") +
      '</span><input id="car-search" type="search" value="' + esc(state.search) + '" placeholder="' + t("Марка, модел, референция…", "Make, model, reference…") +
      '" autocomplete="off"></label><div class="filter-tabs" role="group" aria-label="' + t("Статус", "Status") + '">' +
      [["all", t("Всички", "All")], ["published", t("Публикувани", "Published")], ["draft", t("Чернови", "Drafts")]].map(function (item) {
        return '<button type="button" data-filter="' + item[0] + '" aria-pressed="' + (state.filter === item[0]) + '">' + item[1] + '</button>';
      }).join("") + '</div></div><p class="result-count" id="result-count" role="status"></p><div id="car-list"></div></section>';
    bindCommon();
    D.getElementById("car-search").oninput = function (event) {
      state.search = event.target.value;
      if (searchFrame) return;
      searchFrame = requestAnimationFrame(function () { searchFrame = 0; renderFilteredCars(); });
    };
    D.querySelectorAll("[data-filter]").forEach(function (button) { button.onclick = function () {
      state.filter = button.dataset.filter;
      D.querySelectorAll("[data-filter]").forEach(function (item) { item.setAttribute("aria-pressed", String(item.dataset.filter === state.filter)); });
      renderFilteredCars();
    }; });
    renderFilteredCars();
  }
  function renderFilteredCars() {
    var words = state.search.trim().toLocaleLowerCase().split(/\s+/);
    var filtered = state.vehicles.filter(function (v) {
      var text = [v.make, v.model, v.full_name, v.ref, v.slug].join(" ").toLocaleLowerCase();
      return words.every(function (word) { return text.indexOf(word) >= 0; }) && (state.filter === "all" || v.published === (state.filter === "published"));
    });
    D.getElementById("car-list").innerHTML = inventoryCards(filtered);
    D.getElementById("result-count").textContent = filtered.length + " " + t("автомобила", "cars");
    bindCards(); applyRole();
  }
  async function importLegacy() {
    var button = D.getElementById("bootstrap"); button.disabled = true; button.textContent = t("Импортиране…", "Importing…");
    try { var result = await api("/api/admin/vehicles?action=bootstrap", { method: "POST", body: {} }); toast(t("Импортирани: ", "Imported: ") + result.imported); await loadVehicles(); }
    catch (error) { toast(error.message, true); button.disabled = false; button.textContent = t("Импортирай", "Import"); }
  }
  function blankVehicle() {
    return { id: "", slug: "", ref: "", make: "", model: "", full_name: "", body_type: "", colour: "",
      transmission: "", fuel: "", mileage: null, first_registration_year: null, first_registration_month: null,
      unregistered: false, horsepower: null, price: null, chapter: "saloon", tags: [], notes: [],
      description_bg: "", description_en: "", equipment_bg: [], equipment_en: [], images: [], source_url: "", published: false };
  }
  function field(label, name, value, type, extra) {
    return '<label class="field"><span>' + esc(label) + '</span><input name="' + name + '" type="' + (type || "text") + '" value="' + esc(value) + '" ' +
      (type === "number" ? 'inputmode="numeric" ' : "") + (extra || "") + '></label>';
  }
  function select(label, name, current, options) {
    if (current && !options.some(function (item) { return item[0] === current; })) options = [[current, current]].concat(options);
    return '<label class="field"><span>' + esc(label) + '</span><select name="' + name + '">' + options.map(function (item) {
      return '<option value="' + esc(item[0]) + '"' + (String(current || "") === item[0] ? " selected" : "") + '>' + esc(item[1]) + '</option>';
    }).join("") + '</select></label>';
  }
  function editor(v, isNew, recovered) {
    destroyImageSorter();
    state.current = clone(v); state.dirty = !!recovered; state.saved = false; state.removed = recovered ? recovered.removed || [] : []; state.failedFiles = [];
    D.body.classList.add("is-editing"); markNav(isNew ? "new" : state.route);
    var car = state.current; state.reviewNotes = []; state.aiNeedsReview = false;
    view.innerHTML = '<div class="view-head editor-heading"><div class="view-title"><a class="back-link" href="#cars" data-go="cars">← ' + t("Автомобили", "Cars") +
      '</a><h1>' + esc(isNew ? t("Нов автомобил", "New car") : carName(car)) + '</h1><div class="heading-status">' + pill(car.published) +
      '</div></div></div>' +
      (recovered && !recovered.silent ? '<div class="recovery-note" role="status">' + t("Незаписаните промени са възстановени.", "Your unsaved changes have been restored.") + '</div>' : "") +
      '<form id="car-form" class="editor" data-recovered="' + (recovered ? '1' : '0') + '" novalidate><fieldset class="editor-main" id="editor-fields"><legend class="sr-only">' + t("Данни за автомобила", "Vehicle details") + '</legend>' +
      '<section class="card" id="basics"><h2>' + t("Автомобил", "Car") + '</h2><div class="field-grid">' +
      field(t("Марка *", "Make *"), "make", car.make, "text", "required maxlength=120 autocomplete=off") +
      field(t("Модел *", "Model *"), "model", car.model, "text", "required maxlength=220 autocomplete=off") +
      field(t("Цена (€)", "Price (€)"), "price", car.price == null || car.price === "" ? "" : Math.round(Number(car.price)), "text", 'inputmode="numeric" pattern="[0-9]*" maxlength="12" placeholder="Цена при запитване" autocomplete="off"') +
      field(t("Пробег (км)", "Mileage (km)"), "mileage", car.mileage, "number", "min=0 step=1") +
      '</div></section><section class="card" id="photos"><div class="section-title"><h2>' + t("Снимки", "Photos") + '</h2><span class="muted" id="image-count"></span></div>' +
      '<div class="dropzone" id="dropzone"><input id="image-input" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif,.jpg,.jpeg,.png,.webp" multiple>' +
      '<input id="camera-input" type="file" accept="image/*" capture="environment"><div class="upload-actions"><button type="button" class="primary" id="choose-images">' +
      t("+ Добави снимки", "+ Add photos") + '</button><button type="button" class="secondary" id="take-photo">' + t("Камера", "Camera") + '</button></div>' +
      '<p>' + t("Изберете няколко снимки. Първата е главна. Новите снимки се изрязват автоматично до формата, избран в Настройки.", "Select multiple photos. The first is the cover. New photos are automatically cropped to the format selected in Settings.") +
      '</p><div class="upload-status" id="upload-status" role="status"></div><button type="button" class="secondary" id="retry-images" hidden>' + t("Опитай неуспешните отново", "Retry failed photos") +
      '</button></div><p class="field-hint" id="photo-order-hint">' + t("Подредете снимките чрез влачене на дръжката. Първата е главна. Запишете автомобила, за да запазите реда.", "Drag the handle to reorder photos. The first is the cover. Save the car to keep the new order.") + '</p><div class="image-grid" id="image-list" aria-describedby="photo-order-hint"></div></section>' +
      '<section class="card"><h2>' + t("Характеристики", "Specifications") + '</h2><div class="field-grid">' +
      select(t("Купе", "Body type"), "body_type", car.body_type, [["", t("Изберете", "Select")], ["suv", "SUV"], ["passenger", t("Лек автомобил", "Passenger car")], ["sedan", t("Седан", "Saloon")], ["wagon", t("Комби", "Estate")], ["coupe", t("Купе", "Coupe")], ["cabrio", t("Кабрио", "Convertible")], ["van", t("Ван", "Van")], ["pickup", t("Пикап", "Pickup")]]) +
      field(t("Цвят", "Colour"), "colour", car.colour, "text", "maxlength=120") +
      select(t("Гориво", "Fuel"), "fuel", car.fuel, [["", t("Изберете", "Select")], ["petrol", t("Бензин", "Petrol")], ["diesel", t("Дизел", "Diesel")], ["hybrid", t("Хибрид", "Hybrid")], ["phev", t("Plug-in хибрид", "Plug-in hybrid")], ["ev", t("Електрически", "Electric")]]) +
      select(t("Трансмисия", "Transmission"), "transmission", car.transmission, [["", t("Изберете", "Select")], ["auto", t("Автоматична", "Automatic")], ["manual", t("Ръчна", "Manual")]]) +
      field(t("Мощност (к.с.)", "Power (hp)"), "horsepower", car.horsepower, "number", "min=1 step=1") +
      '<label class="check"><input type="checkbox" name="unregistered"' + (car.unregistered ? " checked" : "") + '><span>' + t("Без първа регистрация", "No first registration") + '</span></label>' +
      field(t("Първа регистрация — година", "First registration — year"), "first_registration_year", car.first_registration_year, "number", "min=1900 max=2100 step=1") +
      select(t("Месец", "Month"), "first_registration_month", String(car.first_registration_month || ""), [["", "—"]].concat(Array.from({ length: 12 }, function (_, i) { return [String(i + 1), String(i + 1).padStart(2, "0")]; }))) +
      '</div></section><section class="card" id="description"><div class="section-title"><h2>Оборудване</h2>' +
      '<div class="admin-lang-tabs" data-admin-lang-tabs="equipment" role="tablist" aria-label="Език на оборудването">' +
      '<button type="button" data-admin-lang-target="equipment-bg-panel" aria-selected="true">Български</button>' +
      '<button type="button" data-admin-lang-target="equipment-en-panel" aria-selected="false">English</button></div></div>' +
      '<div id="equipment-bg-panel" data-admin-lang-panel="equipment"><label class="field"><span>Оборудване · по един елемент на ред</span><textarea id="equipment-bg" lang="bg" rows="10">' + esc(lines(car.equipment_bg)) + '</textarea></label></div>' +
      '<div id="equipment-en-panel" data-admin-lang-panel="equipment" hidden><label class="field auto-translation-preview"><span>Equipment · English</span><textarea id="equipment-en" lang="en" rows="10" readonly tabindex="-1">' + esc(lines(car.equipment_en)) + '</textarea><small class="field-hint" data-auto-translate-status="equipment"></small></label></div>' +
      '<p class="field-hint">Пишете оборудването на български. English се превежда автоматично и е само за преглед.</p></section>' +
      '<details class="card more-details"><summary>' + t("Допълнителни данни", "Additional details") + '</summary><div class="field-grid">' +
      field(t("Пълно име", "Display name"), "full_name", car.full_name, "text", "maxlength=320") +
      field(t("Референция", "Reference"), "ref", car.ref, "text", "maxlength=80") +
      field(t("Адрес на страницата", "Page address"), "slug", car.slug, "text", "maxlength=180 autocapitalize=none spellcheck=false") +
      '</div><div class="admin-language-block"><div class="admin-lang-tabs" data-admin-lang-tabs="notes" role="tablist" aria-label="Език на бележките">' +
      '<button type="button" data-admin-lang-target="notes-bg-panel" aria-selected="true">Български</button>' +
      '<button type="button" data-admin-lang-target="notes-en-panel" aria-selected="false">English</button></div>' +
      '<div id="notes-bg-panel" data-admin-lang-panel="notes"><label class="field"><span>Бележки · по една на ред</span><textarea name="notes" rows="4">' + esc(lines(car.notes)) + '</textarea></label></div>' +
      '<div id="notes-en-panel" data-admin-lang-panel="notes" hidden><label class="field auto-translation-preview"><span>Notes · English</span><textarea id="notes-en-preview" lang="en" rows="4" readonly tabindex="-1">' + esc(lines(car.notes_en || [])) + '</textarea><small class="field-hint" data-auto-translate-status="notes"></small></label></div>' +
      '</div></details>' +
      '<section class="card manage-card"><h2>' + t("Управление", "Manage") + '</h2><div class="manage-actions">' +
      (!isNew && car.slug ? '<a class="secondary" href="/vehicle.html?id=' + encodeURIComponent(car.slug) + '" target="_blank" rel="noopener">' + t("Виж страницата ↗", "View page ↗") + '</a>' : "") +
      (car.published ? '<button type="button" class="secondary" id="unpublish-car">' + t("Свали от сайта", "Unpublish") + '</button>' : "") +
      (!isNew ? '<button type="button" class="danger" id="delete-car">' + t("Изтрий автомобила", "Delete car") + '</button>' : "") +
      (isNew ? '<p class="muted">' + t("Черновата се вижда само от екипа.", "Only your team can see a draft.") + '</p>' : "") +
      '</div></section></fieldset><aside class="editor-side"><div class="save-card"><div id="save-state" class="save-state" role="status"></div><div class="save-actions"><button type="submit" class="' +
      (car.published ? "primary" : "secondary") + '" id="save-car"></button>' + (!car.published ? '<button type="button" class="primary" id="publish-car">' + t("Публикувай", "Publish") + '</button>' : "") +
      '</div><div class="editor-shortcuts"><a href="#photos" data-scroll="photos">' + t("Снимки", "Photos") + '</a><a href="#description" data-scroll="description">' + t("Оборудване", "Equipment") +
      '</a></div></div></aside></form>';
    renderImages(); bindEditor(); updateSaveState();
  }
  function collectForm() {
    var form = D.getElementById("car-form"); if (!form || !state.current) return null;
    function value(name) { return form.elements[name].value.trim(); }
    function number(name) { return value(name) === "" ? null : Number(value(name)); }
    var unregistered = form.elements.unregistered.checked, make = value("make"), model = value("model");
    var notes = splitLines(value("notes")), vat = form.elements.show_price_without_vat;
    if (vat && vat.checked) {
      var vatNote = form.dataset.ahOriginalVatNote || "Цена без начислен 20% ДДС";
      if (notes.indexOf(vatNote) < 0) notes.push(vatNote);
    }
    return { make: make, model: model, full_name: value("full_name") || [make, model].filter(Boolean).join(" "),
      slug: value("slug") || slugify(make + " " + model), ref: value("ref"), body_type: value("body_type"), colour: value("colour"),
      transmission: value("transmission"), fuel: value("fuel"), mileage: number("mileage"), horsepower: number("horsepower"), price: value("price") === "" ? null : parseInt(value("price"), 10),
      first_registration_year: unregistered ? null : number("first_registration_year"), first_registration_month: unregistered ? null : number("first_registration_month"),
      // Legacy catalog metadata is no longer edited here; keep it intact on save.
      unregistered: unregistered, chapter: state.current.chapter || "saloon", tags: clone(state.current.tags || []), notes: notes,
      description_source: state.current.description_source || "", description_review_notes: clone(state.current.description_review_notes || []),
      description_bg: state.current.description_bg || "", description_en: state.current.description_en || "",
      equipment_bg: splitLines(D.getElementById("equipment-bg").value), equipment_en: splitLines(D.getElementById("equipment-en").value),
      images: clone(state.current.images || []), source_url: state.current.source_url || "", published: !!state.current.published };
  }
  function validateCar(data) {
    var form = D.getElementById("car-form"), invalid = [];
    form.querySelectorAll("[aria-invalid]").forEach(function (el) { el.removeAttribute("aria-invalid"); });
    form.querySelectorAll("input,select,textarea").forEach(function (el) { if (!el.disabled && !el.validity.valid) invalid.push(el); });
    if (!data.make && invalid.indexOf(form.elements.make) < 0) invalid.push(form.elements.make);
    if (!data.model && invalid.indexOf(form.elements.model) < 0) invalid.push(form.elements.model);
    if (data.first_registration_month != null && data.first_registration_year == null) invalid.push(form.elements.first_registration_year);
    if (invalid.length) {
      invalid.forEach(function (el) { el.setAttribute("aria-invalid", "true"); var details = el.closest("details"); if (details) details.open = true; });
      invalid[0].focus(); toast(t("Проверете отбелязаните полета.", "Check the highlighted fields."), true); return false;
    }
    if (data.images.length > 80) { toast(t("Максимум 80 снимки за автомобил.", "A car can have up to 80 photos."), true); return false; }
    return true;
  }
  async function saveCar(published) {
    if (isBusy()) return;
    var data = collectForm(); if (!data) return;
    if (typeof published === "boolean") data.published = published;
    if (state.aiNeedsReview) { toast(t("Прегледайте резултата и потвърдете BG + EN преди запис.", "Review and confirm BG + EN before saving."), true); D.getElementById("ai-reviewed").focus(); return; }
    if (!validateCar(data)) return;
    if (data.published && (!data.fuel || !data.transmission)) { toast(t("Изберете гориво и трансмисия преди публикуване.", "Choose fuel and transmission before publishing."), true); D.getElementById("car-form").elements[!data.fuel ? "fuel" : "transmission"].focus(); return; }
    if (state.current.updated_at) data.if_unmodified_since = state.current.updated_at;
    if (data.published && !data.images.length) { toast(t("Добавете поне една снимка преди публикуване.", "Add at least one photo before publishing."), true); D.getElementById("choose-images").focus(); return; }
    var currentId = state.current.id, wasPublished = state.current.published, removed = state.removed.slice();
    state.saveBusy = true; updateSaveState(); persistDraft();
    try {
      var result = await api("/api/admin/vehicles" + (currentId ? "?id=" + encodeURIComponent(currentId) : ""), { method: currentId ? "PATCH" : "POST", body: data });
      if (!result.vehicle || !result.vehicle.id) throw new Error(t("Липсва потвърждение за записа. Опитайте отново.", "The save was not confirmed. Please retry."));
      state.current = result.vehicle; state.dirty = false; clearDraft();
      state.vehicles = state.vehicles.filter(function (v) { return v.id !== result.vehicle.id; }); state.vehicles.unshift(result.vehicle);
      rememberDetail(result.vehicle); inventoryChanged(); state.removed = [];
      state.route = "edit=" + encodeURIComponent(result.vehicle.id); history.replaceState(null, "", "#" + state.route);
      state.saveBusy = false;
      if (!currentId || wasPublished !== result.vehicle.published) editor(result.vehicle, false);
      else view.querySelector(".editor-heading h1").textContent = carName(result.vehicle);
      state.saved = true; updateSaveState();
      toast(data.published ? t("Промените са публикувани", "Changes published") : t("Черновата е записана", "Draft saved"));
      // Only remove storage assets after the vehicle no longer references them.
      await Promise.all(removed.filter(function (img) { return img.public_id && !img.legacy; }).map(function (img) {
        return api("/api/admin/images?action=delete", { method: "POST", body: { public_id: img.public_id, responsive: isResponsiveImage(img) } }).catch(function () { /* Vehicle is saved; unused asset can be cleaned up later. */ });
      }));
    } catch (error) { toast(error.message, true); state.saveBusy = false; updateSaveState(); }
  }
  async function deleteCar() {
    if (isBusy() || !state.current.id || !confirm(t("Да изтрием окончателно „", "Permanently delete “") + carName(state.current) + t("“? Това не може да се отмени.", "”? This cannot be undone."))) return;
    state.saveBusy = true; updateSaveState();
    try {
      var id = state.current.id; await api("/api/admin/vehicles?id=" + encodeURIComponent(id), { method: "DELETE" });
      invalidateDetail(id); inventoryChanged();
      state.vehicles = state.vehicles.filter(function (v) { return v.id !== id; }); state.dirty = false; clearDraft(); state.saveBusy = false;
      go("cars"); toast(t("Автомобилът е изтрит", "Car deleted"));
    } catch (error) { toast(error.message, true); state.saveBusy = false; updateSaveState(); }
  }
  function destroyImageSorter() { if (imageSorter) { imageSorter.destroy(); imageSorter = null; } }
  function renderImages(focusIndex) {
    destroyImageSorter();
    var images = state.current.images || [], list = D.getElementById("image-list");
    D.getElementById("image-count").textContent = images.length + " / 80";
    list.innerHTML = images.map(function (img, i) {
      var label = t("Снимка ", "Photo ") + (i + 1);
      return '<article class="image-card" data-image-index="' + i + '"><img src="' + esc(imageUrl(img, 800)) + '" alt="' + label +
        '" loading="lazy" decoding="async" draggable="false"><div class="image-heading"><span>' + (i === 0 ? t("Главна снимка", "Cover photo") : label) +
        '</span>' + (i ? '<button type="button" class="cover-button" data-img-cover="' + i + '" aria-label="' + esc(t("Направи главна снимка ", "Make cover photo ") + (i + 1)) + '">' + t("Главна", "Set cover") + '</button>' : "") +
        '</div><div class="image-actions"><button type="button" class="image-drag-handle" data-img-drag="' + i + '" aria-label="' + esc(t("Подреди снимка ", "Reorder photo ") + (i + 1)) + '"' + (images.length < 2 ? ' disabled' : '') + '><span aria-hidden="true">⠿</span> ' + t("Премести", "Move") + '</button><button type="button" class="image-remove" data-img-remove="' + i + '" aria-label="' + esc(t("Премахни снимка ", "Remove photo ") + (i + 1)) + '">×</button></div></article>';
    }).join("");
    list.querySelectorAll("[data-img-cover]").forEach(function (button) { button.onclick = function () { moveImage(Number(button.dataset.imgCover), 0); }; });
    list.querySelectorAll("[data-img-remove]").forEach(function (button) { button.onclick = function () {
      var index = Number(button.dataset.imgRemove);
      if (isBusy() || role === "viewer" || !confirm(t("Да премахнем тази снимка?", "Remove this photo?"))) return;
      state.removed.push(state.current.images.splice(index, 1)[0]); reindexImages(); setDirty(); renderImages(Math.min(index, state.current.images.length - 1));
    }; });
    if (window.AH_IMAGE_SORTER) imageSorter = window.AH_IMAGE_SORTER.attach(list, {
      onMove: moveImage,
      isDisabled: function () { return isBusy() || role === "viewer"; },
      labels: {
        instructions: t("Влачете дръжката, за да преместите снимката. С клавиатура: Интервал за избор, стрелки за преместване, Enter за потвърждение и Escape за отказ.", "Drag the handle to move a photo. Keyboard: Space to pick up, arrows to move, Enter to drop, Escape to cancel."),
        picked: function (position, count) { return t("Избрана снимка ", "Picked up photo ") + position + t(" от ", " of ") + count; },
        moved: function (position, count) { return t("Позиция ", "Position ") + position + t(" от ", " of ") + count; },
        dropped: function (position, count) { return t("Снимката е на позиция ", "Photo dropped at position ") + position + t(" от ", " of ") + count; },
        cancelled: t("Преместването е отменено.", "Reordering cancelled.")
      }
    });
    if (typeof focusIndex === "number" && focusIndex >= 0) {
      var focused = list.querySelector('[data-image-index="' + focusIndex + '"] .image-actions button:not(:disabled)'); if (focused) focused.focus({ preventScroll: true });
    }
  }
  function reindexImages() { state.current.images.forEach(function (img, i) { img.position = i; }); }
  function moveImage(from, to) {
    var images = state.current.images;
    if (isBusy() || role === "viewer" || !Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < 0 || from >= images.length || to >= images.length || from === to) return;
    images.splice(to, 0, images.splice(from, 1)[0]); reindexImages(); setDirty(); renderImages(to);
    toast(t("Редът на снимките е променен", "Photo order updated"));
  }
  var watermarkAssetPromise = null;
  function watermarkAsset() {
    if (watermarkAssetPromise) return watermarkAssetPromise;
    watermarkAssetPromise = new Promise(function (resolve, reject) {
      var logo = new Image();
      var timer = setTimeout(function () { reject(new Error("Watermark asset timed out")); }, 12000);
      logo.decoding = "async";
      logo.onload = function () {
        clearTimeout(timer);
        (logo.decode ? logo.decode().catch(function () {}) : Promise.resolve()).then(function () { resolve(logo); });
      };
      logo.onerror = function () { clearTimeout(timer); reject(new Error("Watermark asset unavailable")); };
      logo.src = "/autohaus.svg";
    }).catch(function (error) {
      watermarkAssetPromise = null;
      throw error;
    });
    return watermarkAssetPromise;
  }

  async function preparePhoto(file, mediaSettings) {
    mediaSettings = mediaSettings || {};
    var aspectRatio = mediaSettings.photo_aspect_ratio === "16:10" ? "16:10" : "16:9";
    /* Every public upload gets a pixel-level protection mark. If the visible
       watermark is enabled, use its exact settings. If it is disabled, keep a
       very faint security mark so direct downloads are still not pristine. */
    var watermark = await watermarkAsset();
    var visibleWatermark = mediaSettings.watermark_enabled === true;
    var watermarkTransparency = visibleWatermark ? Math.max(0, Math.min(100, Number(mediaSettings.watermark_transparency))) : 93;
    if (!Number.isFinite(watermarkTransparency)) watermarkTransparency = visibleWatermark ? 75 : 93;
    var watermarkSize = visibleWatermark ? Math.max(10, Math.min(60, Number(mediaSettings.watermark_size))) : 13;
    if (!Number.isFinite(watermarkSize)) watermarkSize = 13;
    var watermarkOpacity = (100 - watermarkTransparency) / 100;

    var url = URL.createObjectURL(file), img = new Image();
    try {
      img.src = url; await img.decode();
      if (!img.naturalWidth || !img.naturalHeight || img.naturalWidth * img.naturalHeight > 140000000) throw new Error("Unsafe image dimensions");

      /* New uploads are physically cropped to the global product-photo
         ratio. Existing/legacy photos use the same ratio at presentation
         time, so changing the setting never requires duplicating old files. */
      var ratioHeight = aspectRatio === "16:10" ? 10 : 9;
      var targetRatio = 16 / ratioHeight;
      var sourceRatio = img.naturalWidth / img.naturalHeight;
      var sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight;
      if (sourceRatio < targetRatio) {
        sh = Math.round(sw / targetRatio);
        sy = Math.max(0, Math.round((img.naturalHeight - sh) / 2));
      } else if (sourceRatio > targetRatio) {
        sw = Math.round(sh * targetRatio);
        sx = Math.max(0, Math.round((img.naturalWidth - sw) / 2));
      }

      var canvas = D.createElement("canvas");
      async function encode(width, height, type, quality) {
        canvas.width = Math.max(1, Math.round(width)); canvas.height = Math.max(1, Math.round(height));
        var ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas unavailable");
        ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
        ctx.fillStyle = "#f6f5f1"; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

        /* Bake the public watermark into the actual bytes. This happens once
           in the admin before upload; visitors pay zero runtime cost and every
           responsive derivative/direct download carries the AutoHaus mark. */
        if (watermark && watermarkOpacity > 0) {
          var markWidth = Math.max(1, Math.round(canvas.width * watermarkSize / 100));
          var markHeight = Math.max(1, Math.round(markWidth * 85 / 481.9));
          ctx.save();
          ctx.globalAlpha = watermarkOpacity;
          ctx.drawImage(watermark, Math.round((canvas.width - markWidth) / 2), Math.round((canvas.height - markHeight) / 2), markWidth, markHeight);
          ctx.restore();
        }

        var blob = await new Promise(function (resolve) { canvas.toBlob(resolve, type, quality); });
        if (!blob || (type === "image/webp" && blob.type !== "image/webp")) throw new Error(type === "image/webp" ? "WebP encoding unavailable" : "Image conversion failed");
        return blob;
      }
      function widthSize(target) {
        var width = Math.min(target, sw);
        return { width: width, height: Math.max(1, Math.round(width / targetRatio)) };
      }
      var width = Math.max(1, Math.round(Math.min(1600, sw)));
      var height = Math.max(1, Math.round(width / targetRatio));
      var files = { original: await encode(width, height, "image/jpeg", .92) };
      for (var i = 0; i < 3; i++) {
        var target = [400, 800, 1280][i], size = widthSize(target);
        files["jpg" + target] = await encode(size.width, size.height, "image/jpeg", .90);
        files["webp" + target] = await encode(size.width, size.height, "image/webp", .88);
      }
      canvas.width = 1; canvas.height = 1;
      return { width: width, height: height, files: files, embeddedWatermark: true };
    } catch (error) {
      var webp = error && error.message === "WebP encoding unavailable";
      throw new Error(webp ? t("Този браузър не може да подготви оптимизирани WebP снимки. Обновете браузъра и опитайте отново.", "This browser cannot prepare optimized WebP photos. Update it and try again.") :
        t("Този формат не се отваря. Изберете JPEG снимка или използвайте камерата.", "This image format cannot be opened. Choose a JPEG photo or use the camera."));
    }
    finally { URL.revokeObjectURL(url); }
  }
  async function uploadPhotoBlob(target, blob, headers, name) {
    if (!target || !target.upload_url || !blob) throw new Error(t("Липсва адрес за качване", "Upload address is missing"));
    var fd = new FormData(); fd.append("cacheControl", "31536000"); fd.append("", blob, name);
    var controller = new AbortController(), timer = setTimeout(function () { controller.abort(); }, 120000), response, uploaded;
    try {
      response = await fetch(target.upload_url, { method: "PUT", headers: headers, body: fd, signal: controller.signal });
      uploaded = await response.json().catch(function () { return {}; });
    } finally { clearTimeout(timer); }
    if (!response.ok) {
      var error = new Error(uploaded.error && uploaded.error.message || t("Качването не успя", "Upload failed"));
      error.status = response.status; throw error;
    }
  }
  async function uploadPreparedPhoto(sign, prepared) {
    if (!sign.responsive || !sign.uploads) {
      await uploadPhotoBlob({ upload_url: sign.upload_url }, prepared.files.original, sign.headers, "original.jpg");
      return false;
    }
    var keys = ["original", "jpg400", "jpg800", "jpg1280", "webp400", "webp800", "webp1280"], cursor = 0;
    async function worker() {
      while (cursor < keys.length) {
        var key = keys[cursor++], extension = key.indexOf("webp") === 0 ? ".webp" : ".jpg";
        await uploadPhotoBlob(sign.uploads[key], prepared.files[key], sign.headers, key + extension);
      }
    }
    // Let every upload finish before cleanup starts, so an in-flight worker
    // cannot recreate files after a failed photo has been cleaned up.
    var results = await Promise.allSettled([worker(), worker()]);
    var failed = results.find(function (result) { return result.status === "rejected"; });
    if (failed) throw failed.reason;
    return true;
  }
  async function uploadFiles(files) {
    if (isBusy()) return;
    files = Array.from(files || []); if (!files.length) return;
    if (state.current.images.length + files.length > 80) { toast(t("Максимум 80 снимки за автомобил.", "A car can have up to 80 photos."), true); return; }
    state.uploadBusy = true; state.failedFiles = []; updateSaveState();
    var statusEl = D.getElementById("upload-status"), completed = 0, finished = 0, failures = [], retry = D.getElementById("retry-images");
    var results = new Array(files.length), cursor = 0, authFailed = false;
    retry.hidden = true;
    statusEl.textContent = t("Подготовка…", "Preparing…");
    try {
      var mediaSettings = { photo_aspect_ratio: "16:9" };
      if (typeof window.AH_ADMIN_MEDIA_SETTINGS === "function") {
        try { mediaSettings = await window.AH_ADMIN_MEDIA_SETTINGS(false) || mediaSettings; } catch (_) {}
      }
      var uploadAspectRatio = mediaSettings.photo_aspect_ratio === "16:10" ? "16:10" : "16:9";
      async function uploadOne(index) {
        var original = files[index], sign = null;
        try {
          if (!/^image\//.test(original.type) && !/\.(heic|heif|jpe?g|png|webp)$/i.test(original.name)) throw new Error(t("Неподдържан формат", "Unsupported format"));
          if (original.size > 45 * 1024 * 1024) throw new Error(t("Снимката е над 45 MB", "Photo exceeds 45 MB"));
          var prepared = await preparePhoto(original, mediaSettings);
          sign = await api("/api/admin/images?action=sign", { method: "POST", body: { responsive: true } });
          var responsive = await uploadPreparedPhoto(sign, prepared);
          var result = await api("/api/admin/images?action=complete", { method: "POST", body: { public_id: sign.public_id, responsive: responsive, width: prepared.width, height: prepared.height, embedded_watermark: prepared.embeddedWatermark === true } });
          if (!result.image) throw new Error(t("Снимката не е потвърдена", "Photo could not be verified"));
          results[index] = result.image; completed++;
        } catch (error) {
          if (sign && sign.public_id) {
            await api("/api/admin/images?action=delete", { method: "POST", body: { public_id: sign.public_id, responsive: !!(sign.responsive && sign.uploads) } }).catch(function () {});
          }
          state.failedFiles.push(original); failures.push(original.name + ": " + (error.name === "AbortError" ? t("Времето изтече", "Upload timed out") : error.message));
          if (error.status === 401) authFailed = true;
        } finally {
          finished++;
          statusEl.textContent = t("Обработени ", "Processed ") + finished + " / " + files.length;
        }
      }
      async function worker() {
        while (!authFailed && cursor < files.length) {
          var index = cursor++;
          await uploadOne(index);
        }
      }
      var constrained = (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) || (navigator.deviceMemory && navigator.deviceMemory <= 4);
      var concurrency = constrained ? 1 : 2;
      await Promise.all(Array.from({ length: Math.min(concurrency, files.length) }, worker));
      if (authFailed && cursor < files.length) state.failedFiles = state.failedFiles.concat(files.slice(cursor));
      var added = results.filter(Boolean);
      if (added.length) {
        state.current.images = state.current.images.concat(added);
        reindexImages(); setDirty(); renderImages();
      }
      statusEl.textContent = completed + " / " + files.length + t(" снимки качени.", " photos uploaded.") + (failures.length ? " " + failures.join(" · ") : "");
      retry.hidden = !state.failedFiles.length; toast(failures.length ? t("Някои снимки не се качиха. Опитайте отново.", "Some photos failed. Please retry.") : t("Снимките са готови за запис", "Photos ready to save"), !!failures.length);
    } catch (error) { state.failedFiles = files; retry.hidden = false; statusEl.textContent = error.message; toast(error.message, true); }
    finally { state.uploadBusy = false; updateSaveState(); persistDraft(); }
  }
  function bindAdminLanguageTabs() {
    view.querySelectorAll("[data-admin-lang-tabs]").forEach(function (tabs) {
      var group = tabs.dataset.adminLangTabs;
      var buttons = Array.from(tabs.querySelectorAll("[data-admin-lang-target]"));
      function show(targetId) {
        buttons.forEach(function (button) {
          var selected = button.dataset.adminLangTarget === targetId;
          button.setAttribute("aria-selected", String(selected));
          button.setAttribute("role", "tab");
          button.setAttribute("aria-controls", button.dataset.adminLangTarget);
          button.tabIndex = selected ? 0 : -1;
        });
        view.querySelectorAll('[data-admin-lang-panel="' + group + '"]').forEach(function (panel) {
          panel.hidden = panel.id !== targetId;
        });
      }
      buttons.forEach(function (button, index) {
        button.onclick = function () { show(button.dataset.adminLangTarget); };
        button.onkeydown = function (event) {
          var next = event.key === "ArrowRight" ? (index + 1) % buttons.length :
            event.key === "ArrowLeft" ? (index + buttons.length - 1) % buttons.length :
            event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : -1;
          if (next < 0) return;
          event.preventDefault(); show(buttons[next].dataset.adminLangTarget); buttons[next].focus();
        };
      });
      if (buttons.length) show(buttons[0].dataset.adminLangTarget);
    });
  }
  function bindEditor() {
    var form = D.getElementById("car-form");
    var priceInput = form && form.elements && form.elements.price;
    if (priceInput) {
      priceInput.addEventListener("input", function () {
        var cleaned = priceInput.value.replace(/[^0-9]/g, "");
        if (priceInput.value !== cleaned) priceInput.value = cleaned;
      });
    }
    form.oninput = function () { setDirty(); };
    form.onchange = function () { setDirty(); syncRegistration(); };
    form.onsubmit = function (event) { event.preventDefault(); saveCar(); };
    var publish = D.getElementById("publish-car"); if (publish) publish.onclick = function () { saveCar(true); };
    var remove = D.getElementById("delete-car"); if (remove) remove.onclick = deleteCar;
    var unpublish = D.getElementById("unpublish-car"); if (unpublish) unpublish.onclick = function () { saveCar(false); };
    D.getElementById("choose-images").onclick = function () { D.getElementById("image-input").click(); };
    D.getElementById("take-photo").onclick = function () { D.getElementById("camera-input").click(); };
    ["image-input", "camera-input"].forEach(function (id) { D.getElementById(id).onchange = function (event) { uploadFiles(event.target.files); event.target.value = ""; }; });
    D.getElementById("retry-images").onclick = function () { uploadFiles(state.failedFiles.slice()); };
    var dropzone = D.getElementById("dropzone");
    ["dragenter", "dragover"].forEach(function (name) { dropzone.addEventListener(name, function (event) { event.preventDefault(); dropzone.classList.add("is-drag"); }); });
    ["dragleave", "drop"].forEach(function (name) { dropzone.addEventListener(name, function (event) { event.preventDefault(); dropzone.classList.remove("is-drag"); }); });
    dropzone.ondrop = function (event) { event.preventDefault(); uploadFiles(event.dataTransfer.files); };
    view.querySelectorAll("[data-scroll]").forEach(function (link) { link.onclick = function (event) { event.preventDefault(); D.getElementById(link.dataset.scroll).scrollIntoView({ behavior: "smooth", block: "start" }); }; });
    bindAdminLanguageTabs(); syncRegistration(); bindCommon(); applyRole();
  }
  function syncRegistration() {
    var form = D.getElementById("car-form"), disabled = form.elements.unregistered.checked;
    form.elements.first_registration_year.disabled = disabled; form.elements.first_registration_month.disabled = disabled;
  }
  function bindCards() {
    view.querySelectorAll("[data-edit]").forEach(function (link) {
      function warm() { if (detailRequests.size < 2) loadDetail(link.dataset.edit).catch(function () {}); }
      link.onpointerenter = warm; link.onfocus = warm;
      link.onclick = function (event) { if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return; event.preventDefault(); go("edit=" + encodeURIComponent(link.dataset.edit)); };
    });
    view.querySelectorAll("[data-quick-publish]").forEach(function (button) { button.onclick = async function () {
      var vehicle = state.vehicles.find(function (item) { return item.id === button.dataset.quickPublish; }); if (!vehicle) return;
      if (!vehicle.published && !(vehicle.images || []).length) { go("edit=" + encodeURIComponent(vehicle.id)); toast(t("Добавете снимка преди публикуване.", "Add a photo before publishing."), true); return; }
      button.disabled = true;
      try {
        var result = await api("/api/admin/vehicles?id=" + encodeURIComponent(vehicle.id), { method: "PATCH", body: { published: !vehicle.published, if_unmodified_since: vehicle.updated_at } });
        state.vehicles = state.vehicles.map(function (item) { return item.id === vehicle.id ? result.vehicle : item; });
        rememberDetail(result.vehicle); inventoryChanged();
        if (state.route === "cars") renderFilteredCars(); else if (state.route === "dashboard") dashboard();
        toast(result.vehicle.published ? t("Публикуван", "Published") : t("Свален от сайта", "Unpublished"));
      } catch (error) { toast(error.message, true); button.disabled = false; }
    }; });
  }
  function applyRole() {
    D.querySelectorAll('[data-route="new"],[data-go="new"],[data-quick-publish]').forEach(function (el) { el.hidden = role === "viewer"; });
    ["save-car", "publish-car", "unpublish-car", "choose-images", "take-photo", "delete-car"].forEach(function(id) { var el = D.getElementById(id); if (el) el.hidden = role === "viewer" || (id === "delete-car" && role === "editor"); });
    var fields = D.getElementById("editor-fields"); if (fields && role === "viewer") fields.disabled = true;
  }
  function bindCommon() {
    view.querySelectorAll("[data-go]").forEach(function (button) { button.onclick = function (event) { event.preventDefault(); go(button.dataset.go); }; });
    var boot = D.getElementById("bootstrap"); if (boot) boot.onclick = importLegacy;
    bindCards();
  }
  async function renderRoute(route) {
    destroyImageSorter();
    state.route = route || requestedRoute(); D.body.classList.remove("is-editing"); state.current = null; markNav(state.route);
    if (state.route === "dashboard") return dashboard();
    if (state.route === "cars") return cars();
    if (state.route === "new") return editor(blankVehicle(), true);
    if (state.route.indexOf("edit=") === 0) {
      var id; try { id = decodeURIComponent(state.route.slice(5)); } catch (_) { id = ""; }
      var expectedRoute = state.route;
      view.innerHTML = '<div class="empty" role="status">' + t("Зареждане…", "Loading…") + '</div>';
      try {
        var vehicle = await loadDetail(id);
        if (state.route === expectedRoute) editor(vehicle, false);
      } catch (e) { if (state.route === expectedRoute) view.innerHTML = '<div class="empty" role="alert">' + esc(e.message) + '</div>'; }
      return;
    }
    if (window.AH_ADMIN.renderExtra && window.AH_ADMIN.renderExtra(state.route)) return;
    history.replaceState(null, "", "#dashboard"); state.route = "dashboard"; markNav("dashboard"); dashboard();
  }
  var adminNav = D.querySelector(".side__nav");
  if (adminNav) adminNav.addEventListener("click", function (event) {
    var button = event.target && event.target.closest ? event.target.closest("[data-route]") : null;
    if (!button || !adminNav.contains(button)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    go(button.dataset.route);
  }, true);
  applyRole();
  D.getElementById("logout").onclick = async function () {
    if (!canLeave()) return;
    try { await api("/api/admin/auth?action=logout", { method: "POST", body: {} }); clearDraft(); state.dirty = false; location.replace("/admin/login.html"); }
    catch (error) { toast(error.message, true); }
  };
  D.getElementById("mobile-menu").onclick = function () {
    var open = !D.body.classList.contains("menu-open"); D.body.classList.toggle("menu-open", open); this.setAttribute("aria-expanded", String(open)); D.getElementById("menu-backdrop").hidden = !open;
  };
  D.getElementById("menu-backdrop").onclick = closeMenu;
  D.addEventListener("keydown", function (event) { if (event.key === "Escape") closeMenu(); });
  window.addEventListener("hashchange", function () { if (requestedRoute() !== state.route) go(requestedRoute(), true); });
  window.addEventListener("beforeunload", function (event) { if (state.dirty || isBusy()) { persistDraft(); event.preventDefault(); event.returnValue = ""; } });
  D.addEventListener("visibilitychange", function () { if (D.visibilityState === "hidden") persistDraft(); });
  // Defer startup until all deferred route extensions have registered. A fast
  // inventory response could otherwise replace a direct #settings/#team URL.
  function start() { translateShell(); loadVehicles(true); }
  if (D.readyState !== "complete") D.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
