"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { attach, nearestSlot, keyboardTarget, scrollSpeed } = require("../admin/image-sorter.js");

function eventTarget() {
  const listeners = new Map();
  return {
    listeners,
    addEventListener(name, handler) {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name).add(handler);
    },
    removeEventListener(name, handler) { if (listeners.has(name)) listeners.get(name).delete(handler); },
    dispatch(name, options = {}) {
      const event = Object.assign({ type: name, prevented: false, preventDefault() { this.prevented = true; } }, options);
      Array.from(listeners.get(name) || []).forEach(handler => handler(event));
      return event;
    }
  };
}

function harness({ count = 6, columns = 3 } = {}) {
  let disabled = false, frameId = 0, captured = null;
  const frames = new Map(), observations = [], moves = [], scrolls = [];
  const win = Object.assign(eventTarget(), {
    innerHeight: 800,
    requestAnimationFrame(fn) { frames.set(++frameId, fn); return frameId; },
    cancelAnimationFrame(id) { frames.delete(id); },
    scrollBy(value) { scrolls.push(value); },
    getComputedStyle(element) { return element.computed || { display: "block", position: "static" }; },
    MutationObserver: class {
      constructor(fn) { this.fn = fn; this.active = true; observations.push(this); }
      observe() {}
      disconnect() { this.active = false; }
    }
  });
  const doc = Object.assign(eventTarget(), { defaultView: win, visibilityState: "visible", activeElement: null });
  function element(className = "") {
    const attrs = new Map(), classes = new Set(className.split(/\s+/).filter(Boolean));
    const node = Object.assign(eventTarget(), {
      ownerDocument: doc, children: [], parentNode: null, disabled: false, style: {},
      className, textContent: "", dataset: {},
      classList: {
        add(...names) { names.forEach(name => classes.add(name)); },
        remove(...names) { names.forEach(name => classes.delete(name)); },
        contains(name) { return classes.has(name); }
      },
      setAttribute(name, value) { attrs.set(name, String(value)); },
      getAttribute(name) { return attrs.has(name) ? attrs.get(name) : null; },
      removeAttribute(name) { attrs.delete(name); },
      appendChild(child) {
        if (child.parentNode) child.parentNode.children.splice(child.parentNode.children.indexOf(child), 1);
        this.children.push(child); child.parentNode = this; return child;
      },
      insertBefore(child, next) {
        if (child.parentNode) child.parentNode.children.splice(child.parentNode.children.indexOf(child), 1);
        this.children.splice(this.children.indexOf(next), 0, child); child.parentNode = this; return child;
      },
      after(...nodes) {
        const parent = this.parentNode;
        let index = parent.children.indexOf(this);
        nodes.forEach(child => { parent.children.splice(++index, 0, child); child.parentNode = parent; });
      },
      remove() {
        if (this.parentNode) this.parentNode.children.splice(this.parentNode.children.indexOf(this), 1);
        this.parentNode = null;
      },
      contains(child) { return this === child || this.children.some(node => node.contains(child)); },
      matches(selector) {
        if (selector === ".image-drag-handle[data-img-drag]" || selector === ".image-drag-handle") return classes.has("image-drag-handle");
        if (selector === ".image-card[data-image-index]" || selector === ".image-card") return classes.has("image-card") && attrs.has("data-image-index");
        if (selector === "[id]") return attrs.has("id");
        if (selector === "button, a, input") return this.tagName === "BUTTON";
        return false;
      },
      closest(selector) { return this.matches(selector) ? this : this.parentNode && this.parentNode.closest(selector); },
      querySelectorAll(selector) {
        return this.children.flatMap(child => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]);
      },
      getBoundingClientRect() {
        if (this.rect) return this.rect;
        const index = list.children.indexOf(this);
        const left = index % columns * 110 + 10, top = Math.floor(index / columns) * 170 + 100;
        return { left, top, right: left + 100, bottom: top + 160, width: 100, height: 160 };
      },
      focus() { doc.activeElement = this; },
      scrollIntoView() { this.scrolledIntoView = true; },
      cloneNode(deep) {
        const clone = element(Array.from(classes).join(" "));
        attrs.forEach((value, key) => clone.setAttribute(key, value));
        if (deep) this.children.forEach(child => clone.appendChild(child.cloneNode(true)));
        return clone;
      }
    });
    Object.defineProperty(node, "isConnected", { get() { return this === doc.body || Boolean(this.parentNode && this.parentNode.isConnected); } });
    return node;
  }
  doc.createElement = () => element();
  doc.body = element();
  doc.querySelector = selector => selector === ".mobile-head" ? doc.header || null : selector === ".editor-side" ? doc.footer || null : null;
  const list = element("image-grid");
  list.rect = { left: 10, top: 100, right: columns * 110, bottom: 100 + Math.ceil(count / columns) * 170, width: columns * 110 - 10, height: Math.ceil(count / columns) * 170 };
  list.setPointerCapture = id => { captured = id; };
  list.hasPointerCapture = id => captured === id;
  list.releasePointerCapture = () => { captured = null; };
  doc.body.appendChild(list);
  const cards = Array.from({ length: count }, (_, index) => {
    const card = element("image-card"), handle = element("image-drag-handle");
    card.setAttribute("data-image-index", index);
    handle.setAttribute("data-img-drag", index);
    handle.tagName = "BUTTON";
    card.appendChild(handle); list.appendChild(card); return card;
  });
  const handles = cards.map(card => card.children[0]);
  let api = attach(list, { onMove: (from, to) => moves.push([from, to]), isDisabled: () => disabled });
  return {
    win, doc, list, cards, handles, frames, moves, scrolls, observations, element,
    get api() { return api; }, get captured() { return captured; },
    order: () => list.children.map(card => Number(card.getAttribute("data-image-index"))),
    disable(value = true) { disabled = value; },
    key(key, index = 0, extra = {}) { return list.dispatch("keydown", Object.assign({ key, target: handles[index] }, extra)); },
    pointer(name, x, y, extra = {}) {
      return (name === "pointerdown" ? list : win).dispatch(name, Object.assign({ target: handles[0], clientX: x, clientY: y, pointerId: 1, button: 0, isPrimary: true }, extra));
    },
    tick() { const pending = Array.from(frames.values()); frames.clear(); pending.forEach(fn => fn()); },
    observe() { observations.filter(observer => observer.active).forEach(observer => observer.fn()); },
    reattach() { api = attach(list, { onMove: (from, to) => moves.push([from, to]) }); }
  };
}

test("nearest grid slot handles wrapped rows and empty lists", () => {
  const rects = [{ left: 0, top: 0, width: 100, height: 100 }, { left: 110, top: 0, width: 100, height: 100 }, { left: 0, top: 110, width: 100, height: 100 }];
  assert.equal(nearestSlot(rects, 160, 45), 1);
  assert.equal(nearestSlot(rects, 40, 170), 2);
  assert.equal(nearestSlot([], 0, 0), -1);
});

test("keyboard positions clamp at boundaries and move vertically by grid columns", () => {
  assert.equal(keyboardTarget("ArrowUp", 4, 6, 3), 1);
  assert.equal(keyboardTarget("ArrowDown", 4, 6, 3), 5);
  assert.equal(keyboardTarget("ArrowLeft", 0, 6, 3), 0);
  assert.equal(keyboardTarget("Home", 4, 6, 3), 0);
  assert.equal(keyboardTarget("End", 4, 6, 3), 5);
  assert.equal(keyboardTarget("a", 4, 6, 3), null);
});

test("keyboard preview commits exactly one move while restoring DOM for editor rerender", () => {
  const h = harness();
  assert.equal(h.key(" ").prevented, true);
  assert.equal(h.handles[0].getAttribute("aria-pressed"), "true");
  h.key("ArrowDown");
  assert.deepEqual(h.order(), [1, 2, 3, 0, 4, 5]);
  assert.deepEqual(h.moves, []);
  h.key("End"); h.key("Enter");
  assert.deepEqual(h.moves, [[0, 5]]);
  assert.deepEqual(h.order(), [0, 1, 2, 3, 4, 5]);
  assert.equal(h.handles[0].getAttribute("aria-pressed"), "false");
  assert.equal(h.doc.activeElement, h.handles[0]);
  h.api.destroy();
});

test("Escape, Tab, outside focus, and window blur cancel without changing data", () => {
  for (const action of [h => h.key("Escape"), h => h.key("Tab"), h => h.win.dispatch("blur"), h => h.list.dispatch("focusout", { relatedTarget: h.doc.body })]) {
    const h = harness();
    h.key("Enter"); h.key("End"); action(h);
    assert.deepEqual(h.order(), [0, 1, 2, 3, 4, 5]);
    assert.deepEqual(h.moves, []);
    assert.equal(h.list.classList.contains("is-sorting"), false);
    h.api.destroy();
  }
});

test("pointer handle supports touch, live preview and a single committed drop", () => {
  const h = harness();
  h.pointer("pointerdown", 60, 240, { pointerType: "touch" });
  assert.equal(h.captured, 1);
  h.pointer("pointermove", 280, 410, { pointerType: "touch" });
  assert.deepEqual(h.order(), [1, 2, 3, 4, 5, 0]);
  assert.equal(h.frames.size, 1);
  assert.equal(h.doc.body.children.some(node => node.classList.contains("is-sort-ghost")), true);
  h.pointer("pointerup", 280, 410, { pointerType: "touch" });
  assert.deepEqual(h.moves, [[0, 5]]);
  assert.equal(h.captured, null);
  assert.equal(h.frames.size, 0);
  assert.equal(h.doc.body.children.some(node => node.classList.contains("is-sort-ghost")), false);
  h.api.destroy();
});

test("small pointer motion does not reorder and secondary pointers cannot hijack a drag", () => {
  const h = harness();
  h.pointer("pointerdown", 60, 240);
  h.pointer("pointermove", 280, 410, { pointerId: 2 });
  h.pointer("pointermove", 62, 242);
  h.pointer("pointerup", 62, 242);
  assert.deepEqual(h.moves, []);
  assert.equal(h.frames.size, 0);
  h.api.destroy();
});

test("pointercancel, lost capture, outside drop, Escape, and resize restore original order", () => {
  for (const action of [h => h.pointer("pointercancel", 280, 410), h => h.list.dispatch("lostpointercapture", { pointerId: 1 }), h => h.pointer("pointerup", 900, 410), h => h.doc.dispatch("keydown", { key: "Escape" }), h => h.win.dispatch("resize")]) {
    const h = harness();
    h.pointer("pointerdown", 60, 240); h.pointer("pointermove", 280, 410); action(h);
    assert.deepEqual(h.order(), [0, 1, 2, 3, 4, 5]);
    assert.deepEqual(h.moves, []);
    assert.equal(h.frames.size, 0);
    h.api.destroy();
  }
});

test("disabled/save/upload states prohibit starting or committing a reorder", () => {
  const h = harness();
  h.disable(); h.key("Enter"); h.pointer("pointerdown", 60, 240);
  assert.equal(h.handles[0].getAttribute("aria-pressed"), "false");
  h.disable(false); h.key("Enter"); h.key("End"); h.disable(); h.key("Enter");
  assert.deepEqual(h.moves, []);
  assert.deepEqual(h.order(), [0, 1, 2, 3, 4, 5]);
  h.api.destroy();
});

test("autoscroll accounts for fixed admin save bar and stops on cancellation", () => {
  const h = harness({ count: 12 });
  h.doc.footer = h.element();
  h.doc.footer.computed = { position: "fixed" };
  h.doc.footer.rect = { top: 650 };
  h.pointer("pointerdown", 60, 240); h.pointer("pointermove", 60, 640); h.tick();
  assert.equal(h.scrolls.length, 1);
  assert.ok(h.scrolls[0].top > 0);
  h.api.cancel(); h.tick();
  assert.equal(h.scrolls.length, 1);
  assert.equal(scrollSpeed(400, 80, 650), 0);
  assert.equal(scrollSpeed(20, 80, 650), -18);
  assert.equal(scrollSpeed(800, 80, 650), 18);
  h.api.destroy();
});

test("detach, replaced cards, destroy, and reattach remove old listeners and ghost state", () => {
  const h = harness();
  h.pointer("pointerdown", 60, 240); h.pointer("pointermove", 280, 410);
  h.list.remove(); h.observe();
  assert.equal(h.frames.size, 0);
  assert.equal(h.win.listeners.get("pointermove").size, 0);
  assert.equal(h.doc.listeners.get("pointerdown").size, 0);
  assert.deepEqual(h.moves, []);
  assert.equal(h.handles[0].getAttribute("aria-describedby"), null);
  const other = harness();
  other.reattach();
  assert.equal(other.list.listeners.get("keydown").size, 1);
  assert.equal(other.doc.listeners.get("pointerdown").size, 1);
  other.cards[0].remove(); other.observe();
  assert.equal(other.list.listeners.get("keydown").size, 0);
  other.api.destroy();
});

test("one photo is not draggable and non-handle photo gestures retain normal behavior", () => {
  const h = harness({ count: 1 });
  assert.equal(h.key("Enter").prevented, false);
  assert.equal(h.pointer("pointerdown", 60, 240, { target: h.cards[0] }).prevented, false);
  assert.equal(h.captured, null);
  h.api.destroy();
});
