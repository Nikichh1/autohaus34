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

function gallery(count = 4) {
  const requests = [], writes = [], attributes = {};
  let content = '<picture>initial photo</picture>';
  const picture = {
    get innerHTML() { return content; },
    set innerHTML(value) { content = value; writes.push({ kind: 'preview', value }); },
    get outerHTML() { return content; },
    set outerHTML(value) { content = value; writes.push({ kind: 'full', value }); }
  };
  const number = { textContent: '1 / ' + count };
  const mainFrame = count ? {
    dataset: { i: '0' }, href: 'photo-0.jpg',
    setAttribute(key, value) { attributes[key] = value; },
    removeAttribute(key) { delete attributes[key]; },
    querySelector(selector) { return selector === 'picture' ? picture : number; }
  } : null;
  const thumbs = Array.from({ length: count > 1 ? count : 0 }, (_, index) => ({
    active: !index, attrs: { 'aria-pressed': String(!index) }, offsetLeft: 200 + index * 96, offsetWidth: 88,
    classList: { toggle(key, value) { thumbs[index].active = value; } },
    setAttribute(key, value) { this.attrs[key] = value; },
    querySelector() { return { complete: true, naturalWidth: 400, currentSrc: 'thumb-' + index + '.webp' }; }
  }));
  class Image {
    constructor() { requests.push(this); }
    decode() { return this.rejectDecode ? Promise.reject(new Error('Decode unavailable')) : Promise.resolve(); }
  }
  const context = vm.createContext({
    N: count, selected: 0, selectionVersion: 0, decoded: Object.create(null), Image,
    mainFrame, thumbs, thumbRail: { offsetLeft: 200, scrollLeft: 0, clientWidth: 180 }, nEl: { textContent: '' },
    shots: Array.from({ length: count }, (_, index) => 'photo-' + index + '.jpg'),
    v: { full: 'Test vehicle' }, mainSizes: '46vw',
    AH: { esc: escape, img: (shot, width) => shot + '?width=' + width, webpset: shot => shot + '.webp 800w',
      picture: shot => '<picture data-shot="' + shot + '">full image</picture>' }
  });
  vm.runInContext(rendererFunction('prepare') + '\n' + rendererFunction('stripTo'), context);
  return { context, requests, writes, attributes, picture, mainFrame, thumbs,
    select(index) { context.stripTo(index); },
    async load(index) { requests[index].onload(); await new Promise(setImmediate); },
    async fail(index) { requests[index].onerror(); await new Promise(setImmediate); }
  };
}

test('repeated selection while decoding retains the pending full-resolution update', async () => {
  const g = gallery();
  g.select(2);
  assert.match(g.picture.innerHTML, /thumb-2.webp/);
  assert.equal(g.attributes['aria-busy'], 'true');
  g.select(2);
  assert.equal(g.requests.length, 1);
  await g.load(0);
  assert.match(g.picture.outerHTML, /data-shot="photo-2.jpg"/);
  assert.equal(g.attributes['aria-busy'], undefined);
  assert.equal(g.thumbs.filter(thumb => thumb.active).length, 1);
  assert.equal(g.thumbs[2].attrs['aria-pressed'], 'true');
  assert.equal(g.context.nEl.textContent, '3 / 4');
});

test('out-of-order image completion never replaces the latest selected photo', async () => {
  const g = gallery();
  g.select(1);
  g.select(2);
  await g.load(1);
  await g.load(0);
  assert.match(g.picture.outerHTML, /data-shot="photo-2.jpg"/);
  assert.deepEqual(g.writes.filter(write => write.kind === 'full').map(write => write.value), ['<picture data-shot="photo-2.jpg">full image</picture>']);
  assert.equal(g.mainFrame.dataset.i, '2');
  assert.equal(g.attributes['aria-busy'], undefined);
});

test('failed image preserves the visible thumbnail and permits a later retry', async () => {
  const g = gallery();
  g.select(1);
  await g.fail(0);
  assert.match(g.picture.innerHTML, /thumb-1.webp/);
  assert.equal(g.attributes['aria-busy'], undefined);
  assert.equal(g.writes.filter(write => write.kind === 'full').length, 0);
  assert.equal(g.context.decoded[1], undefined);
  g.select(2);
  g.select(1);
  assert.equal(g.requests.length, 3);
  await g.load(2);
  assert.match(g.picture.outerHTML, /data-shot="photo-1.jpg"/);
});

test('a successful image load still displays when optional decode rejects', async () => {
  const g = gallery();
  g.select(1);
  g.requests[0].rejectDecode = true;
  await g.load(0);
  assert.match(g.picture.outerHTML, /data-shot="photo-1.jpg"/);
  assert.equal(g.attributes['aria-busy'], undefined);
});

test('gallery wraps selection, reveals the selected thumbnail and handles 0/1 photos', async () => {
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
