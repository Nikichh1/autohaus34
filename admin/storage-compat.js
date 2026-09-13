/* Keeps the existing admin photo UI while routing signed uploads to Supabase Storage. */
(function () {
  "use strict";
  var nativeFetch = window.fetch.bind(window);
  var STORAGE_PREFIX = "https://ajoiqomflplhadyhxvfe.supabase.co/storage/v1/object/upload/sign/vehicle-images/";
  var PUBLIC_KEY = "sb_publishable_gBEUBrOjT_JsBRjAnGL9PQ_ra-1hY0g";

  window.fetch = async function (input, init) {
    var url = typeof input === "string" ? input : input && input.url || "";
    init = init || {};
    if (url.indexOf(STORAGE_PREFIX) !== 0 || String(init.method || "GET").toUpperCase() !== "POST" || !(init.body instanceof FormData)) {
      return nativeFetch(input, init);
    }

    var file = init.body.get("file");
    if (!(file instanceof Blob)) return new Response(JSON.stringify({ error: { message: "Missing image file" } }), { status: 400, headers: { "Content-Type": "application/json" } });

    var uploadBody = new FormData();
    uploadBody.append("cacheControl", "31536000");
    uploadBody.append("", file);

    var response = await nativeFetch(url, {
      method: "PUT",
      headers: { apikey: PUBLIC_KEY },
      body: uploadBody,
      signal: init.signal
    });
    var responseText = await response.text();
    if (!response.ok) {
      var message = "Upload failed";
      try { var parsedError = JSON.parse(responseText); message = parsedError.message || parsedError.error || message; } catch (_) {}
      return new Response(JSON.stringify({ error: { message: message } }), { status: response.status, headers: { "Content-Type": "application/json" } });
    }

    var pathPart = url.slice(STORAGE_PREFIX.length).split("?")[0];
    var path = "vehicles/" + decodeURIComponent(pathPart.split("/").pop());
    var width = null, height = null;
    try {
      if (typeof createImageBitmap === "function") {
        var bitmap = await createImageBitmap(file);
        width = bitmap.width; height = bitmap.height;
        if (bitmap.close) bitmap.close();
      }
    } catch (_) {}

    return new Response(JSON.stringify({
      supabase_path: path,
      public_id: path,
      width: width,
      height: height
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
})();
