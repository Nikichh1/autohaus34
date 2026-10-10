/* Optional browser QA. Requires Playwright/Chromium; all data and writes are
   isolated in ui-fixture-server.js. No production login or provider requests. */
"use strict";
const fs = require("node:fs"), path = require("node:path"), net = require("node:net");
const crypto = require("node:crypto"), assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { chromium } = require("playwright");
const ROOT = path.resolve(__dirname, "..");

async function startFixture(root, platform) {
  const probe = net.createServer();
  await new Promise(resolve => probe.listen(0, "127.0.0.1", resolve));
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  const child = spawn(process.execPath, [path.join(root, "tools/ui-fixture-server.js")], {
    cwd: root, env: { ...process.env, PORT: String(port), AH_UI_PLATFORM: platform }, stdio: ["ignore", "pipe", "inherit"]
  });
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { child.kill(); reject(new Error("UI fixture startup timed out")); }, 15000);
    child.once("error", reject);
    child.once("exit", code => { clearTimeout(timeout); reject(new Error("UI fixture exited: " + code)); });
    child.stdout.on("data", bytes => { if (String(bytes).includes("Isolated UI test fixture:")) { clearTimeout(timeout); resolve(); } });
  });
  return { child, origin: "http://127.0.0.1:" + port };
}

async function capture(browser, origin, viewport, route, destination) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, reducedMotion: "reduce", locale: "bg-BG" });
  try {
    const page = await context.newPage(), errors = [];
    await page.route("**/*", request => {
      const url = new URL(request.request().url());
      return url.origin === origin || ["data:", "blob:"].includes(url.protocol) ? request.continue() : request.abort();
    });
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(origin + route, { waitUntil: "networkidle" });
    await page.locator("#admin-view h1").waitFor();
    await page.addStyleTag({ content: "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}" });
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all(Array.from(document.images).filter(image => image.complete).map(image => image.decode().catch(() => {})));
    });
    const metrics = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
    assert.ok(metrics.scroll <= metrics.width + 1, route + " overflows at " + viewport.width + "px");
    assert.deepEqual(errors, [], route + " JavaScript errors");
    const bytes = await page.screenshot({ path: destination, animations: "disabled" });
    return crypto.createHash("sha256").update(bytes).digest("hex");
  } finally { await context.close(); }
}

async function main() {
  const args = process.argv.slice(2), index = args.indexOf("--reference");
  const reference = index >= 0 ? path.resolve(args[index + 1]) : null;
  const output = path.join(ROOT, "artifacts/ui"); fs.mkdirSync(output, { recursive: true });
  const fixtures = []; let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const current = await startFixture(ROOT, "cpanel"); fixtures.push(current);
    const baseline = reference ? await startFixture(reference, "source") : null;
    if (baseline) fixtures.push(baseline);
    let count = 0;
    for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 },
      { width: 673, height: 841 }, { width: 690, height: 829 }, { width: 744, height: 900 }, { width: 768, height: 896 }]) {
      for (const view of ["dashboard", "cars", "settings", "new"]) {
        const name = view + "-" + viewport.width, route = "/admin#" + view;
        const actual = await capture(browser, current.origin, viewport, route, path.join(output, name + ".png"));
        if (baseline) {
          const expected = await capture(browser, baseline.origin, viewport, route, path.join(output, name + "-reference.png"));
          assert.equal(actual, expected, name + " must match the approved admin screenshot");
        }
        count++;
      }
    }
    console.log("PASS: " + count + " admin views across desktop, phone and Fold widths" + (baseline ? "; exact screenshot parity with approved reference" : ""));
  } finally {
    for (const fixture of fixtures) fixture.child.kill("SIGTERM");
    if (browser) await browser.close();
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
