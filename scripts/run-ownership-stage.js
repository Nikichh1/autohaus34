"use strict";
// retry after migration-prefix SELECT policy

const DIAG_URL = "https://ajoiqomflplhadyhxvfe.supabase.co/rest/v1/autohaus_migration_diagnostics";
const DIAG_KEY = "sb_publishable_gBEUBrOjT_JsBRjAnGL9PQ_ra-1hY0g";

async function record(error) {
  const message = String(error && (error.stack || error.message) || error || "Unknown migration error").slice(0, 12000);
  try {
    await fetch(DIAG_URL, {
      method: "POST",
      headers: {
        apikey: DIAG_KEY,
        "Content-Type": "application/json",
        Prefer: "return=minimal"
      },
      body: JSON.stringify({ message })
    });
  } catch (_) {}
  console.error(message);
}

(async function () {
  try {
    const sync = require("../server/autohaus-sync");
    await sync.runOwnershipStaging();
  } catch (error) {
    await record(error);
    process.exitCode = 1;
  }
})();
