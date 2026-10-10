"use strict";
const fs = require("node:fs"), path = require("node:path");

function preparePublicRoot(directory) {
  fs.mkdirSync(directory, { recursive: true });
  const root = fs.realpathSync(directory);
  // Never remove or overwrite a Git checkout, an existing site or PHP app.
  for (const entry of fs.readdirSync(root)) {
    if (![".htaccess", ".well-known"].includes(entry)) throw new Error("Document root must be empty: found " + entry + ". Choose a new public directory");
  }
  const file = path.join(root, ".htaccess");
  if (fs.existsSync(file) && fs.lstatSync(file).isSymbolicLink()) throw new Error("Refusing a symlinked .htaccess");
  const before = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  const marker = "# BEGIN AUTOHAUS PUBLIC GUARD";
  const block = marker + "\nOptions -Indexes\n<IfModule mod_headers.c>\n  Header always set X-Content-Type-Options \"nosniff\"\n  <FilesMatch \"\\.(?:css|js|html)$\">\n    Header always set Cache-Control \"no-store\"\n  </FilesMatch>\n</IfModule>\n# END AUTOHAUS PUBLIC GUARD\n";
  if (!before.includes(marker)) fs.writeFileSync(file, before + (before.endsWith("\n") || !before ? "" : "\n") + block);
  return root;
}

if (require.main === module) {
  try {
    const root = preparePublicRoot(path.resolve(process.argv[2] || path.join(__dirname, "../public")));
    console.log("Public directory prepared: " + root);
    console.log("Set the autotest.autohaus.bg Document Root to this directory in cPanel Domains.");
    console.log("Keep Application root at the directory containing app.js. Save/Restart the Node.js app so cPanel generates its Passenger block here.");
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { preparePublicRoot };
