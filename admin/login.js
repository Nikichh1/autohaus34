(function () {
  "use strict";
  var lang = "bg", form = document.getElementById("login-form"), status = document.getElementById("login-status"), busy = false;
  try { lang = localStorage.getItem("ah-admin-language") === "en" ? "en" : "bg"; } catch (_) {}
  function t(bg, en) { return lang === "en" ? en : bg; }
  function translate() {
    document.documentElement.lang = lang; document.title = "AutoHaus Admin — " + t("Вход", "Sign in");
    document.querySelectorAll("[data-bg][data-en]").forEach(function (el) { el.textContent = el.dataset[lang]; });
    document.querySelectorAll("[data-language]").forEach(function (el) { el.setAttribute("aria-pressed", String(el.dataset.language === lang)); });
  }
  document.querySelectorAll("[data-language]").forEach(function (button) { button.onclick = function () {
    if (busy) return; lang = button.dataset.language;
    try { localStorage.setItem("ah-admin-language", lang); } catch (_) {} translate(); status.textContent = "";
  }; });
  translate();
  fetch("/api/admin/auth", { credentials: "same-origin", headers: { Accept: "application/json" } }).then(function (r) { if (r.ok) location.replace("/admin"); }).catch(function () {});
  form.onsubmit = async function (event) {
    event.preventDefault(); if (busy || !form.reportValidity()) return;
    var button = form.querySelector('[type="submit"]'); busy = true; button.disabled = true; button.textContent = t("Влизане…", "Signing in…"); status.textContent = "";
    try {
      var response = await fetch("/api/admin/auth?action=login", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ email: form.elements.email.value.trim(), password: form.elements.password.value }), signal: AbortSignal.timeout(20000) });
      var data = await response.json().catch(function () { return {}; });
      if (!response.ok) throw new Error(response.status === 503 ? t("Входът още не е конфигуриран. Свържете се с администратора.", "Sign-in has not been configured. Contact your administrator.") : response.status === 429 ? t("Твърде много опити. Опитайте по-късно.", "Too many attempts. Please try later.") : t("Проверете имейла и паролата и опитайте отново.", "Check your email and password and try again."));
      location.replace("/admin");
    } catch (error) { status.textContent = error.name === "TimeoutError" || error.name === "TypeError" ? t("Няма връзка. Опитайте отново.", "Connection unavailable. Try again.") : error.message; }
    finally { busy = false; button.disabled = false; translate(); }
  };
})();
