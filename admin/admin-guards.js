(function () {
  "use strict";
  var D = document;

  function slugify(value) {
    return String(value || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 180);
  }
  function countLines(value) {
    return String(value || "").split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean).length;
  }

  D.addEventListener("input", function (e) {
    var form = e.target && e.target.closest ? e.target.closest("#car-form") : null;
    if (!form || location.hash !== "#new") return;
    if (e.target.name !== "make" && e.target.name !== "model") return;
    var make = form.elements.make.value.trim(), model = form.elements.model.value.trim();
    form.elements.slug.value = slugify(make + " " + model);
    form.elements.full_name.value = (make + " " + model).trim();
  }, true);

  D.addEventListener("click", function (e) {
    var button = e.target && e.target.closest ? e.target.closest("#save-top,#save-side") : null;
    if (!button) return;
    var bg = D.getElementById("equipment-bg"), en = D.getElementById("equipment-en");
    if (!bg || !en) return;
    var bgN = countLines(bg.value), enN = countLines(en.value);
    if (bgN === enN) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    var notes = D.getElementById("review-notes");
    if (notes) notes.innerHTML = '<div class="review-alert"><strong>Проверете превода:</strong><br>BG equipment има ' + bgN + ' реда, EN има ' + enN + '. Двата списъка трябва да са 1:1.</div>';
    en.focus();
  }, true);
})();
