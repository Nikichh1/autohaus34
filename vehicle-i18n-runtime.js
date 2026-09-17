/* Dynamic translations that come from vehicle data rather than static site copy. */
(function () {
  "use strict";

  var BODY = {
    suv: ["SUV", "SUV"],
    sedan: ["Седан", "Sedan"],
    wagon: ["Комби", "Estate"],
    hatchback: ["Хечбек", "Hatchback"],
    coupe: ["Купе", "Coupe"],
    cabrio: ["Кабриолет", "Convertible"],
    van: ["Ван", "Van"],
    pickup: ["Пикап", "Pickup"],
    passenger: ["Лек автомобил", "Passenger car"],
    other: ["Друг", "Other"]
  };

  function escAttr(value) { return String(value == null ? "" : value); }
  function cleanNote(value) { return String(value || "").replace(/!+$/, "").trim(); }

  function bilingual(el, bg, en) {
    if (!el || !en) return;
    el.setAttribute("data-ah-bg", escAttr(bg));
    el.setAttribute("data-ah-en", escAttr(en));
    var language = window.AHLang && window.AHLang.get ? window.AHLang.get() : document.documentElement.lang;
    el.textContent = language === "en" ? en : bg;
  }

  function currentVehicle() {
    var list = window.AH_VEHICLES || [];
    return list.length === 1 ? list[0] : null;
  }

  function apply() {
    var vehicle = currentVehicle();
    if (!vehicle || !document.getElementById("vd")) return;

    var bodyPair = BODY[vehicle.body_type];
    if (bodyPair) {
      Array.prototype.forEach.call(document.querySelectorAll(".dspec > div"), function (row) {
        var dt = row.querySelector("dt"), dd = row.querySelector("dd");
        if (dt && dd && dt.textContent.trim() === "Каросерия") bilingual(dd, bodyPair[0], bodyPair[1]);
      });
    }

    var bgNotes = Array.isArray(vehicle.notes) ? vehicle.notes : [];
    var enNotes = Array.isArray(vehicle.notes_en) ? vehicle.notes_en : [];
    if (enNotes.length === bgNotes.length && bgNotes.length) {
      var pairs = bgNotes.map(function (bg, index) {
        return { bg: cleanNote(bg), en: cleanNote(enNotes[index]) };
      }).filter(function (pair) { return pair.bg && !/ДДС/i.test(pair.bg); });
      var noteEls = document.querySelectorAll(".dnotes li > span");
      Array.prototype.forEach.call(noteEls, function (el, index) {
        var pair = pairs[index];
        if (pair && pair.en) bilingual(el, pair.bg, pair.en);
      });
    }
  }

  var ready = window.AH_INVENTORY_READY || Promise.resolve();
  ready.then(function () {
    requestAnimationFrame(function () {
      apply();
      setTimeout(apply, 0);
    });
  });
  window.addEventListener("ah:languagechange", apply);
})();
