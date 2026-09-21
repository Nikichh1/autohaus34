'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../admin/notes-translation.js'), 'utf8');
const flush = () => new Promise(setImmediate);
function harness(fetch) {
  const timers = new Map();
  let id = 0;
  const context = {
    window: { fetch }, URL, AbortController,
    location: { href: 'https://autohaus.test/admin', origin: 'https://autohaus.test' },
    localStorage: { getItem: () => null, setItem() {} },
    document: { documentElement: {}, readyState: 'loading', addEventListener() {},
      querySelector: () => null, getElementById: () => null },
    MutationObserver: class { observe() {} },
    setTimeout(fn, delay) { timers.set(++id, { fn, delay }); return id; },
    clearTimeout(key) { timers.delete(key); }
  };
  vm.runInNewContext(source.replace('  loadCache();',
    '  window.testTranslation = { translateList, bindPairByElements, seedLineCache }; loadCache();'), context);
  return {
    ...context.window, timers,
    async run(delay) {
      const entry = [...timers].find(([, timer]) => timer.delay === delay);
      assert.ok(entry, 'expected timer ' + delay);
      timers.delete(entry[0]); entry[1].fn(); await flush();
    }
  };
}
const response = (lines, pending = false) => Promise.resolve({
  ok: true, json: async () => ({ ok: true, lines, pending, retry_after_ms: 3500 })
});
const write = { method: 'POST', body: JSON.stringify({ notes: [], equipment_bg: ['Камера'] }) };

test('failed vehicle POST is never retried after successful translation', async () => {
  let saves = 0;
  const h = harness((url, init) => {
    if (url.includes('description')) return response(['Camera']);
    saves++;
    assert.deepEqual(JSON.parse(init.body).equipment_en, ['Camera']);
    return Promise.reject(new Error('connection lost'));
  });
  await assert.rejects(h.fetch('/api/admin/vehicles', write), /connection lost/);
  assert.equal(saves, 1);
});

test('pending translation blocks writes instead of storing Bulgarian as English', async () => {
  let saves = 0;
  const h = harness(url => {
    if (url.includes('description')) return response(['Камера'], true);
    saves++; return response([]);
  });
  await assert.rejects(h.fetch('/api/admin/vehicles', write), { code: 'TRANSLATION_UNAVAILABLE' });
  assert.equal(saves, 0);
});

test('saved line pairs reuse cache and avoid unnecessary translation requests', async () => {
  let requests = 0;
  const h = harness((url, init) => { requests++; return response([]); });
  h.testTranslation.seedLineCache('Камера', 'Camera');
  await h.fetch('/api/admin/vehicles', write);
  assert.equal(requests, 1);
});

function pair(recovered = false) {
  const listeners = {};
  return {
    source: { value: 'Камера', dataset: {}, isConnected: true,
      closest: () => ({ dataset: { recovered: recovered ? '1' : '0' } }),
      addEventListener: (name, fn) => { listeners[name] = fn; } },
    target: { value: recovered ? 'Old translation' : '' }, listeners
  };
}

test('failed previews preserve English, retry twice and stop after disconnection', async () => {
  let requests = 0;
  const h = harness(() => { requests++; return response(['Камера'], true); });
  const p = pair(true);
  h.testTranslation.bindPairByElements(p.source, p.target, 'equipment');
  await h.run(0); await h.run(3500); await h.run(3500);
  assert.equal(requests, 3);
  assert.equal(p.target.value, 'Old translation');
  assert.equal(h.timers.size, 0);
  p.listeners.input(); p.source.isConnected = false;
  await h.run(260);
  assert.equal(requests, 3);
});

test('old translation completion cannot overwrite newer input during debounce', async () => {
  let finish;
  const h = harness(() => new Promise(resolve => { finish = resolve; }));
  const p = pair();
  h.testTranslation.bindPairByElements(p.source, p.target, 'equipment');
  await h.run(0);
  p.source.value = 'Седалки'; p.listeners.input();
  finish(await response(['Camera'])); await flush();
  assert.equal(p.target.value, '');
});

test('stalled provider aborts within the bounded timeout and releases pending entry', async () => {
  let signal, requests = 0;
  const h = harness((url, init) => { requests++; signal = init.signal; return new Promise(() => {}); });
  const result = h.testTranslation.translateList(['Камера']);
  await h.run(12000);
  assert.equal((await result).pending, true);
  assert.equal(signal.aborted, true);
  const retry = h.testTranslation.translateList(['Камера']);
  await h.run(12000); await retry;
  assert.equal(requests, 2);
});
