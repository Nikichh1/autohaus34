"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const net = require("node:net");
const { verifyBuild } = require("./build-info");

const ROOT = path.resolve(__dirname, "..");
const MAX_BODY_BYTES = 2 * 1024 * 1024;
const ROUTES = Object.freeze({
  "/api/public/vehicles": "public/vehicles",
  "/api/admin/auth": "admin/auth",
  "/api/admin/page": "admin/page",
  "/api/admin/vehicles": "admin/vehicles",
  "/api/admin/settings": "admin/vehicles",
  "/api/admin/images": "admin/images",
  "/api/admin/site-media": "admin/site-media",
  "/api/admin/description": "admin/description",
  "/api/admin/team": "admin/team",
  "/api/admin/analytics": "admin/analytics",
  "/api/inquiry": "inquiry",
  "/api/sitemap": "sitemap",
  "/api/robots": "robots"
});
const TYPES = Object.freeze({
  ".html": "text/html; charset=utf-8", ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".avif": "image/avif",
  ".ico": "image/x-icon", ".woff": "font/woff", ".woff2": "font/woff2"
});
const ADMIN_CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https://res.cloudinary.com https://autohaus.bg https://ajoiqomflplhadyhxvfe.supabase.co blob: data:; connect-src 'self' https://api.cloudinary.com https://ajoiqomflplhadyhxvfe.supabase.co https://ajoiqomflplhadyhxvfe.storage.supabase.co; base-uri 'self'; frame-ancestors 'none'; form-action 'self'";

function inside(root, file) {
  const relative = path.relative(root, file);
  return relative !== "" && !relative.startsWith(".." + path.sep) && relative !== ".." && !path.isAbsolute(relative);
}

function reply(res, status, error) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify({ ok: false, error }));
}

function originConfiguration(value, production, aliases = "") {
  if (!value && production) throw new Error("Set PUBLIC_ORIGIN to the HTTPS application URL in cPanel");
  if (!value) return { origin: null, hosts: new Set() };
  let origin;
  try { origin = new URL(value); } catch (_) { throw new Error("Invalid PUBLIC_ORIGIN"); }
  if (!/^https?:$/.test(origin.protocol) || origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash || (production && origin.protocol !== "https:")) {
    throw new Error("PUBLIC_ORIGIN must be an HTTPS origin without a path in production");
  }
  const hosts = new Set([origin.host.toLowerCase()]);
  for (const host of String(aliases).split(",").map(s => s.trim().toLowerCase()).filter(Boolean)) {
    if (!/^[a-z0-9.-]+(?::\d{1,5})?$/.test(host)) throw new Error("Invalid ALLOWED_HOSTS");
    hosts.add(host);
  }
  return { origin, hosts };
}

function requestPath(req) {
  const raw = String(req.url || "").split("?")[0];
  if (!raw.startsWith("/") || raw.startsWith("//")) throw new Error("Invalid URL");
  const pathname = decodeURIComponent(raw);
  if (/[\\\u0000-\u001f\u007f]/.test(pathname)) throw new Error("Invalid URL");
  // No hidden files, dot traversal, or Windows alternate data streams.
  if (pathname.split("/").some(part => part.startsWith(".") || part.includes(":"))) return null;
  return pathname;
}

function securityHeaders(res, pathname, production) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(self), microphone=(), geolocation=(), payment=()");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("X-Permitted-Cross-Domain-Policies", "none");
  res.setHeader("X-DNS-Prefetch-Control", "off");
  // Do not change the HTTPS policy of unrelated PHP/mail subdomains.
  if (production) res.setHeader("Strict-Transport-Security", "max-age=31536000");
  if (/^\/(?:admin(?:\/|$)|api\/admin\/)/.test(pathname)) {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Robots-Tag", "noindex, nofollow");
    res.setHeader("Content-Security-Policy", ADMIN_CSP);
  } else if (pathname.startsWith("/api/")) {
    res.setHeader("X-Robots-Tag", "noindex, nofollow, nosnippet");
  }
}

function forwardedIp(req, trustProxy) {
  const peer = req.socket.remoteAddress || "";
  if (trustProxy) {
    // A trusted front proxy must append the actual peer; do not take the
    // spoofable left-most client-supplied X-Forwarded-For value.
    const addresses = String(req.headers["x-forwarded-for"] || "").split(",").map(s => s.trim());
    const last = addresses.at(-1);
    if (net.isIP(last)) return last;
  }
  return peer || "unknown";
}

async function bodyFor(req) {
  const length = Number(req.headers["content-length"] || 0);
  if (length > MAX_BODY_BYTES) { req.resume(); return { status: 413, error: "Request too large" }; }
  let size = 0;
  const chunks = [];
  for await (const chunk of req.iterator({ destroyOnReturn: false })) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      req.resume();
      return { status: 413, error: "Request too large" };
    }
    chunks.push(chunk);
  }
  if (!size) return { body: {} };
  if (!/^application\/json(?:\s*;|$)/i.test(String(req.headers["content-type"] || ""))) {
    return { status: 415, error: "JSON request required" };
  }
  try {
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Invalid body");
    return { body };
  } catch (_) { return { status: 400, error: "Invalid JSON body" }; }
}

function encodings(value) {
  const qualities = new Map();
  for (const token of String(value || "").toLowerCase().split(",")) {
    const [name, ...parameters] = token.trim().split(";");
    if (!name) continue;
    const q = parameters.map(s => s.trim()).find(s => s.startsWith("q="));
    const quality = q === undefined ? 1 : Number(q.slice(2));
    qualities.set(name, Number.isFinite(quality) && quality >= 0 && quality <= 1 ? quality : 0);
  }
  return ["br", "gzip"].map(name => ({ name, quality: qualities.get(name) ?? qualities.get("*") ?? 0 }))
    .filter(item => item.quality > 0).sort((a, b) => b.quality - a.quality);
}

function regularFile(root, file) {
  if (!inside(root, file)) return null;
  try {
    if (!inside(root, fs.realpathSync(file))) return null;
    const stat = fs.statSync(file);
    return stat.isFile() ? stat : null;
  } catch (error) {
    if (["ENOENT", "ENOTDIR", "EACCES"].includes(error.code)) return null;
    throw error;
  }
}

function staticResponse(req, res, publicRoot, pathname, query) {
  if (!["GET", "HEAD"].includes(req.method)) { res.setHeader("Allow", "GET, HEAD"); return reply(res, 405, "Method not allowed"); }
  const type = TYPES[path.extname(pathname).toLowerCase()];
  if (!type) return reply(res, 404, "Not found");
  const file = path.resolve(publicRoot, "." + pathname);
  const stat = regularFile(publicRoot, file);
  if (!stat) return reply(res, 404, "Not found");
  let target = file, selected = stat, encoding = "";
  if (/\.(?:html|js|css|svg)$/.test(pathname)) {
    res.setHeader("Vary", "Accept-Encoding");
    for (const candidate of encodings(req.headers["accept-encoding"])) {
      const compressed = file + (candidate.name === "br" ? ".br" : ".gz");
      const compressedStat = regularFile(publicRoot, compressed);
      if (compressedStat) { target = compressed; selected = compressedStat; encoding = candidate.name; break; }
    }
  }
  res.setHeader("Content-Type", type);
  const privateAsset = pathname.startsWith("/admin/");
  const versioned = /^[a-f0-9]{12,64}$/.test(query.get("v") || "");
  res.setHeader("Cache-Control", privateAsset || pathname.endsWith(".html") ? "no-cache, max-age=0, must-revalidate" :
    versioned ? "public, max-age=31536000, immutable" : /\.(?:woff2?|jpg|jpeg|png|webp|avif|ico)$/.test(pathname) ? "public, max-age=604800" : "no-cache");
  const etag = '"' + selected.size.toString(16) + "-" + Math.trunc(selected.mtimeMs).toString(16) + "-" + encoding + '"';
  res.setHeader("ETag", etag);
  res.setHeader("Last-Modified", stat.mtime.toUTCString());
  if (encoding) res.setHeader("Content-Encoding", encoding);
  if (String(req.headers["if-none-match"] || "").split(/\s*,\s*/).some(tag => tag === etag || tag === "*" || tag === "W/" + etag)) {
    res.statusCode = 304;
    return res.end();
  }
  res.setHeader("Content-Length", selected.size);
  if (req.method === "HEAD") return res.end();
  const stream = fs.createReadStream(target);
  stream.on("error", () => res.destroy());
  res.on("close", () => stream.destroy());
  stream.pipe(res);
}

function createServer(options = {}) {
  const root = fs.realpathSync(path.resolve(options.root || ROOT));
  if (!fs.existsSync(path.join(root, "dist"))) throw new Error("Run npm run build before starting AutoHaus");
  const publicRoot = fs.realpathSync(path.join(root, "dist"));
  if (!inside(root, publicRoot) || !fs.existsSync(path.join(publicRoot, "vehicle.html"))) throw new Error("Run npm run build before starting AutoHaus");
  const production = options.production ?? process.env.NODE_ENV === "production";
  const buildInfo = options.verifyBuild === false ? null : verifyBuild(root, production);
  const { origin, hosts } = originConfiguration(options.origin ?? process.env.PUBLIC_ORIGIN, production, options.allowedHosts ?? process.env.ALLOWED_HOSTS);
  const trustProxy = options.trustProxy ?? process.env.TRUST_PROXY === "1";
  const handlerFor = options.handlerFor || (name => require(path.join(root, "api", name + ".js")));

  const server = http.createServer({ maxHeaderSize: 16384 }, async (req, res) => {
    try {
      const pathname = requestPath(req);
      securityHeaders(res, pathname || "", production);
      if (buildInfo) res.setHeader("X-AutoHaus-Build", buildInfo.buildId);
      if (pathname === null) return reply(res, 404, "Not found");
      const host = String(req.headers.host || "").toLowerCase();
      if (!host || !/^[a-z0-9.:[\]-]+$/.test(host) || (hosts.size && !hosts.has(host))) return reply(res, 400, "Invalid host");
      req.headers["x-forwarded-for"] = forwardedIp(req, trustProxy);
      req.headers["x-forwarded-host"] = origin ? origin.host : host;
      // The public cPanel URL must be HTTPS; TLS terminates at Apache/LiteSpeed.
      req.headers["x-forwarded-proto"] = production || req.socket.encrypted ? "https" : "http";
      const url = new URL(req.url, "http://localhost");
      req.query = Object.fromEntries(url.searchParams);
      if (pathname === "/healthz") {
        if (!["GET", "HEAD"].includes(req.method)) { res.setHeader("Allow", "GET, HEAD"); return reply(res, 405, "Method not allowed"); }
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.setHeader("Cache-Control", "no-store");
        return res.end(JSON.stringify(buildInfo
          ? { ok: true, buildId: buildInfo.buildId, sourceRevision: buildInfo.sourceRevision }
          : { ok: true }));
      }
      let name = ROUTES[pathname];
      if (pathname === "/" || pathname === "/index.html") { name = "public/vehicles"; req.query.home = "1"; }
      else if (pathname === "/admin" || pathname === "/admin/") name = "admin/page";
      else if (pathname === "/sitemap.xml") name = "sitemap";
      else if (pathname === "/robots.txt") name = "robots";
      else if (pathname === "/api/admin/settings") req.query.action = "settings";
      if (name) {
        if (req.method === "HEAD") req.method = "GET";
        const parsed = await bodyFor(req);
        if (parsed.status) return reply(res, parsed.status, parsed.error);
        req.body = parsed.body;
        res.status = code => { res.statusCode = code; return res; };
        res.json = body => { res.setHeader("Content-Type", "application/json; charset=utf-8"); res.end(JSON.stringify(body)); return res; };
        return await handlerFor(name)(req, res);
      }
      if (pathname.startsWith("/api/")) return reply(res, 404, "Not found");
      return staticResponse(req, res, publicRoot, pathname, url.searchParams);
    } catch (error) {
      if (res.writableEnded || res.destroyed) return;
      if (error instanceof URIError || error.message === "Invalid URL") return reply(res, 400, "Invalid URL");
      console.error("AutoHaus request failed:", error.name);
      if (res.headersSent) return res.destroy();
      return reply(res, 500, "Request failed");
    }
  });
  server.requestTimeout = 120000;
  server.headersTimeout = 15000;
  server.keepAliveTimeout = 5000;
  return server;
}

module.exports = { createServer, ROUTES, MAX_BODY_BYTES, inside, encodings, originConfiguration };
