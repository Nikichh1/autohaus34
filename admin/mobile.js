/* Auto House admin mobile quick actions. */
(function () {
  "use strict";
  var D = document;
  var dock;
  var timer;

  function isMobile() { return matchMedia("(max-width:720px)").matches; }

  function click(selector) {
    var el = D.querySelector(selector);
    if (el) el.click();
  }

  function scrollTo(selector) {
    var el = D.querySelector(selector);
    if (!el) return;
    var target = el.closest(".card") || el;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function button(label, action, cls) {
    var b = D.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.className = cls || "";
    b.addEventListener("click", action);
    return b;
  }

  function ensureDock() {
    if (!dock) {
      dock = D.createElement("nav");
      dock.className = "mobile-dock";
      dock.setAttribute("aria-label", "Бързи действия");
      D.body.appendChild(dock);
    }
    return dock;
  }

  function render() {
    if (!isMobile()) {
      if (dock) dock.innerHTML = "";
      return;
    }
    var target = ensureDock();
    target.innerHTML = "";

    var editor = D.getElementById("car-form");
    if (editor) {
      target.appendChild(button("← Коли", function () { click('[data-go="cars"]'); }));
      if (D.getElementById("image-input")) target.appendChild(button("Снимки", function () { scrollTo("#image-input"); }));
      if (D.getElementById("source-text")) target.appendChild(button("AI текст", function () { scrollTo("#source-text"); }));

      var live = D.getElementById("status-live");
      var draft = D.getElementById("status-draft");
      if (live && draft) {
        var published = live.classList.contains("is-on");
        target.appendChild(button(published ? "Публикуван" : "Чернова", function () {
          (published ? draft : live).click();
          setTimeout(render, 0);
        }, published ? "is-live" : ""));
      }

      target.appendChild(button("Запиши", function () { click("#save-top"); }, "is-primary"));
      return;
    }

    target.appendChild(button("Начало", function () { click('[data-route="dashboard"]'); }));
    target.appendChild(button("Коли", function () { click('[data-route="cars"]'); }));
    target.appendChild(button("+ Добави", function () { click('[data-route="new"]'); }, "is-primary"));
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(render, 20);
  }

  var view = D.getElementById("admin-view");
  if (view) new MutationObserver(schedule).observe(view, { childList: true, subtree: true });
  addEventListener("resize", schedule);
  addEventListener("hashchange", schedule);
  D.addEventListener("DOMContentLoaded", schedule);
  schedule();
})();
