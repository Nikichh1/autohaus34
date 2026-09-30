/* Factory images are recoverable without duplicating them in Storage. */
(function () {
  "use strict";
  var definitions = [
    ["hero-0", "AutoHaus — комплекс", "AutoHaus complex", "outside_autohaus", [768,1280,1920], 1280, 645, 320, "20% 50%"],
    ["hero-1", "Шоурум", "Showroom", "indoor_cars", [768,1280,1920], 1280, 934, 320],
    ["hero-2", "Автомивка", "Auto Spa", "autospa_night", [400,800,1080], 1080, 1080, 400, "40% 50%"],
    ["hero-3", "Сервиз", "Service", "outside-flags", [320,768,1280], 1280, 800, 320],
    ["hero-4", "Кафе бар", "Café bar", "coffee_bar-new", [320,768,1280], 1280, 1280, 320],
    ["wall-care", "Автомивка", "Auto Spa", "autohaus_autospa", [400,800,1080], 800, 1067, 400],
    ["wall-servis", "Сервиз", "Service", "wall-service", [400,800], 1024, 1536, 400],
    ["wall-lizing", "Лизинг", "Leasing", "wall-leasing", [400,800], 1024, 1536, 400],
    ["wall-zastrahovki", "Застраховки", "Insurance", "wall-insurance", [400,800], 1024, 1536, 400],
    ["wall-cafe", "Кафе бар", "Café bar", "coffee_bar-new", [320,768,1280], 800, 800, 320]
  ];
  window.AH_HOME_SLOTS = definitions.map(function (d) {
    var base = "/img/" + d[3] + "-", widths = d[4];
    return { slot:d[0], bg:d[1], en:d[2], width:d[5], height:d[6], position:d[8]||"50% 50%", background:base+d[7]+".jpg",
      src:base+widths[widths.length-1]+".jpg", preview:base+widths[0]+".jpg",
      jpg:widths.map(function(w){return base+w+".jpg "+w+"w";}).join(", "), webp:widths.map(function(w){return base+w+".webp "+w+"w";}).join(", ") };
  });
})();
