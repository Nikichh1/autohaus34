"use strict";
const fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");

const hash = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
const ADMIN_INPUTS = ["admin/admin-base.css", "admin/brand.css", "admin/brand-fallback.css"];

function writeBuildInfo(root, versions) {
  const files = {};
  for (const file of [...versions.keys()].map(file => "dist/" + file).concat([
    "index.html", "api/admin/page.js", "dist/vehicle.html", "dist/admin/login.html"
  ]).sort()) {
    if (fs.existsSync(path.join(root, file))) files[file] = hash(fs.readFileSync(path.join(root, file)));
  }
  const inputs = {};
  for (const file of ADMIN_INPUTS) inputs[file] = hash(fs.readFileSync(path.join(root, file)));
  let sourceRevision = null;
  try {
    const value = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    if (/^[a-f0-9]{40}$/.test(value)) sourceRevision = value;
  } catch (_) {}
  const info = { schema: 1, buildId: hash(JSON.stringify({ files, inputs })).slice(0, 16), sourceRevision, files, inputs };
  fs.writeFileSync(path.join(root, "build-info.json"), JSON.stringify(info, null, 2) + "\n");
  return info;
}

function verifyBuild(root, required = true) {
  const file = path.join(root, "build-info.json");
  if (!fs.existsSync(file) && !required) return null;
  if (!fs.existsSync(file)) throw new Error("Missing build-info.json: run node tools/cpanel-build.js in the application root");
  const info = JSON.parse(fs.readFileSync(file, "utf8"));
  if (info.schema !== 1 || !/^[a-f0-9]{16}$/.test(info.buildId) || !info.files || !info.inputs) throw new Error("Invalid build metadata: rebuild AutoHaus");
  for (const [relative, expected] of Object.entries(info.files).concat(Object.entries(info.inputs))) {
    // Runtime archives omit the private CSS inputs; Git deployments retain them.
    if (ADMIN_INPUTS.includes(relative) && !fs.existsSync(path.join(root, relative))) continue;
    const target = path.resolve(root, relative);
    if (!target.startsWith(root + path.sep) || !/^[a-f0-9]{64}$/.test(expected) ||
        !fs.existsSync(target) || !fs.realpathSync(target).startsWith(root + path.sep) ||
        hash(fs.readFileSync(target)) !== expected) {
      throw new Error("Stale or missing build file: " + relative + ". Run node tools/cpanel-build.js before Restart");
    }
  }
  return info;
}

module.exports = { writeBuildInfo, verifyBuild };
