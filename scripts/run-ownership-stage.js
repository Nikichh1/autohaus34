"use strict";
const sync = require("../server/autohaus-sync");
sync.runOwnershipStaging().catch(function (error) {
  console.error(error && error.stack || error);
  process.exitCode = 1;
});
