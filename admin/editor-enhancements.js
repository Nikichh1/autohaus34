(function () {
  "use strict";

  var t = window.AH_ADMIN.t;
  var D = document;
  var view = D.getElementById("admin-view");
  if (!view) return;

  var style = D.createElement("style");
  style.textContent =
    ".ah-quick-import{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;padding:14px;border:1px solid #ddd;background:#f7f7f7;margin-bottom:18px}" +
    ".ah-quick-import input{min-width:0;border:1px solid #d4d4d4;background:#fff;padding:11px 12px}" +
    ".ah-quick-import button{white-space:nowrap}" +
    "@media(max-width:600px){.ah-quick-import{grid-template-columns:1fr}.ah-quick-import button{width:100%}}";
  D.head.appendChild(style);

  function enhance() {
    var form = D.getElementById("car-form");
    if (!form || form.dataset.enhanced) return;
    form.dataset.enhanced = "1";

    var heading = D.querySelector(".editor-heading");
    var quick = D.createElement("div");
    quick.className = "ah-quick-import";
    quick.innerHTML = '<input id="ah-quick-source" type="text" autocomplete="off" placeholder="Постави AutoHaus URL или slug…"><button type="button" class="primary" id="ah-quick-import-btn">Импортирай от AutoHaus</button>';

    if (heading) heading.insertAdjacentElement("afterend", quick);
    else form.insertAdjacentElement("beforebegin", quick);

    var input = quick.querySelector("input");
    var button = quick.querySelector("button");
    input.placeholder = t("AutoHaus URL или slug", "AutoHaus URL or slug");
    input.setAttribute("aria-label", input.placeholder);
    button.textContent = t("Импортирай от AutoHaus", "Import from AutoHaus");

    function slug(value) {
      value = String(value || "").trim();
      var match = value.match(/\/car\/([a-z0-9-]+)\/?(?:[?#].*)?$/i);
      if (match) return match[1].toLowerCase();
      return value.replace(/^\//, "").replace(/\/$/, "").toLowerCase();
    }

    if (!window.AH_ADMIN.canManage) quick.hidden = true;
    button.onclick = async function () {
      if (!window.AH_ADMIN.canLeave()) return;
      var value = slug(input.value);
      if (!/^[a-z0-9-]{1,180}$/.test(value)) {
        alert("Постави валиден AutoHaus URL или slug.");
        input.focus();
        return;
      }

      button.disabled = true;
      button.textContent = t("Импортиране…", "Importing…");
      try {
        var response = await fetch("/api/admin/sync?action=vehicle", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ slug: value, sort_order: 0 })
        });
        var data = await response.json().catch(function () { return {}; });
        if (!response.ok) throw new Error(data.error || "Импортът не успя.");
        window.AH_ADMIN.reloadVehicle(data.id);
      } catch (error) {
        alert(error.message);
        button.disabled = false;
        button.textContent = t("Импортирай от AutoHaus", "Import from AutoHaus");
      }
    };
  }

  window.AH_ADMIN.enhanceEditor = enhance;
  enhance();
})();
