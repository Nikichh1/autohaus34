(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AH_IMAGE_SORTER = api;
})(typeof window === "undefined" ? globalThis : window, function () {
  "use strict";

  const attached = new WeakMap();
  let nextId = 0;

  function nearestSlot(rects, x, y) {
    let closest = -1, distance = Infinity;
    rects.forEach(function (rect, index) {
      const dx = x - (rect.left + rect.width / 2);
      const dy = y - (rect.top + rect.height / 2);
      const next = dx * dx + dy * dy;
      if (next < distance) { closest = index; distance = next; }
    });
    return closest;
  }

  function keyboardTarget(key, position, count, columns) {
    const step = Math.max(1, columns || 1);
    const targets = { ArrowLeft: position - 1, ArrowRight: position + 1,
      ArrowUp: position - step, ArrowDown: position + step, Home: 0, End: count - 1 };
    return Object.prototype.hasOwnProperty.call(targets, key)
      ? Math.max(0, Math.min(count - 1, targets[key])) : null;
  }

  function scrollSpeed(y, top, bottom) {
    const edge = Math.min(72, Math.max(0, (bottom - top) / 3));
    if (!edge) return 0;
    if (y < top + edge) return -18 * Math.min(1, Math.max(0, (top + edge - y) / edge));
    if (y > bottom - edge) return 18 * Math.min(1, Math.max(0, (y - bottom + edge) / edge));
    return 0;
  }

  function attach(list, options) {
    options = options || {};
    if (!list || !list.ownerDocument) return { destroy: function () {}, cancel: function () {} };
    if (attached.has(list)) attached.get(list).destroy();
    const doc = list.ownerDocument, win = doc.defaultView;
    const labels = Object.assign({
      instructions: "Drag the handle to reorder photos. With a keyboard, press Space or Enter to pick up, use the arrow keys, then press Space or Enter to drop. Escape cancels.",
      picked: function (position, count) { return "Photo " + position + " of " + count + " picked up."; },
      moved: function (position, count) { return "Position " + position + " of " + count + ". The first photo is the cover."; },
      dropped: function (position, count) { return "Photo placed at position " + position + " of " + count + "."; },
      cancelled: "Photo order unchanged."
    }, options.labels || {});
    const help = doc.createElement("p"), live = doc.createElement("p");
    help.id = "image-sort-help-" + (++nextId);
    help.className = live.className = "sr-only image-sort-announcement";
    help.textContent = labels.instructions;
    live.setAttribute("role", "status");
    live.setAttribute("aria-live", "polite");
    live.setAttribute("aria-atomic", "true");
    list.after(help, live);
    const handles = Array.from(list.querySelectorAll(".image-drag-handle"));
    const previous = handles.map(function (handle) {
      const attrs = ["aria-describedby", "aria-pressed", "aria-keyshortcuts"];
      const values = attrs.map(function (attr) { return handle.getAttribute(attr); });
      handle.setAttribute("aria-describedby", [values[0], help.id].filter(Boolean).join(" "));
      handle.setAttribute("aria-pressed", "false");
      handle.setAttribute("aria-keyshortcuts", "Space Enter ArrowLeft ArrowRight ArrowUp ArrowDown Home End Escape");
      return { handle: handle, attrs: attrs, values: values };
    });
    let session = null, ghost = null, frame = 0, disposed = false;
    const initialCards = cards();

    function cards() { return Array.from(list.querySelectorAll(".image-card[data-image-index]")); }
    function allowed() { return !disposed && (!options.isDisabled || !options.isDisabled()); }
    function intact() {
      const current = cards();
      return list.isConnected !== false && current.length === initialCards.length && initialCards.every(function (card) { return current.includes(card); });
    }
    function announce(label, position) {
      const value = labels[label];
      live.textContent = typeof value === "function" ? value(position + 1, initialCards.length) : value;
    }
    function focus(handle) { if (handle && handle.isConnected !== false) handle.focus({ preventScroll: true }); }
    function findHandle(target) {
      const handle = target && target.closest ? target.closest(".image-drag-handle[data-img-drag]") : null;
      return handle && list.contains(handle) && !handle.disabled ? handle : null;
    }
    function begin(handle, type) {
      if (!allowed() || !intact() || initialCards.length < 2) return false;
      const card = handle.closest(".image-card[data-image-index]");
      const original = cards(), from = original.indexOf(card);
      if (from < 0) return false;
      session = { type: type, card: card, handle: handle, original: original, from: from, to: from, started: type === "keyboard" };
      focus(handle);
      if (session.started) markStarted();
      win.addEventListener("blur", cancel);
      win.addEventListener("resize", cancel);
      doc.addEventListener("visibilitychange", visibilityChanged);
      doc.addEventListener("keydown", escapePointer);
      return true;
    }
    function markStarted() {
      list.classList.add("is-sorting");
      session.card.classList.add("is-sort-active");
      session.handle.setAttribute("aria-pressed", "true");
      announce("picked", session.from);
    }
    function preview(to) {
      if (!session || to < 0 || to === session.to) return;
      const others = cards().filter(function (card) { return card !== session.card; });
      if (others[to]) list.insertBefore(session.card, others[to]);
      else list.appendChild(session.card);
      session.to = to;
      if (session.type === "keyboard") {
        focus(session.handle);
        session.card.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "instant" });
      }
      announce("moved", to);
    }
    function restore(current) {
      if (!intact()) return;
      current.original.forEach(function (card) { list.appendChild(card); });
    }
    function stop(commit, silent) {
      if (!session) return;
      const current = session;
      session = null;
      if (frame) { win.cancelAnimationFrame(frame); frame = 0; }
      win.removeEventListener("blur", cancel);
      win.removeEventListener("resize", cancel);
      doc.removeEventListener("visibilitychange", visibilityChanged);
      doc.removeEventListener("keydown", escapePointer);
      win.removeEventListener("pointermove", pointerMove);
      win.removeEventListener("pointerup", pointerUp);
      win.removeEventListener("pointercancel", pointerCancel);
      list.removeEventListener("lostpointercapture", pointerCancel);
      if (current.pointerId !== undefined && list.hasPointerCapture && list.hasPointerCapture(current.pointerId)) {
        list.releasePointerCapture(current.pointerId);
      }
      if (ghost) { ghost.remove(); ghost = null; }
      list.classList.remove("is-sorting");
      current.card.classList.remove("is-sort-active");
      current.handle.setAttribute("aria-pressed", "false");
      // Preview order never becomes application data. Restore first, then let the
      // editor's existing move/save path apply a single committed move.
      restore(current);
      focus(current.handle);
      const changed = commit && current.started && current.to !== current.from && allowed() && intact();
      if (!silent && current.started) announce(changed ? "dropped" : "cancelled", current.to);
      if (changed && typeof options.onMove === "function") options.onMove(current.from, current.to);
    }
    function cancel() { stop(false); }
    function visibilityChanged() { if (doc.visibilityState === "hidden") cancel(); }
    function escapePointer(event) {
      if (session && session.type === "pointer" && event.key === "Escape") { event.preventDefault(); cancel(); }
    }
    function pointerDown(event) {
      const handle = findHandle(event.target);
      if (!handle || session || event.isPrimary === false || (event.button !== undefined && event.button !== 0)) return;
      if (!begin(handle, "pointer")) return;
      event.preventDefault();
      const rect = session.card.getBoundingClientRect();
      Object.assign(session, { pointerId: event.pointerId, x: event.clientX, y: event.clientY,
        startX: event.clientX, startY: event.clientY, rect: rect,
        offsetX: rect.left + rect.width / 2 - event.clientX, offsetY: rect.top + rect.height / 2 - event.clientY });
      // Capture on the stable grid, since its cards move during the preview.
      if (list.setPointerCapture) {
        try { list.setPointerCapture(event.pointerId); } catch (_) { /* Window listeners still complete or cancel the gesture. */ }
      }
      list.addEventListener("lostpointercapture", pointerCancel);
      win.addEventListener("pointermove", pointerMove, { passive: false });
      win.addEventListener("pointerup", pointerUp);
      win.addEventListener("pointercancel", pointerCancel);
    }
    function createGhost() {
      ghost = session.card.cloneNode(true);
      ghost.removeAttribute("id");
      ghost.removeAttribute("data-image-index");
      ghost.classList.remove("is-sort-active");
      ghost.classList.add("is-sort-ghost");
      ghost.setAttribute("aria-hidden", "true");
      ghost.inert = true;
      ghost.querySelectorAll("[id]").forEach(function (element) { element.removeAttribute("id"); });
      ghost.querySelectorAll("button, a, input").forEach(function (element) { element.tabIndex = -1; });
      ghost.style.width = session.rect.width + "px";
      ghost.style.height = session.rect.height + "px";
      doc.body.appendChild(ghost);
    }
    function updatePointerPosition() {
      if (!session || !session.started || !intact()) return;
      ghost.style.left = session.rect.left + session.x - session.startX + "px";
      ghost.style.top = session.rect.top + session.y - session.startY + "px";
      const rect = list.getBoundingClientRect();
      if (session.x < rect.left - 40 || session.x > rect.right + 40) return;
      preview(nearestSlot(cards().map(function (card) { return card.getBoundingClientRect(); }),
        session.x + session.offsetX, session.y + session.offsetY));
    }
    function pointerMove(event) {
      if (!session || session.type !== "pointer" || event.pointerId !== session.pointerId) return;
      if (!allowed() || !intact()) { cancel(); return; }
      event.preventDefault();
      session.x = event.clientX; session.y = event.clientY;
      if (!session.started) {
        if (Math.hypot(session.x - session.startX, session.y - session.startY) < 6) return;
        session.started = true;
        markStarted(); createGhost();
        frame = win.requestAnimationFrame(autoScroll);
      }
      updatePointerPosition();
    }
    function scrollBounds() {
      let top = 0, bottom = win.innerHeight;
      const header = doc.querySelector(".mobile-head"), footer = doc.querySelector(".editor-side");
      if (header) {
        const rect = header.getBoundingClientRect(), style = win.getComputedStyle(header);
        if (style.display !== "none" && (style.position === "sticky" || style.position === "fixed") && rect.top <= 1) top = Math.max(top, rect.bottom);
      }
      if (footer && win.getComputedStyle(footer).position === "fixed") bottom = Math.min(bottom, footer.getBoundingClientRect().top);
      return { top: top, bottom: bottom };
    }
    function autoScroll() {
      frame = 0;
      if (!session || session.type !== "pointer" || !session.started) return;
      if (!allowed() || !intact()) { cancel(); return; }
      const bounds = scrollBounds(), rect = list.getBoundingClientRect();
      const speed = session.x >= rect.left - 40 && session.x <= rect.right + 40 ? scrollSpeed(session.y, bounds.top, bounds.bottom) : 0;
      if (speed) { win.scrollBy({ top: speed, left: 0, behavior: "instant" }); updatePointerPosition(); }
      frame = win.requestAnimationFrame(autoScroll);
    }
    function pointerUp(event) {
      if (!session || session.type !== "pointer" || event.pointerId !== session.pointerId) return;
      const rect = list.getBoundingClientRect();
      const inside = event.clientX >= rect.left - 24 && event.clientX <= rect.right + 24 && event.clientY >= rect.top - 24 && event.clientY <= rect.bottom + 24;
      stop(inside);
    }
    function pointerCancel(event) {
      if (session && session.type === "pointer" && event.pointerId === session.pointerId) cancel();
    }
    function keyDown(event) {
      const handle = findHandle(event.target);
      if (!handle || (session && session.type !== "keyboard")) return;
      const toggle = event.key === " " || event.key === "Enter";
      if (!session) {
        if (toggle && !event.repeat && begin(handle, "keyboard")) event.preventDefault();
        return;
      }
      if (!allowed() || !intact()) { cancel(); return; }
      if (event.key === "Tab") { cancel(); return; }
      if (event.key === "Escape") { event.preventDefault(); cancel(); return; }
      if (toggle) { event.preventDefault(); if (!event.repeat) stop(true); return; }
      const rects = cards().map(function (card) { return card.getBoundingClientRect(); });
      const columns = rects.filter(function (rect) { return Math.abs(rect.top - rects[0].top) < 2; }).length;
      const to = keyboardTarget(event.key, session.to, initialCards.length, columns);
      if (to !== null) { event.preventDefault(); preview(to); }
    }
    function dragStart(event) {
      // Do not let browser-native image dragging compete with pointer sorting.
      if (event.target.closest && event.target.closest(".image-card")) event.preventDefault();
    }
    function outsidePointer(event) {
      if (session && session.type === "keyboard" && !list.contains(event.target)) cancel();
    }
    function focusOut(event) {
      if (session && session.type === "keyboard" && event.relatedTarget && !list.contains(event.relatedTarget)) cancel();
    }
    function destroy() {
      if (disposed) return;
      stop(false, true);
      disposed = true;
      list.removeEventListener("pointerdown", pointerDown);
      list.removeEventListener("keydown", keyDown);
      list.removeEventListener("dragstart", dragStart);
      list.removeEventListener("focusout", focusOut);
      doc.removeEventListener("pointerdown", outsidePointer);
      if (observer) observer.disconnect();
      previous.forEach(function (entry) {
        entry.attrs.forEach(function (attr, index) {
          if (entry.values[index] === null) entry.handle.removeAttribute(attr);
          else entry.handle.setAttribute(attr, entry.values[index]);
        });
      });
      help.remove(); live.remove();
      attached.delete(list);
    }
    list.addEventListener("pointerdown", pointerDown);
    list.addEventListener("keydown", keyDown);
    list.addEventListener("dragstart", dragStart);
    list.addEventListener("focusout", focusOut);
    doc.addEventListener("pointerdown", outsidePointer);
    const observer = win.MutationObserver ? new win.MutationObserver(function () { if (!intact()) destroy(); }) : null;
    if (observer) observer.observe(doc.body, { childList: true, subtree: true });
    const api = { destroy: destroy, cancel: cancel };
    attached.set(list, api);
    return api;
  }

  return { attach: attach, nearestSlot: nearestSlot, keyboardTarget: keyboardTarget, scrollSpeed: scrollSpeed };
});
