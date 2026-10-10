"use strict";
const fs = require("node:fs"), path = require("node:path");
const { spawnSync } = require("node:child_process");
// Optional database/image tooling is not a production dependency. These
// suites are separately invoked with test:database or the existing image QA.
const optional = new Set(["schema.test.js", "security.test.js", "homepage-media-migration.test.js", "wall-settings-migration.test.js", "public-cleanup.test.js"]);
const tests = fs.readdirSync(__dirname).filter(file => file.endsWith(".test.js") && !optional.has(file)).sort().map(file => path.join(__dirname, file));
const result = spawnSync(process.execPath, ["--test", ...tests], { stdio: "inherit" });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
