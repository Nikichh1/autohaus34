/* Live inventory sync controller. Runs in small parallel batches so Vercel Free functions stay short. */
(function () {
  "use strict";

  var button = document.getElementById("sync-autohaus");
  if (!button) return;
  var t=window.AH_ADMIN.t;
  var original = button.textContent;
  var running = false;

  function toast(message, error) {
    var el = document.getElementById("toast");
    if (!el) return;
    el.textContent = message;
    el.classList.toggle("is-error", !!error);
    el.classList.add("is-on");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(function () { el.classList.remove("is-on"); }, error ? 7000 : 4200);
  }

  async function request(url, options) {
    var response = await fetch(url, Object.assign({ credentials:"same-origin" }, options || {}));
    var data = await response.json().catch(function () { return {}; });
    if (!response.ok || !data.ok) throw new Error(data.error || "Sync request failed");
    return data;
  }

  async function runSync() {
    if (running || !window.AH_ADMIN.canManage || !window.AH_ADMIN.canLeave()) return;
    running = true; window.AH_ADMIN.setSyncBusy(true);
    button.disabled = true;
    button.textContent = t("Проверявам AutoHaus…","Checking AutoHaus…");

    try {
      var discovered = await request("/api/admin/sync?action=discover");
      var slugs = discovered.slugs || [];
      if (!slugs.length) throw new Error(t("Оригиналният сайт не върна автомобили.","The source returned no vehicles."));

      var next = 0, done = 0, created = 0, failures = [];
      async function worker() {
        while (true) {
          var index = next++;
          if (index >= slugs.length) return;
          var slug = slugs[index];
          try {
            var result = await request("/api/admin/sync?action=vehicle", {
              method:"POST",
              headers:{ "Content-Type":"application/json" },
              body:JSON.stringify({ slug:slug, sort_order:index + 1 })
            });
            if (result.created) created++;
          } catch (err) {
            failures.push(slug + ": " + (err && err.message ? err.message : "error"));
          }
          done++;
          button.textContent = t("Синхронизирам ","Syncing ") + done + "/" + slugs.length;
        }
      }

      await Promise.all([worker(), worker(), worker()]);
      if (failures.length) {
        throw new Error("Не са синхронизирани " + failures.length + " обяви. Нищо не е изтривано. " + failures.slice(0, 3).join("; "));
      }

      button.textContent = t("Скривам неактуалните…","Unpublishing departed vehicles…");
      var final = await request("/api/admin/sync?action=finalize", {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body:"{}"
      });

      button.textContent = "Готово · " + final.total + " коли";
      toast("AutoHaus е синхронизиран: " + final.total + " активни, " + created + " нови, " + final.removed + " премахнати.");
      setTimeout(function () { window.AH_ADMIN.setSyncBusy(false); window.AH_ADMIN.refresh(); }, 1200);
    } catch (err) {
      button.textContent = t("Опитай отново","Try again");
      toast(err && err.message ? err.message : t("Синхронизацията не успя.","Sync failed."), true);
      button.disabled = false;
      running = false; window.AH_ADMIN.setSyncBusy(false);
      return;
    }

    setTimeout(function () {
      button.textContent = original;
      button.disabled = false;
      running = false;
    }, 4000);
  }

  button.addEventListener("click", runSync);

})();
