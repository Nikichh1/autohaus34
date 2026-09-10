/* Local preview of the static site and its Vercel handlers. Loopback only. */
"use strict";
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const ROOT = path.resolve(__dirname, "..");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "application/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".svg": "image/svg+xml", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".woff2": "font/woff2" };
function createServer() {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://localhost");
      let pathname = decodeURIComponent(url.pathname);
      if (pathname === "/admin" || pathname === "/admin/") pathname = "/api/admin/page";
      if (pathname === "/") pathname = "/index.html";
      if (pathname.startsWith("/api/")) {
        const file = path.resolve(ROOT, "." + pathname + (pathname.endsWith(".js") ? "" : ".js"));
        if (!file.startsWith(ROOT + path.sep) || !fs.existsSync(file)) { res.writeHead(404).end(); return; }
        req.query = Object.fromEntries(url.searchParams);
        req.headers["x-forwarded-proto"] = "http";
        let raw = "";
        for await (const chunk of req) { raw += chunk; if (Buffer.byteLength(raw) > 2 * 1024 * 1024) { res.writeHead(413).end(); return; } }
        try { req.body = raw ? JSON.parse(raw) : {}; } catch (_) { res.writeHead(400).end(); return; }
        res.status = (status) => { res.statusCode = status; return res; };
        res.json = (body) => { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(body)); };
        await require(file)(req, res);
        return;
      }
      if (/^\/(?:server|tools|node_modules|\.git)(?:\/|$)/.test(pathname) || /\.(?:sql|md)$/.test(pathname)) { res.writeHead(404).end(); return; }
      const file = path.resolve(ROOT, "." + pathname);
      if (!file.startsWith(ROOT + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404).end(); return; }
      res.setHeader("Content-Type", TYPES[path.extname(file)] || "application/octet-stream");
      res.setHeader("Cache-Control", "no-store");
      fs.createReadStream(file).pipe(res);
    } catch (error) {
      console.error(error.message);
      if (!res.headersSent) res.writeHead(500);
      res.end("Preview request failed");
    }
  });
}
if (require.main === module) createServer().listen(Number(process.env.PORT || 3010), "127.0.0.1", () => console.log("AutoHaus preview: http://127.0.0.1:" + (process.env.PORT || 3010)));
module.exports = { createServer };
