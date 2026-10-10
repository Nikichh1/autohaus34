"use strict";
const { test } = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const { preparePublicRoot } = require("./cpanel-public-root");
const { checkDocumentRoot } = require("./cpanel-doctor");

test("public-root preparation preserves Passenger settings, is repeatable, and refuses an existing website", t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "autohaus-public-root-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const pub = path.join(root, "public"); fs.mkdirSync(pub);
  const managed = "# CLOUDLINUX MANAGED\nPassengerAppRoot /home/example/app\nPassengerStartupFile app.js\n";
  fs.writeFileSync(path.join(pub, ".htaccess"), managed);
  preparePublicRoot(pub);
  const first = fs.readFileSync(path.join(pub, ".htaccess"), "utf8");
  assert.ok(first.startsWith(managed));
  preparePublicRoot(pub);
  assert.equal(fs.readFileSync(path.join(pub, ".htaccess"), "utf8"), first);
  assert.equal(checkDocumentRoot(root, pub), fs.realpathSync(pub));
  assert.throws(() => checkDocumentRoot(root, root), /empty public directory/);
  fs.writeFileSync(path.join(pub, "index.html"), "EXISTING_WEBSITE");
  assert.throws(() => preparePublicRoot(pub), /Document root must be empty/);
  assert.equal(fs.readFileSync(path.join(pub, "index.html"), "utf8"), "EXISTING_WEBSITE");
  assert.throws(() => checkDocumentRoot(root, pub), /shadow Passenger/);
});
