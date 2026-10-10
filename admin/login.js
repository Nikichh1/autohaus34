(function () {
  "use strict";
  var form = document.getElementById("login-form"), status = document.getElementById("login-status"), busy = false;
  fetch("/api/admin/auth", { credentials: "same-origin", headers: { Accept: "application/json" } }).then(function (r) { if (r.ok) location.replace("/admin"); }).catch(function () {});
  form.onsubmit = async function (event) {
    event.preventDefault(); if (busy || !form.reportValidity()) return;
    var button = form.querySelector('[type="submit"]'); busy = true; button.disabled = true; button.textContent = "Влизане…"; status.textContent = "";
    try {
      var response = await fetch("/api/admin/auth?action=login", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ email: form.elements.email.value.trim(), password: form.elements.password.value }), signal: AbortSignal.timeout(20000) });
      if (!response.ok) throw new Error(response.status === 503 ? "Входът още не е конфигуриран. Свържете се с администратора." : response.status === 429 ? "Твърде много опити. Опитайте по-късно." : "Проверете имейла и паролата и опитайте отново.");
      location.replace("/admin");
    } catch (error) { status.textContent = error.name === "TimeoutError" || error.name === "TypeError" ? "Няма връзка. Опитайте отново." : error.message; }
    finally { busy = false; button.disabled = false; button.textContent = "Вход"; }
  };
})();
