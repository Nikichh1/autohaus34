'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../vehicle.js'), 'utf8').replace(/\r\n/g, '\n');
// Run the production function bodies, not copies of their implementations.
// Top-level functions in this renderer use two-space indentation.
function rendererFunction(name) {
  const start = source.indexOf('  function ' + name + '(');
  assert.notEqual(start, -1, name + ' must exist in vehicle.js');
  const end = source.indexOf('\n  }\n', start);
  assert.notEqual(end, -1, name + ' function boundary must exist');
  return source.slice(start, end + 5);
}
function escape(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
const equipment = vm.runInNewContext('(' + rendererFunction('equipHTML').trim() + ')', { AH: { esc: escape } });

test('equipment preserves leading standalone bullets and multiline source order', () => {
  const result = equipment(['- First feature\r\n• Second feature', '', '  Third feature  ', '▪ Fourth feature']);
  assert.equal(result.n, 4);
  assert.equal(result.simple, true);
  const labels = [...result.html.matchAll(/class="deq-v">([^<]*)</g)].map(match => match[1]);
  assert.deepEqual(labels, ['First feature', 'Second feature', 'Third feature', 'Fourth feature']);
  assert.doesNotMatch(result.html, /deq-sub/);
});

test('coded equipment keeps package subpoints together without losing the next option', () => {
  const result = equipment(['72B – USB package\n- Front USB-C ports\n— Rear USB-C ports', '840 – Tinted windows', '• Independent feature']);
  assert.equal(result.n, 3);
  assert.equal(result.simple, false);
  assert.match(result.html, /class="deq-c">72B<\/span>/);
  assert.match(result.html, /<ul class="deq-sub"><li>Front USB-C ports<\/li><li>Rear USB-C ports<\/li><\/ul>/);
  assert.ok(result.html.indexOf('Rear USB-C ports') < result.html.indexOf('840'));
  assert.match(result.html, /class="deq-v">Independent feature<\/span>/);
});

test('equipment escapes stored text and handles empty and long content', () => {
  const result = equipment(['4А2 – <Camera> & "package"', '- <script>alert(1)</script>']);
  assert.match(result.html, /class="deq-c">4A2<\/span>/);
  assert.match(result.html, /&lt;Camera&gt; &amp; &quot;package&quot;/);
  assert.match(result.html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(result.html, /<script>/);
  assert.equal(equipment([]).n, 0);
  assert.equal(equipment(['', '\n ', '\r\n']).n, 0);
  assert.equal(equipment(['Long equipment '.repeat(30)]).simple, false);
});

test('every canonical BG and EN equipment line remains represented', () => {
  const vehicles = require('../api/admin/vehicles').initialInventory();
  for (const vehicle of vehicles) {
    for (const lang of ['bg', 'en']) {
      const lines = vehicle['equipment_' + lang];
      const result = equipment(lines);
      for (const original of lines) {
        for (const line of String(original).replace(/\r\n?/g, '\n').split('\n')) {
          const value = line.trim().replace(/^[•●▪]\s*|^[-–—]\s*/, '').replace(/^([0-9A-ZА-Я]{1,6})\s+[-–—]\s*/, '');
          if (value) assert.ok(result.html.includes(escape(value)), vehicle.slug + ' ' + lang + ': ' + value);
        }
      }
    }
  }
});

function gallery(count = 4, connection = { saveData: true }) {
  const requests = [], writes = [], attributes = {};
  const mainImg = {
    _src: 'initial.jpg', complete: true, naturalWidth: 800,
    get currentSrc() { return this.src; },
    get src() { return this._src; },
    set src(value) { this._src = value; writes.push(value); },
    removeAttribute(name) { delete this[name]; }
  };
  let sourcesRemoved = 0;
  const mainPicture = { querySelectorAll: () => [{ remove() { sourcesRemoved++; } }] };
  const mainFrame = count ? {
    dataset: { i: '0' }, clientWidth: 800,
    setAttribute(key, value) { attributes[key] = value; },
    getAttribute(key) { return attributes[key]; },
    removeAttribute(key) { delete attributes[key]; }
  } : null;
  const thumbs = Array.from({ length: count }, (_, index) => ({
    active: !index, attrs: {}, offsetLeft: 200 + index * 96, offsetWidth: 88,
    classList: { add() { thumbs[index].active = true; }, remove() { thumbs[index].active = false; } },
    setAttribute(key, value) { this.attrs[key] = value; }
  }));
  class Image {
    constructor() { requests.push(this); this.complete = false; this.naturalWidth = 0; }
    get currentSrc() { return this.src; }
    decode() { return this.rejectDecode ? Promise.reject(new Error('Decode unavailable')) : Promise.resolve(); }
  }
  const variants = Object.fromEntries(Array.from({ length: count }, (_, i) => [
    'photo-' + i, { webp1280: 'photo-' + i + '-1280.webp', webp1920: 'photo-' + i + '-1920.webp' }
  ]));
  const context = vm.createContext({
    N: count, selected: 0, displayedIndex: 0, selectionVersion: 0, decoded: Object.create(null), Image,
    navigator: { connection }, window: { devicePixelRatio: 1, AH_IMAGE_VARIANTS: variants },
    innerWidth: 1000, webpOkay: true, lb: null, lbStage: null, mainImg, mainPicture,
    mainFrame, mainCounter: { textContent: '' }, thumbs,
    thumbRail: { offsetLeft: 200, scrollLeft: 0, clientWidth: 180 }, nEl: { textContent: '' },
    shots: Array.from({ length: count }, (_, i) => 'photo-' + i),
    v: { full: 'Test vehicle', model: 'Test model' }, seedDecodedMain() {}, hydrateThumb() {},
    AH: { img: (shot, width) => shot + '-' + width + '.jpg' }
  });
  vm.runInContext(['canWarmImages', 'desiredHqWidth', 'hqSource', 'prepareAt', 'prepare',
    'prepareNavigation', 'warmNeighbors', 'stripTo'].map(rendererFunction).join('\n'), context);
  return { context, requests, writes, attributes, mainImg, mainFrame, thumbs,
    get sourcesRemoved() { return sourcesRemoved; },
    select(index) { context.stripTo(index); },
    async load(index) {
      requests[index].complete = true; requests[index].naturalWidth = 1280;
      requests[index].onload(); await new Promise(setImmediate);
    },
    async fail(index) {
      // WebP, full-size JPEG, then small JPEG: every candidate must be exhausted.
      for (let i = 0; i < 3; i++) requests[index].onerror();
      await new Promise(setImmediate);
    }
  };
}

test('selection keeps current decoded frame and deduplicates repeated taps', async () => {
  const g = gallery();
  g.select(2);
  assert.equal(g.mainImg.src, 'initial.jpg');
  assert.equal(g.sourcesRemoved, 0);
  assert.equal(g.attributes['aria-busy'], 'true');
  g.select(2);
  assert.equal(g.requests.length, 1);
  await g.load(0);
  assert.equal(g.mainImg.src, 'photo-2-1280.webp');
  assert.equal(g.context.displayedIndex, 2);
  assert.equal(g.sourcesRemoved, 1);
  assert.equal(g.attributes['aria-busy'], undefined);
  assert.equal(g.thumbs.filter(thumb => thumb.active).length, 1);
  assert.equal(g.context.nEl.textContent, '3 / 4');
});

test('out-of-order requests and late decode never replace latest choice', async () => {
  for (const lateDecode of [false, true]) {
    const g = gallery();
    let finishDecode;
    g.select(1);
    if (lateDecode) {
      g.requests[0].decode = () => new Promise(resolve => { finishDecode = resolve; });
      await g.load(0);
    }
    g.select(2);
    await g.load(1);
    if (lateDecode) { finishDecode(); await new Promise(setImmediate); }
    else await g.load(0);
    assert.deepEqual(g.writes, ['photo-2-1280.webp']);
    assert.equal(g.attributes['aria-busy'], undefined);
  }
});

test('total failure keeps last good image and allows retry of the same selection', async () => {
  const g = gallery();
  g.select(1);
  await g.fail(0);
  assert.equal(g.mainImg.src, 'initial.jpg');
  assert.equal(g.attributes['aria-busy'], undefined);
  assert.equal(g.context.decoded['1:hq1280'], undefined);
  g.select(1);
  assert.equal(g.requests.length, 2);
  await g.load(1);
  assert.equal(g.mainImg.src, 'photo-1-1280.webp');
});

test('fallback tries full-size JPEG before smaller JPEG without duplicate candidates', async () => {
  const g = gallery();
  g.select(1);
  g.requests[0].onerror();
  assert.equal(g.requests[0].src, 'photo-1-1280.jpg');
  g.requests[0].rejectDecode = true;
  await g.load(0);
  assert.equal(g.mainImg.src, 'photo-1-1280.jpg');
});

test('speculative request is low priority and promoted without a duplicate', async () => {
  const g = gallery(4, {});
  g.context.prepareNavigation(2, 'low');
  assert.equal(g.requests[0].fetchPriority, 'low');
  g.select(2);
  assert.equal(g.requests.length, 1);
  assert.equal(g.requests[0].fetchPriority, 'high');
  await g.load(0);
  assert.equal(g.requests.length, 3);
  assert.ok(g.requests.slice(1).every(image => image.fetchPriority === 'low'));
});

test('Save-Data and slow connections skip warming but never block chosen photos', async () => {
  for (const connection of [{ saveData: true }, { effectiveType: 'slow-2g' }, { effectiveType: '2g' },
    { effectiveType: '3g' }, { downlink: 1 }]) {
    const g = gallery(4, connection);
    assert.equal(await g.context.prepare(1), null);
    g.select(1);
    assert.equal(g.requests[0].fetchPriority, 'high');
    await g.load(0);
    assert.equal(g.requests.length, 1);
  }
});

test('gallery wraps selection, reveals thumbnail and handles zero or one photo', async () => {
  const g = gallery(8);
  g.select(-1);
  assert.equal(g.mainFrame.dataset.i, '7');
  assert.ok(g.context.thumbRail.scrollLeft > 0);
  await g.load(0);
  g.select(8);
  assert.equal(g.mainFrame.dataset.i, '0');
  assert.equal(g.context.thumbRail.scrollLeft, 0);
  for (const count of [0, 1]) {
    const small = gallery(count);
    assert.doesNotThrow(() => { small.select(0); small.select(-1); small.select(1); });
    assert.equal(small.requests.length, 0);
  }
});

test('single-photo layout remains full-width with responsive first paint', () => {
  const sizes = vm.runInNewContext('(' + rendererFunction('gallerySizes').trim() + ')');
  assert.equal(sizes(1), '100vw');
  assert.equal(sizes(2), '(min-width:1024px) 66vw, 100vw');
  assert.match(source, /var frameSizes = i === 0 \? mainSizes/);
});

function lightbox(connection, count = 4) {
  const g = gallery(count, connection);
  const state = new Set(), attrs = {}, shown = [];
  const image = { style: {}, removeAttribute(name) { delete this[name]; },
    set src(value) { this._src = value; shown.push(value); }, get src() { return this._src; } };
  Object.assign(g.context, {
    lb: { classList: { contains: key => state.has(key), add: key => state.add(key), remove: key => state.delete(key) } },
    lbImg: image, lbStage: { clientWidth: 1000, setAttribute: (key, value) => { attrs[key] = value; },
      removeAttribute: key => { delete attrs[key]; } },
    lbCount: { textContent: '' }, lightboxVersion: 0, shot: 0, opener: null,
    D: { getElementById: () => ({ focus() {} }) }, lockPage() {}
  });
  vm.runInContext(rendererFunction('open') + '\n' + rendererFunction('close'), g.context);
  return Object.assign(g, { shown, attrs, image, open: index => g.context.open(index), close: () => g.context.close() });
}

test('lightbox uses current main image as first preview then decoded navigation photo', async () => {
  const g = lightbox();
  g.open(0);
  assert.equal(g.image.src, 'initial.jpg');
  assert.equal(g.requests[0].fetchPriority, 'high');
  await g.load(0);
  assert.equal(g.image.src, 'photo-0-1280.webp');
  g.open(1);
  assert.equal(g.image.src, 'photo-0-1280.webp');
  await g.load(1);
  assert.equal(g.image.src, 'photo-1-1280.webp');
  assert.equal(g.attrs['aria-busy'], undefined);
});

test('lightbox ignores outdated completion and preserves frame on failure or close', async () => {
  const g = lightbox();
  g.open(1);
  g.open(2);
  await g.load(1);
  await g.load(0);
  assert.equal(g.image.src, 'photo-2-1280.webp');
  g.open(3);
  await g.fail(2);
  assert.equal(g.image.src, 'photo-2-1280.webp');
  g.open(3);
  g.close();
  const before = g.shown.slice();
  await g.load(3);
  assert.deepEqual(g.shown, before);
  assert.equal(g.attrs['aria-busy'], undefined);
});

test('lightbox starts chosen photo before speculative neighbors and upgrades high DPI afterwards', async () => {
  const g = lightbox({});
  g.context.window.devicePixelRatio = 2;
  g.open(1);
  assert.equal(g.requests[0].src, 'photo-1-1280.webp');
  assert.equal(g.requests[0].fetchPriority, 'high');
  assert.ok(g.requests.slice(1).every(image => image.fetchPriority === 'low'));
  await g.load(0);
  assert.equal(g.image.src, 'photo-1-1280.webp');
  const high = g.requests.findIndex(image => image.src === 'photo-1-1920.webp');
  assert.ok(high > 0);
  await g.load(high);
  assert.equal(g.image.src, 'photo-1-1920.webp');
});

test('lightbox handles empty and single-image galleries', async () => {
  const empty = lightbox(undefined, 0);
  empty.open(0);
  assert.equal(empty.requests.length, 0);
  const single = lightbox(undefined, 1);
  single.open(0);
  await single.load(0);
  assert.equal(single.image.src, 'photo-0-1280.webp');
});
