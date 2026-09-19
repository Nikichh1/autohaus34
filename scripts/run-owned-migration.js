"use strict";
const migration = require("../api/migrate-owned");
migration.runOwnershipMigration().catch(function (error) {
  console.error(error && error.stack || error);
  process.exitCode = 1;
});
