/* Auto House ordered data/UI loader. The public URL stays no-cache in vercel.json. */
(function () {
  "use strict";
  function load(url, label) {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", url, false);
    try {
      xhr.send(null);
      if ((xhr.status >= 200 && xhr.status < 300) || xhr.status === 0) {
        (0, eval)(xhr.responseText + "\n//# sourceURL=" + label);
        return;
      }
      throw new Error("HTTP " + xhr.status);
    } catch (err) {
      console.error("Auto House module failed to load: " + label, err);
      throw err;
    }
  }
  load("data/vehicles.phase1.js?v=20260909b", "data/vehicles.phase1.js");
  load("data/phase2.js?v=20260909b", "data/phase2.js");
  load("data/phase3.js?v=20260909-admin1", "data/phase3.js");
})();
