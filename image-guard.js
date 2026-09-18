/* AutoHaus image interaction protection.
   Deliberately scoped to vehicle photos only. It does NOT intercept page
   clicks, keyboard shortcuts, navigation, fetch(), or pointer events. */
(function () {
  "use strict";

  var SELECTOR = [
    ".lc__pic img",
    ".dgal img",
    ".dthumb img",
    ".lb img",
    ".gallery img",
    ".image-card img"
  ].join(",");

  function protectedImage(target) {
    return target && target.nodeType === 1 && target.matches && target.matches(SELECTOR);
  }

  function harden(root) {
    var scope = root && root.querySelectorAll ? root : document;
    scope.querySelectorAll(SELECTOR).forEach(function (img) {
      img.draggable = false;
      img.setAttribute("draggable", "false");
      img.style.webkitUserDrag = "none";
      img.style.userSelect = "none";
      img.style.webkitUserSelect = "none";
    });
  }

  document.addEventListener("dragstart", function (event) {
    if (protectedImage(event.target)) event.preventDefault();
  }, true);

  document.addEventListener("contextmenu", function (event) {
    if (protectedImage(event.target)) event.preventDefault();
  }, true);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { harden(document); }, { once: true });
  } else {
    harden(document);
  }

  var observer = new MutationObserver(function (records) {
    records.forEach(function (record) {
      record.addedNodes.forEach(function (node) {
        if (!node || node.nodeType !== 1) return;
        if (protectedImage(node)) {
          node.draggable = false;
          node.setAttribute("draggable", "false");
          node.style.webkitUserDrag = "none";
          node.style.userSelect = "none";
          node.style.webkitUserSelect = "none";
        }
        harden(node);
      });
    });
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
