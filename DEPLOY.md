# Deploying AutoHaus

Two things to do. The first one matters more than every code change in the
repository put together.

---

## 1. Turn on compression. This is not optional.

Every file this site serves is text — HTML, CSS, JavaScript, SVG — and text
compresses about 4:1 with gzip and better with brotli. Measured on a
simulated 1.6 Mbps connection with 300 ms of latency, which is an ordinary
phone on a bad signal:

| | uncompressed | brotli |
|---|---|---|
| First paint, landing page | **4008 ms** | **1796 ms** |
| `style.min.css` on the wire | 108 KB | **18 KB** |
| `catalog.min.css` on the wire | 37 KB | **6 KB** |

Nothing else in this repository is worth 2.2 seconds. If you change one
thing, change this.

Netlify, Vercel and Cloudflare Pages do it automatically — you have nothing
to do. A plain nginx or Apache box usually does **not** compress by default.

**nginx** — in the `http` block:

```nginx
gzip              on;
gzip_vary         on;
gzip_comp_level   6;
gzip_min_length   1024;
gzip_types        text/css application/javascript image/svg+xml application/json;

# if ngx_brotli is built in, better again
brotli            on;
brotli_comp_level 6;
brotli_types      text/css application/javascript image/svg+xml application/json;
```

**Apache** — in `.htaccess` or the vhost:

```apache
<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/html text/css application/javascript image/svg+xml
</IfModule>
```

Do **not** compress `.woff2` or the photographs — they are already
compressed, and running them through gzip costs CPU to make them very
slightly larger.

---

## 2. Cache the assets forever, never the HTML.

`build.js` stamps every asset URL with `?v=<hash of its contents>`. Change a
file, its hash changes, its URL changes, and every browser fetches it once.
Nothing changes, nothing is re-fetched. That only works if you actually let
them cache it.

`_headers` in this repo already says this for Netlify and Cloudflare Pages.
For nginx:

```nginx
location ~* \.(css|js|woff2|webp|jpg|jpeg|png|svg)$ {
  add_header Cache-Control "public, max-age=31536000, immutable";
}
location ~* \.html$ {
  add_header Cache-Control "no-cache";
}
```

For Apache:

```apache
<FilesMatch "\.(css|js|woff2|webp|jpg|jpeg|png|svg)$">
  Header set Cache-Control "public, max-age=31536000, immutable"
</FilesMatch>
<FilesMatch "\.html$">
  Header set Cache-Control "no-cache"
</FilesMatch>
```

`no-cache` on HTML does not mean "do not cache" — it means "revalidate
first". The browser keeps its copy and asks if it is still good, which costs
one small round trip and means a deploy is visible immediately.

---

## Before you deploy

```bash
node build.js
```

Run it after editing any `.css` or `.js`. It regenerates `style.min.css` and
`catalog.min.css` from the authored sources and re-stamps the version hash
into all four pages. It touches no source file. If you forget, the site
still works — it just keeps serving the previous stylesheet.

## What must ship

Everything except the working files: `*.html`, `*.min.css`, all `.js`,
`data/`, `img/`, `fonts/`, `favicon.svg`, `_headers`.

`style.css` and `catalog.css` are the *sources* — the browser never asks for
them, because the pages reference the `.min` copies. Ship them anyway if you
like (they are the documentation), or leave them out; nothing breaks either
way.
