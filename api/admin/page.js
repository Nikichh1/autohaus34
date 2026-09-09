"use strict";

const { requireAdmin } = require("../../server/admin-lib");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.statusCode = 405;
    res.end("Method not allowed");
    return;
  }

  const user = await requireAdmin(req, res);
  if (!user) {
    res.statusCode = 302;
    res.setHeader("Location", "/admin/login.html");
    res.setHeader("Cache-Control", "no-store");
    res.end();
    return;
  }

  res.statusCode = 200;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  res.end(`<!doctype html>
<html lang="bg">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex,nofollow">
<meta name="theme-color" content="#171717">
<title>Auto House Admin</title>
<link rel="stylesheet" href="/admin/admin.css?v=20260909-admin1">
<link rel="stylesheet" href="/admin/mobile.css?v=20260909-mobile1">
</head>
<body class="ah-admin">
<div class="app-shell">
  <aside class="side">
    <a class="side__brand" href="/admin" aria-label="Auto House Admin">AUTO HOUSE <span>Admin</span></a>
    <nav class="side__nav" aria-label="Admin navigation">
      <button type="button" data-route="dashboard" class="is-on"><span class="nav-dot"></span>Начало</button>
      <button type="button" data-route="cars"><span class="nav-dot"></span>Автомобили</button>
      <button type="button" data-route="new"><span class="nav-plus">+</span>Добави</button>
    </nav>
    <div class="side__foot">
      <span class="side__user">${escapeHtml(user.email || "Admin")}</span>
      <button type="button" id="logout">Изход</button>
    </div>
  </aside>
  <header class="mobile-head">
    <a href="/admin">AUTO HOUSE <span>Admin</span></a>
    <button type="button" id="mobile-menu" aria-expanded="false">Меню</button>
  </header>
  <main class="workspace">
    <div id="admin-view" class="view" aria-live="polite"></div>
  </main>
</div>
<div class="toast" id="toast" role="status" aria-live="polite"></div>
<script src="/data/vehicles.base.js?v=fe83b016"></script>
<script src="/admin/admin-guards.js?v=20260909-admin1"></script>
<script src="/admin/ai-router.js?v=20260909-ai1"></script>
<script src="/admin/local-ai.js?v=20260909-local2"></script>
<script src="/admin/admin.js?v=20260909-admin1" defer></script>
<script src="/admin/mobile.js?v=20260909-mobile1" defer></script>
</body>
</html>`);
};

function escapeHtml(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
