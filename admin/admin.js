(function () {
  "use strict";

  var D = document;
  var view = D.getElementById("admin-view");
  var toastEl = D.getElementById("toast");
  var state = { vehicles: [], current: null, dirty: false, route: "dashboard", uploadBusy: false };
  var dragIndex = null;

  function esc(value) {
    return String(value == null ? "" : value).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function attr(value) { return esc(value); }
  function num(value) { return value == null || value === "" ? "" : String(value); }
  function lines(value) { return (Array.isArray(value) ? value : []).join("\n"); }
  function splitLines(value) {
    return String(value || "").split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean);
  }
  function splitTags(value) {
    return String(value || "").split(/[\n,]+/).map(function (s) { return s.trim(); }).filter(Boolean);
  }
  function slugify(value) {
    return String(value || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 180);
  }
  function money(v) {
    if (v == null || v === "") return "—";
    return new Intl.NumberFormat("bg-BG", { maximumFractionDigits: 0 }).format(Number(v)) + " €";
  }
  function km(v) {
    if (v == null || v === "") return "—";
    return new Intl.NumberFormat("bg-BG", { maximumFractionDigits: 0 }).format(Number(v)) + " км";
  }
  function thumb(v) {
    var images = Array.isArray(v.images) ? v.images : [];
    if (!images.length) return "";
    var img = images[0] || {};
    var variants = img.variants || {};
    return variants.webp400 || variants.jpg400 || img.original || "";
  }
  function toast(message, error) {
    toastEl.textContent = message;
    toastEl.classList.toggle("is-error", !!error);
    toastEl.classList.add("is-on");
    clearTimeout(toastEl.__t);
    toastEl.__t = setTimeout(function () { toastEl.classList.remove("is-on"); }, 2800);
  }

  function api(url, options) {
    options = options || {};
    options.credentials = "same-origin";
    options.headers = Object.assign({ Accept: "application/json" }, options.headers || {});
    if (options.body && typeof options.body !== "string" && !(options.body instanceof FormData)) {
      options.headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(options.body);
    }
    return fetch(url, options).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (data) {
        if (r.status === 401) { location.replace("/admin/login.html"); throw new Error("Authentication required"); }
        if (!r.ok) throw new Error(data.error || "Request failed");
        return data;
      });
    });
  }

  function setDirty(on) {
    state.dirty = on !== false;
    var el = D.getElementById("save-state");
    if (!el) return;
    el.classList.remove("is-dirty", "is-saved", "is-error");
    if (state.dirty) { el.classList.add("is-dirty"); el.textContent = "Незаписани промени"; }
    else { el.classList.add("is-saved"); el.textContent = "Записано"; }
  }

  function navOn(route) {
    Array.prototype.forEach.call(D.querySelectorAll("[data-route]"), function (b) {
      b.classList.toggle("is-on", b.getAttribute("data-route") === route);
    });
  }

  function go(route) {
    if (state.dirty && route !== state.route && !confirm("Имате незаписани промени. Да излезете без запис?")) return;
    state.dirty = false;
    state.route = route;
    location.hash = route;
    renderRoute();
    D.body.classList.remove("menu-open");
  }

  function routeFromHash() {
    var h = location.hash.replace(/^#/, "");
    return h || "dashboard";
  }

  function loadVehicles() {
    view.innerHTML = '<div class="empty"><strong>Зареждане…</strong></div>';
    return api("/api/admin/vehicles").then(function (data) {
      state.vehicles = data.vehicles || [];
      renderRoute();
    }).catch(function (err) {
      view.innerHTML = '<div class="card"><h2>Admin backend</h2><p class="muted small">' + esc(err.message) + '</p><p class="small">Проверете Supabase env променливите и изпълнете <code>admin/schema.sql</code>.</p></div>';
    });
  }

  function statCard(label, value) {
    return '<div class="stat-card"><span>' + esc(label) + '</span><strong>' + esc(value) + '</strong></div>';
  }

  function bootstrapBanner() {
    if (state.vehicles.length || !window.AH_VEHICLES || !window.AH_VEHICLES.length) return "";
    return '<div class="bootstrap"><p><strong>Импортирайте текущите автомобили</strong>Ще добавим сегашните ' +
      window.AH_VEHICLES.length + ' коли в admin базата без да променяме публичния сайт.</p><button class="primary" id="bootstrap">Импортирай</button></div>';
  }

  function dashboard() {
    navOn("dashboard");
    var published = state.vehicles.filter(function (v) { return v.published; }).length;
    var drafts = state.vehicles.length - published;
    var recent = state.vehicles.slice(0, 6);
    view.innerHTML =
      '<div class="view-head"><div class="view-title"><h1>Начало</h1><p>Auto House inventory</p></div><div class="actions"><button class="primary" data-go="new">+ Добави автомобил</button></div></div>' +
      bootstrapBanner() +
      '<div class="stat-grid">' + statCard("Всички", state.vehicles.length) + statCard("Публикувани", published) + statCard("Чернови", drafts) + '</div>' +
      '<section class="panel"><div class="panel-head"><h2>Последно редактирани</h2><button class="button button--quiet" data-go="cars">Виж всички</button></div>' +
      (recent.length ? table(recent) : '<div class="empty"><strong>Няма автомобили</strong>Импортирайте текущите или добавете нов.</div>') + '</section>';
    bindCommon();
    var boot = D.getElementById("bootstrap");
    if (boot) boot.addEventListener("click", importLegacy);
  }

  function table(list) {
    return '<div class="table-wrap"><table class="table"><thead><tr><th>Автомобил</th><th>Цена</th><th>Пробег</th><th>Статус</th><th></th></tr></thead><tbody>' +
      list.map(function (v) {
        var t = thumb(v);
        return '<tr>' +
          '<td><a href="#edit=' + attr(v.id) + '" class="car-cell" data-edit="' + attr(v.id) + '">' +
            (t ? '<img class="car-thumb" src="' + attr(t) + '" alt="" loading="lazy">' : '<span class="car-thumb car-thumb--empty">NO IMG</span>') +
            '<span class="car-name"><strong>' + esc(v.full_name || (v.make + " " + v.model)) + '</strong><span>' + esc(v.ref || v.slug || "") + '</span></span></a></td>' +
          '<td>' + esc(money(v.price)) + '</td><td>' + esc(km(v.mileage)) + '</td>' +
          '<td><span class="pill ' + (v.published ? "pill--live" : "pill--draft") + '">' + (v.published ? "Публикуван" : "Чернова") + '</span></td>' +
          '<td><div class="row-actions"><button type="button" data-quick-publish="' + attr(v.id) + '" data-value="' + (v.published ? "0" : "1") + '">' + (v.published ? "Скрий" : "Публикувай") + '</button><button type="button" data-edit="' + attr(v.id) + '">Редакция</button></div></td></tr>';
      }).join("") + '</tbody></table></div>';
  }

  function cars() {
    navOn("cars");
    view.innerHTML =
      '<div class="view-head"><div class="view-title"><h1>Автомобили</h1><p>' + state.vehicles.length + ' записа</p></div><div class="actions"><button class="primary" data-go="new">+ Добави автомобил</button></div></div>' +
      bootstrapBanner() +
      '<section class="panel"><div class="panel-head"><h2>Всички</h2><input id="car-search" type="search" placeholder="Търси марка, модел, реф…" autocomplete="off"></div><div id="car-table">' +
      (state.vehicles.length ? table(state.vehicles) : '<div class="empty"><strong>Няма автомобили</strong></div>') + '</div></section>';
    bindCommon();
    var input = D.getElementById("car-search");
    if (input) input.addEventListener("input", function () {
      var q = input.value.trim().toLowerCase();
      var filtered = state.vehicles.filter(function (v) {
        return [v.make, v.model, v.full_name, v.ref, v.slug].join(" ").toLowerCase().indexOf(q) >= 0;
      });
      D.getElementById("car-table").innerHTML = filtered.length ? table(filtered) : '<div class="empty"><strong>Няма резултати</strong></div>';
      bindTable();
    });
    var boot = D.getElementById("bootstrap");
    if (boot) boot.addEventListener("click", importLegacy);
  }

  function importLegacy() {
    var btn = D.getElementById("bootstrap");
    if (!window.AH_VEHICLES || !window.AH_VEHICLES.length || !btn) return;
    btn.disabled = true; btn.textContent = "Импортиране…";
    api("/api/admin/vehicles?action=bootstrap", { method: "POST", body: { vehicles: window.AH_VEHICLES } })
      .then(function (d) { toast("Импортирани: " + d.imported); return loadVehicles(); })
      .catch(function (e) { toast(e.message, true); btn.disabled = false; btn.textContent = "Импортирай"; });
  }

  function blankVehicle() {
    return {
      id: "", slug: "", ref: "", make: "", model: "", full_name: "", body_type: "",
      colour: "", transmission: "auto", fuel: "petrol", mileage: null,
      first_registration_year: null, first_registration_month: null, unregistered: false,
      horsepower: null, price: null, chapter: "saloon", tags: [], notes: [],
      description_bg: "", description_en: "", equipment_bg: [], equipment_en: [], images: [],
      source_url: "", published: false
    };
  }

  function option(value, label, current) {
    return '<option value="' + attr(value) + '"' + (String(current || "") === String(value) ? " selected" : "") + '>' + esc(label) + '</option>';
  }

  function field(label, name, value, type, extra) {
    type = type || "text";
    return '<label class="field"><span>' + esc(label) + '</span><input name="' + attr(name) + '" type="' + attr(type) + '" value="' + attr(value == null ? "" : value) + '" ' + (extra || "") + '></label>';
  }

  function editor(v, isNew) {
    state.current = JSON.parse(JSON.stringify(v || blankVehicle()));
    state.dirty = false;
    navOn(isNew ? "new" : "");
    var title = isNew ? "Нов автомобил" : (state.current.full_name || state.current.make + " " + state.current.model);
    var imgCount = (state.current.images || []).length;
    view.innerHTML =
      '<div class="view-head"><div class="view-title"><h1>' + esc(title) + '</h1><p>' + (isNew ? "Нов запис" : esc(state.current.ref || state.current.slug)) + '</p></div><div class="actions"><button class="secondary" data-go="cars">Назад</button><button class="primary" id="save-top">Запиши</button></div></div>' +
      '<form id="car-form" class="editor" novalidate>' +
        '<div class="editor-main">' +
          '<section class="card"><h2>Автомобил</h2><div class="field-grid">' +
            field("Марка", "make", state.current.make, "text", "required maxlength=120") +
            field("Модел", "model", state.current.model, "text", "required maxlength=220") +
            field("Пълно име", "full_name", state.current.full_name, "text", "maxlength=320") +
            field("Slug", "slug", state.current.slug, "text", "maxlength=180") +
            field("Референция", "ref", state.current.ref, "text", "maxlength=80") +
            '<label class="field"><span>Тип купе</span><select name="body_type">' +
              option("", "—", state.current.body_type) + option("suv", "SUV", state.current.body_type) + option("passenger", "Лек автомобил", state.current.body_type) + option("sedan", "Седан", state.current.body_type) + option("wagon", "Комби", state.current.body_type) + option("coupe", "Купе", state.current.body_type) + option("cabrio", "Кабрио", state.current.body_type) + option("van", "Ван", state.current.body_type) + option("pickup", "Пикап", state.current.body_type) + '</select></label>' +
          '</div></section>' +
          '<section class="card"><h2>Спецификация</h2><div class="field-grid field-grid--3">' +
            '<label class="field"><span>Гориво</span><select name="fuel">' + option("petrol", "Бензин", state.current.fuel) + option("diesel", "Дизел", state.current.fuel) + option("hybrid", "Хибрид", state.current.fuel) + option("phev", "Plug-in хибрид", state.current.fuel) + option("ev", "Електрически", state.current.fuel) + '</select></label>' +
            '<label class="field"><span>Трансмисия</span><select name="transmission">' + option("auto", "Автоматична", state.current.transmission) + option("manual", "Ръчна", state.current.transmission) + '</select></label>' +
            field("Цвят", "colour", state.current.colour, "text", "maxlength=120") +
            field("Пробег (км)", "mileage", num(state.current.mileage), "number", "min=0 step=1") +
            field("Мощност (к.с.)", "horsepower", num(state.current.horsepower), "number", "min=0 step=1") +
            field("Цена (€)", "price", num(state.current.price), "number", "min=0 step=1") +
            field("Първа регистрация — година", "first_registration_year", num(state.current.first_registration_year), "number", "min=1900 max=2100 step=1") +
            field("Месец", "first_registration_month", num(state.current.first_registration_month), "number", "min=1 max=12 step=1") +
            '<label class="field"><span>Регистрация</span><span class="check"><input type="checkbox" name="unregistered"' + (state.current.unregistered ? " checked" : "") + '> Без първа регистрация</span></label>' +
            '<label class="field"><span>Раздел</span><select name="chapter">' + option("saloon", "Селекция", state.current.chapter) + option("chauffeur", "Представителен", state.current.chapter) + option("performance", "Performance", state.current.chapter) + option("utility", "Терен", state.current.chapter) + option("electrified", "Електрифицирани", state.current.chapter) + option("classic", "Класика", state.current.chapter) + '</select></label>' +
            field("Тагове", "tags", (state.current.tags || []).join(", "), "text", "placeholder='напр. delivery, suv'") +
            field("Бележки", "notes", (state.current.notes || []).join(", "), "text", "placeholder='напр. Възможен лизинг!'") +
          '</div></section>' +
          '<section class="card"><h2>Снимки <span class="muted small" id="image-count">' + imgCount + '</span></h2>' +
            '<div class="dropzone" id="dropzone"><input id="image-input" type="file" accept="image/*" multiple><strong>Пуснете снимките тук</strong><span>iPhone / камера · размерът и ориентацията се обработват автоматично</span><button type="button" class="secondary" id="choose-images">Избери снимки</button><div class="upload-status" id="upload-status"></div></div>' +
            '<div class="image-grid" id="image-list"></div>' +
          '</section>' +
          '<section class="card"><h2>Описание</h2><div class="processor">' +
            '<div class="processor-top"><div class="field"><span>Поставете оригиналния текст</span><textarea id="source-text" placeholder="Paste long equipment / description…"></textarea></div><div class="processor-actions"><button type="button" class="primary" id="process-description">Обработи</button></div></div>' +
            '<div class="processor-note" id="processor-note">Paste → process → review → save</div>' +
            '<div class="review-grid"><label class="review-box field"><span>Описание BG</span><textarea id="desc-bg">' + esc(state.current.description_bg || "") + '</textarea></label><label class="review-box field"><span>Description EN</span><textarea id="desc-en">' + esc(state.current.description_en || "") + '</textarea></label></div>' +
            '<div class="review-grid review-equipment"><label class="review-box field"><span>Оборудване BG · 1 ред = 1 елемент</span><textarea id="equipment-bg">' + esc(lines(state.current.equipment_bg)) + '</textarea></label><label class="review-box field"><span>Equipment EN · same order</span><textarea id="equipment-en">' + esc(lines(state.current.equipment_en)) + '</textarea></label></div>' +
            '<div id="review-notes"></div>' +
          '</div></section>' +
          '<section class="card"><h2>Източник</h2><div class="field-grid">' + field("Оригинален URL", "source_url", state.current.source_url, "url", "maxlength=1200") + '</div></section>' +
        '</div>' +
        '<aside class="editor-side">' +
          '<section class="card save-card"><div class="sticky-save"><button type="button" class="primary" id="save-side">Запиши</button>' + (!isNew ? '<button type="button" class="danger" id="delete-car">Изтрий</button>' : '') + '</div><div class="side-rule"></div><div class="status-switch"><button type="button" id="status-draft"' + (!state.current.published ? ' class="is-on"' : '') + '>Чернова</button><button type="button" id="status-live"' + (state.current.published ? ' class="is-on"' : '') + '>Публикуван</button></div><div class="side-rule"></div><div class="save-state is-saved" id="save-state">Записано</div></section>' +
          '<section class="card"><h3>Публична страница</h3><div class="side-list"><span class="small muted">Промените се четат от структурирания запис. Ако backend-ът е недостъпен, сайтът пази static fallback.</span>' + (!isNew && state.current.slug ? '<a class="secondary" target="_blank" rel="noopener" href="/vehicle.html?id=' + attr(state.current.slug) + '">Отвори автомобила</a>' : '') + '</div></section>' +
        '</aside>' +
      '</form>';

    renderImages();
    bindEditor(isNew);
    if (!isNew && !(state.current.equipment_bg || []).length) loadLegacyEquipment(state.current.slug);
  }

  function collectForm() {
    var f = D.getElementById("car-form");
    if (!f) return null;
    var make = f.elements.make.value.trim(), model = f.elements.model.value.trim();
    var slug = f.elements.slug.value.trim() || slugify(make + " " + model);
    var full = f.elements.full_name.value.trim() || (make + " " + model).trim();
    return {
      slug: slug,
      ref: f.elements.ref.value.trim(),
      make: make,
      model: model,
      full_name: full,
      body_type: f.elements.body_type.value,
      colour: f.elements.colour.value.trim(),
      transmission: f.elements.transmission.value,
      fuel: f.elements.fuel.value,
      mileage: f.elements.mileage.value === "" ? null : Number(f.elements.mileage.value),
      first_registration_year: f.elements.first_registration_year.value === "" ? null : Number(f.elements.first_registration_year.value),
      first_registration_month: f.elements.first_registration_month.value === "" ? null : Number(f.elements.first_registration_month.value),
      unregistered: !!f.elements.unregistered.checked,
      horsepower: f.elements.horsepower.value === "" ? null : Number(f.elements.horsepower.value),
      price: f.elements.price.value === "" ? null : Number(f.elements.price.value),
      chapter: f.elements.chapter.value,
      tags: splitTags(f.elements.tags.value),
      notes: splitTags(f.elements.notes.value),
      description_bg: D.getElementById("desc-bg").value.trim(),
      description_en: D.getElementById("desc-en").value.trim(),
      equipment_bg: splitLines(D.getElementById("equipment-bg").value),
      equipment_en: splitLines(D.getElementById("equipment-en").value),
      images: state.current.images || [],
      source_url: f.elements.source_url.value.trim(),
      published: !!state.current.published
    };
  }

  function validateCar(data) {
    var form = D.getElementById("car-form");
    Array.prototype.forEach.call(form.querySelectorAll("[aria-invalid]"), function (el) { el.removeAttribute("aria-invalid"); });
    var bad = [];
    if (!data.make) bad.push(form.elements.make);
    if (!data.model) bad.push(form.elements.model);
    if (data.first_registration_month != null && (data.first_registration_month < 1 || data.first_registration_month > 12)) bad.push(form.elements.first_registration_month);
    bad.forEach(function (el) { el.setAttribute("aria-invalid", "true"); });
    if (bad.length) { bad[0].focus(); toast("Проверете задължителните полета.", true); return false; }
    if (data.equipment_bg.length && data.equipment_en.length && data.equipment_bg.length !== data.equipment_en.length) {
      toast("BG и EN equipment списъците трябва да са с еднакъв брой редове.", true); return false;
    }
    return true;
  }

  function saveCar() {
    var data = collectForm();
    if (!data || !validateCar(data)) return;
    var currentId = state.current.id;
    var buttons = [D.getElementById("save-top"), D.getElementById("save-side")].filter(Boolean);
    buttons.forEach(function (b) { b.disabled = true; b.textContent = "Записване…"; });
    var request = currentId
      ? api("/api/admin/vehicles?id=" + encodeURIComponent(currentId), { method: "PATCH", body: data })
      : api("/api/admin/vehicles", { method: "POST", body: data });
    request.then(function (d) {
      state.current = d.vehicle;
      state.dirty = false;
      toast("Записано");
      return api("/api/admin/vehicles");
    }).then(function (d) {
      state.vehicles = d.vehicles || [];
      location.hash = "edit=" + encodeURIComponent(state.current.id);
      editor(state.current, false);
    }).catch(function (e) {
      toast(e.message, true);
      var st = D.getElementById("save-state");
      if (st) { st.className = "save-state is-error"; st.textContent = "Грешка при запис"; }
      buttons.forEach(function (b) { b.disabled = false; b.textContent = "Запиши"; });
    });
  }

  function deleteCar() {
    if (!state.current.id || !confirm("Сигурни ли сте, че искате да изтриете този автомобил?")) return;
    api("/api/admin/vehicles?id=" + encodeURIComponent(state.current.id), { method: "DELETE" })
      .then(function () { toast("Автомобилът е изтрит"); state.dirty = false; return loadVehicles(); })
      .then(function () { go("cars"); })
      .catch(function (e) { toast(e.message, true); });
  }

  function status(on) {
    state.current.published = !!on;
    D.getElementById("status-live").classList.toggle("is-on", !!on);
    D.getElementById("status-draft").classList.toggle("is-on", !on);
    setDirty(true);
  }

  function renderImages() {
    var list = D.getElementById("image-list");
    if (!list || !state.current) return;
    var images = state.current.images || [];
    var count = D.getElementById("image-count");
    if (count) count.textContent = images.length;
    list.innerHTML = images.map(function (img, i) {
      var variants = img.variants || {}, src = variants.webp400 || variants.jpg400 || img.original || "";
      return '<article class="image-card" draggable="true" data-image-index="' + i + '">' +
        '<img src="' + attr(src) + '" alt="Снимка ' + (i + 1) + '" loading="lazy"><div class="image-meta"><span>' + (i === 0 ? "Главна" : (i + 1)) + '</span><div class="image-actions"><button type="button" title="Наляво" data-img-left="' + i + '">←</button><button type="button" title="Надясно" data-img-right="' + i + '">→</button><button type="button" title="Премахни" data-img-remove="' + i + '">×</button></div></div></article>';
    }).join("");
    bindImages();
  }

  function moveImage(from, to) {
    var a = state.current.images || [];
    if (from < 0 || to < 0 || from >= a.length || to >= a.length || from === to) return;
    var item = a.splice(from, 1)[0]; a.splice(to, 0, item);
    a.forEach(function (img, i) { img.position = i; });
    setDirty(true); renderImages();
  }

  function removeImage(i) {
    var img = (state.current.images || [])[i];
    if (!img || !confirm("Премахване на тази снимка?")) return;
    state.current.images.splice(i, 1);
    state.current.images.forEach(function (x, n) { x.position = n; });
    setDirty(true); renderImages();
    if (img.public_id && !img.legacy) {
      api("/api/admin/images?action=delete", { method: "POST", body: { public_id: img.public_id } }).catch(function () {
        toast("Снимката е махната от автомобила, но Cloudinary delete не успя.", true);
      });
    }
  }

  function bindImages() {
    Array.prototype.forEach.call(D.querySelectorAll("[data-img-left]"), function (b) { b.onclick = function () { var i = Number(b.getAttribute("data-img-left")); moveImage(i, i - 1); }; });
    Array.prototype.forEach.call(D.querySelectorAll("[data-img-right]"), function (b) { b.onclick = function () { var i = Number(b.getAttribute("data-img-right")); moveImage(i, i + 1); }; });
    Array.prototype.forEach.call(D.querySelectorAll("[data-img-remove]"), function (b) { b.onclick = function () { removeImage(Number(b.getAttribute("data-img-remove"))); }; });
    Array.prototype.forEach.call(D.querySelectorAll(".image-card"), function (card) {
      card.addEventListener("dragstart", function () { dragIndex = Number(card.getAttribute("data-image-index")); card.classList.add("is-dragging"); });
      card.addEventListener("dragend", function () { dragIndex = null; card.classList.remove("is-dragging"); });
      card.addEventListener("dragover", function (e) { e.preventDefault(); });
      card.addEventListener("drop", function (e) { e.preventDefault(); if (dragIndex != null) moveImage(dragIndex, Number(card.getAttribute("data-image-index"))); });
    });
  }

  function uploadFiles(files) {
    files = Array.prototype.slice.call(files || []).filter(function (f) { return /^image\//.test(f.type); });
    if (!files.length || state.uploadBusy) return;
    if (files.some(function (f) { return f.size > 45 * 1024 * 1024; })) { toast("Снимка над 45 MB не се поддържа.", true); return; }
    state.uploadBusy = true;
    var statusEl = D.getElementById("upload-status"), done = 0;
    function label() { if (statusEl) statusEl.textContent = "Качване " + done + " / " + files.length; }
    label();
    api("/api/admin/images?action=sign", { method: "POST", body: {} }).then(function (sign) {
      return files.reduce(function (chain, file) {
        return chain.then(function () {
          var fd = new FormData();
          fd.append("file", file); fd.append("api_key", sign.api_key); fd.append("timestamp", sign.timestamp);
          fd.append("signature", sign.signature); fd.append("folder", sign.folder); fd.append("eager", sign.eager);
          return fetch(sign.upload_url, { method: "POST", body: fd }).then(function (r) {
            return r.json().then(function (d) { if (!r.ok) throw new Error(d.error && d.error.message || "Upload failed"); return d; });
          }).then(function (uploaded) {
            return api("/api/admin/images?action=complete", { method: "POST", body: uploaded });
          }).then(function (completed) {
            var img = completed.image; img.position = state.current.images.length; state.current.images.push(img); done++; label(); setDirty(true); renderImages();
          });
        });
      }, Promise.resolve());
    }).then(function () {
      if (statusEl) statusEl.textContent = files.length + " снимки качени";
      toast("Снимките са готови");
    }).catch(function (e) {
      if (statusEl) statusEl.textContent = "Грешка при качване";
      toast(e.message, true);
    }).then(function () { state.uploadBusy = false; });
  }

  function processDescription() {
    var source = D.getElementById("source-text"), btn = D.getElementById("process-description"), note = D.getElementById("processor-note");
    if (!source || source.value.trim().length < 10) { toast("Поставете текст за обработка.", true); return; }
    var vehicle = collectForm();
    btn.disabled = true; btn.textContent = "Обработване…"; note.textContent = "Почистване и превод…"; note.classList.remove("is-error");
    api("/api/admin/description", { method: "POST", body: { source: source.value, vehicle: vehicle } }).then(function (d) {
      var r = d.result || {};
      D.getElementById("desc-bg").value = r.description_bg || "";
      D.getElementById("desc-en").value = r.description_en || "";
      D.getElementById("equipment-bg").value = lines(r.equipment_bg);
      D.getElementById("equipment-en").value = lines(r.equipment_en);
      var notes = r.review_notes || [];
      D.getElementById("review-notes").innerHTML = notes.length ? '<div class="review-alert"><strong>За проверка:</strong><br>' + notes.map(esc).join("<br>") + '</div>' : "";
      note.textContent = "Готово · прегледайте и запишете";
      setDirty(true); toast("Описанието е обработено");
    }).catch(function (e) {
      note.textContent = e.message; note.classList.add("is-error"); toast(e.message, true);
    }).then(function () { btn.disabled = false; btn.textContent = "Обработи"; });
  }

  function loadLegacyEquipment(slug) {
    if (!slug) return;
    fetch("/data/eq/" + encodeURIComponent(slug) + ".js").then(function (r) { if (!r.ok) throw new Error(); return r.text(); }).then(function (txt) {
      var m = txt.match(/window\.AH_EQ\s*=\s*(\{[\s\S]*\})\s*;?\s*$/);
      if (!m) return;
      var data = JSON.parse(m[1]);
      if (!state.current || state.current.slug !== slug) return;
      if (!(state.current.equipment_bg || []).length && Array.isArray(data.e)) {
        state.current.equipment_bg = data.e.slice(); state.current.equipment_en = Array.isArray(data.en) ? data.en.slice() : [];
        var bg = D.getElementById("equipment-bg"), en = D.getElementById("equipment-en");
        if (bg && !bg.value.trim()) bg.value = lines(state.current.equipment_bg);
        if (en && !en.value.trim()) en.value = lines(state.current.equipment_en);
      }
    }).catch(function () {});
  }

  function bindEditor() {
    var form = D.getElementById("car-form");
    form.addEventListener("input", function (e) {
      if (e.target.name === "make" || e.target.name === "model") {
        if (!form.elements.slug.value.trim()) form.elements.slug.value = slugify(form.elements.make.value + " " + form.elements.model.value);
        if (!form.elements.full_name.value.trim()) form.elements.full_name.value = (form.elements.make.value + " " + form.elements.model.value).trim();
      }
      setDirty(true);
    });
    D.getElementById("save-top").onclick = saveCar;
    D.getElementById("save-side").onclick = saveCar;
    if (D.getElementById("delete-car")) D.getElementById("delete-car").onclick = deleteCar;
    D.getElementById("status-draft").onclick = function () { status(false); };
    D.getElementById("status-live").onclick = function () { status(true); };
    D.getElementById("process-description").onclick = processDescription;
    D.getElementById("choose-images").onclick = function () { D.getElementById("image-input").click(); };
    D.getElementById("image-input").onchange = function (e) { uploadFiles(e.target.files); e.target.value = ""; };
    var dz = D.getElementById("dropzone");
    ["dragenter", "dragover"].forEach(function (n) { dz.addEventListener(n, function (e) { e.preventDefault(); dz.classList.add("is-drag"); }); });
    ["dragleave", "drop"].forEach(function (n) { dz.addEventListener(n, function (e) { e.preventDefault(); dz.classList.remove("is-drag"); }); });
    dz.addEventListener("drop", function (e) { uploadFiles(e.dataTransfer.files); });
    bindCommon();
  }

  function bindTable() {
    Array.prototype.forEach.call(D.querySelectorAll("[data-edit]"), function (el) {
      el.onclick = function (e) { e.preventDefault(); go("edit=" + el.getAttribute("data-edit")); };
    });
    Array.prototype.forEach.call(D.querySelectorAll("[data-quick-publish]"), function (b) {
      b.onclick = function () {
        var id = b.getAttribute("data-quick-publish"), v = state.vehicles.filter(function (x) { return x.id === id; })[0];
        if (!v) return;
        var next = JSON.parse(JSON.stringify(v)); next.published = b.getAttribute("data-value") === "1";
        b.disabled = true;
        api("/api/admin/vehicles?id=" + encodeURIComponent(id), { method: "PATCH", body: next }).then(function () {
          toast(next.published ? "Публикуван" : "Скрит"); return loadVehicles();
        }).catch(function (e) { toast(e.message, true); b.disabled = false; });
      };
    });
  }

  function bindCommon() {
    Array.prototype.forEach.call(D.querySelectorAll("[data-go]"), function (b) { b.onclick = function () { go(b.getAttribute("data-go")); }; });
    bindTable();
  }

  function renderRoute() {
    var route = routeFromHash(); state.route = route;
    if (route === "dashboard") return dashboard();
    if (route === "cars") return cars();
    if (route === "new") return editor(blankVehicle(), true);
    if (route.indexOf("edit=") === 0) {
      var id = decodeURIComponent(route.slice(5));
      var v = state.vehicles.filter(function (x) { return x.id === id; })[0];
      if (v) return editor(v, false);
      view.innerHTML = '<div class="empty"><strong>Автомобилът не е намерен</strong></div>';
      return;
    }
    go("dashboard");
  }

  Array.prototype.forEach.call(D.querySelectorAll("[data-route]"), function (b) { b.onclick = function () { go(b.getAttribute("data-route")); }; });
  D.getElementById("logout").onclick = function () {
    api("/api/admin/auth?action=logout", { method: "POST", body: {} }).then(function () { location.replace("/admin/login.html"); });
  };
  var menu = D.getElementById("mobile-menu");
  if (menu) menu.onclick = function () { var on = !D.body.classList.contains("menu-open"); D.body.classList.toggle("menu-open", on); menu.setAttribute("aria-expanded", on ? "true" : "false"); };
  addEventListener("hashchange", function () { if (!state.dirty) renderRoute(); });
  addEventListener("beforeunload", function (e) { if (state.dirty) { e.preventDefault(); e.returnValue = ""; } });

  state.route = routeFromHash();
  loadVehicles();
})();
