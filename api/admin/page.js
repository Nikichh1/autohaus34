"use strict";
const { requireAdmin } = require("../../server/admin-lib");
module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https://res.cloudinary.com https://autohaus.bg https://ajoiqomflplhadyhxvfe.supabase.co blob: data:; connect-src 'self' https://ajoiqomflplhadyhxvfe.supabase.co https://ajoiqomflplhadyhxvfe.storage.supabase.co; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");
  if (req.method !== "GET") { res.statusCode = 405; res.setHeader("Allow", "GET"); res.end("Method not allowed"); return; }
  const user = await requireAdmin(req, res);
  if (!user) { res.statusCode = 302; res.setHeader("Location", "/admin/login.html"); res.end(); return; }
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(`<!doctype html>
<html lang="bg"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex,nofollow"><meta name="theme-color" content="#17191a">
<title>AutoHaus Admin</title><link rel="icon" href="/favicon.jpg">
<link rel="stylesheet" href="/admin/admin.css?v=74ee3b04"><script defer src="/admin/storage-compat.js?v=1"></script><script defer src="/admin/admin.js?v=74ee3b04"></script><script defer src="/admin/sync.js?v=1"></script></head>
<body class="ah-admin" data-admin-user="${escapeHtml(user.id)}">
<a class="skip-link" href="#admin-view" data-bg="Към съдържанието" data-en="Skip to content">Към съдържанието</a>
<div class="app-shell">
<button type="button" id="menu-backdrop" class="menu-backdrop" aria-label="Close menu" hidden></button>
<aside class="side" id="admin-navigation">
<a class="side__brand" href="/admin" aria-label="AutoHaus Admin"><img src="/autohaus.svg" width="482" height="85" alt="AutoHaus"><span class="side__brand-tag">ADMIN</span></a>
<nav class="side__nav" aria-label="Admin">
<button type="button" data-route="dashboard" data-bg="Начало" data-en="Overview">Начало</button>
<button type="button" data-route="cars" data-bg="Автомобили" data-en="Cars">Автомобили</button>
<button type="button" data-route="new" data-bg="+ Добави автомобил" data-en="+ Add car">+ Добави автомобил</button>
<button type="button" id="sync-autohaus" data-bg="↻ Синхронизирай AutoHaus" data-en="↻ Sync AutoHaus">↻ Синхронизирай AutoHaus</button>
</nav>
<div class="side__foot"><div class="admin-language" aria-label="Language"><button data-language="bg" type="button">BG</button><button data-language="en" type="button">EN</button></div>
<a class="site-link" href="/" target="_blank" rel="noopener" data-bg="Виж сайта ↗" data-en="View website ↗">Виж сайта ↗</a>
<span class="side__user">${escapeHtml(user.email)}</span><button type="button" id="logout" data-bg="Изход" data-en="Sign out">Изход</button></div></aside>
<header class="mobile-head"><a href="/admin" aria-label="AutoHaus Admin"><img src="/autohaus.svg" width="482" height="85" alt="AutoHaus"><span class="mobile-brand__tag">ADMIN</span></a><button type="button" id="mobile-menu" aria-controls="admin-navigation" aria-expanded="false" data-bg="Меню" data-en="Menu">Меню</button></header>
<main class="workspace"><div id="auth-notice" class="auth-notice" role="alert" hidden></div><div id="admin-view" class="view" tabindex="-1"></div></main>
</div><div class="toast" id="toast" role="status" aria-live="polite"></div></body></html>`);
};
function escapeHtml(value) { return String(value || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;"); }
