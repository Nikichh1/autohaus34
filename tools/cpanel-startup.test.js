"use strict";
const { test } = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");

function boot(env, passenger) {
  const events = [], server = { listen: (...args) => events.push(["listen", ...args]), on() {}, close() {}, closeAllConnections() {} };
  const context = { process: { env, once() {} }, console: { log() {}, error() {} }, setTimeout,
    require: () => { events.push(["require"]); return { createServer: () => server }; } };
  if (passenger) context.PhusionPassenger = { configure: options => events.push(["configure", options]) };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../app.js"), "utf8"), context);
  return events;
}

test("Passenger configures one socket listener before loading the backend, even with a nonnumeric PORT", () => {
  const events = boot({ PORT: "passenger" }, true);
  assert.equal(events[0][0], "configure");
  assert.equal(events[0][1].autoInstall, false);
  const listens = events.filter(e => e[0] === "listen");
  assert.equal(listens.length, 1);
  assert.equal(listens[0][1], "passenger");
  assert.equal(typeof listens[0][2], "function");
});

test("standalone start respects a numeric PORT, binds loopback and rejects malformed ports", () => {
  const listen = boot({ PORT: "4189" }, false).find(e => e[0] === "listen");
  assert.equal(listen[1], 4189); assert.equal(listen[2], "127.0.0.1");
  assert.throws(() => boot({ PORT: "passenger" }, false), /Invalid PORT/);
});
