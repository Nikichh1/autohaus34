/* Live inventory sync controller. Runs in small parallel batches so Vercel Free functions stay short. */
(function () {
  "use strict";

  var button = document.getElementById("sync-autohaus");
  if (!button) return;
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
    if (running) return;
    running = true;
    button.disabled = true;
    button.textContent = "Проверявам AutoHaus…";

    try {
      var discovered = await request("/api/admin/sync?action=discover");
      var slugs = discovered.slugs || [];
      if (!slugs.length) throw new Error("Оригиналният сайт не върна автомобили.");

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
          button.textContent = "Синхронизирам " + done + "/" + slugs.length;
        }
      }

      await Promise.all([worker(), worker(), worker()]);
      if (failures.length) {
        throw new Error("Не са синхронизирани " + failures.length + " обяви. Нищо не е изтривано. " + failures.slice(0, 3).join("; "));
      }

      button.textContent = "Премахвам неактуалните…";
      var final = await request("/api/admin/sync?action=finalize", {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body:"{}"
      });

      button.textContent = "Готово · " + final.total + " коли";
      toast("AutoHaus е синхронизиран: " + final.total + " активни, " + created + " нови, " + final.removed + " премахнати.");
      setTimeout(function () { location.reload(); }, 1200);
    } catch (err) {
      button.textContent = "Опитай отново";
      toast(err && err.message ? err.message : "Синхронизацията не успя.", true);
      button.disabled = false;
      running = false;
      return;
    }

    setTimeout(function () {
      button.textContent = original;
      button.disabled = false;
      running = false;
    }, 4000);
  }

  button.addEventListener("click", runSync);

  /* Older admin builds show an empty-database banner for the retired static
     87-car import. Intercept it and route it to the same live source instead. */
  document.addEventListener("click", function (event) {
    var boot = event.target && event.target.closest ? event.target.closest("#bootstrap") : null;
    if (!boot) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    runSync();
  }, true);

  function relabelLegacyBanner() {
    var boot = document.getElementById("bootstrap");
    if (!boot) return;
    boot.textContent = "Синхронизирай от AutoHaus";
    var box = boot.closest(".bootstrap");
    if (box) {
      var strong = box.querySelector("strong");
      if (strong) strong.textContent = "Зареди актуалните автомобили от AutoHaus";
    }
  }
  relabelLegacyBanner();
  if (typeof MutationObserver === "function") {
    new MutationObserver(relabelLegacyBanner).observe(document.getElementById("admin-view") || document.body, { childList:true, subtree:true });
  }
})();
