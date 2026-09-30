/* Reuse the existing settings request. SSR supplies the right photo before paint. */
(function () {
  "use strict";
  if (!window.AH_HOME_SLOTS || !document.querySelector("[data-home-slot]")) return;
  var sequence = 0;
  function apply(media) {
    if (!media || typeof media !== "object") return;
    var turn = ++sequence;
    window.AH_HOME_SLOTS.forEach(function (factory) {
      var picture = document.querySelector('picture[data-home-slot="'+factory.slot+'"]');
      if (!picture) return;
      var custom = media[factory.slot], image = custom || factory, id = custom ? custom.id : "";
      if ((picture.dataset.homeId || "") === id) return;
      var img = picture.querySelector("img"), source = picture.querySelector("source"), background = document.querySelector('img[data-home-bg="'+factory.slot+'"]');
      var lazy = img.hasAttribute("data-src"), preload;
      function replace() {
        if (turn !== sequence || !picture.isConnected) return;
        var stillLazy = img.hasAttribute("data-src");
        source.setAttribute(stillLazy ? "data-srcset" : "srcset", image.webp);
        img.setAttribute(stillLazy ? "data-srcset" : "srcset", image.jpg);
        img.setAttribute(stillLazy ? "data-src" : "src", image.src);
        img.width=image.width; img.height=image.height;
        img.style.objectPosition=custom ? "50% 50%" : factory.position;
        img.alt="AutoHaus — "+factory.bg;
        if (background) background.setAttribute(background.hasAttribute("data-src") ? "data-src" : "src", image.background);
        picture.dataset.homeId=id;
      }
      if (lazy) return replace();
      preload=new Image(); preload.src=image.src;
      var bgLoad = background ? new Image() : null;
      if(bgLoad) bgLoad.src=image.background;
      Promise.all([preload.decode(),bgLoad ? bgLoad.decode() : Promise.resolve()]).then(replace).catch(function(){ /* Keep the working current photo on a network failure. */ });
    });
  }
  window.addEventListener("ah:photosettingschange",function(event){apply(event.detail && event.detail.homepage_media);});
})();
