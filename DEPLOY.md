# Deploying AutoHaus

The existing Vercel project deploys this repository. `vercel.json` sets `node build.js` as the build command and `dist` as the public output directory. Vercel discovers the Node handlers in `api/` and bundles the server helpers separately. The import handler explicitly includes the canonical inventory/equipment files; the Gemini handler has a 60-second execution allowance.

Before publishing:

```sh
node tools/check.js
node --test tools/backend.test.js
node build.js
```

Push the verified changes to the existing GitHub repository. Its connected Vercel project creates the deployment. No frontend framework conversion or external build service is needed.

## Service configuration

See [ADMIN.md](ADMIN.md) for the Supabase schema, active team roles, provisioned Supabase Storage and the server-only Gemini environment variable. No service credentials belong in Git. The public inventory bootstrap is deliberately empty; an outage never restores sold listings. Admin operations require the real services.

Email-provider setup is deferred. The direct vehicle inquiry form retains entered text and shows an honest error if delivery is unavailable.

## Ordinary static hosting

Vercel serves `/` and `/index.html` through the existing public function with `home=1`. The stamped `index.html` is bundled as its server template and is deliberately absent from `dist/`, so a static file cannot shadow the managed photo renderer. The homepage has a short CDN cache; the right images and preloads are present before the first paint.

For an explicitly static-only export, run `node -e "require('./build').build({staticHome:true})"` and upload the contents of `dist/`. Enable gzip/Brotli compression for text, use `Cache-Control: no-cache` for HTML, and serve versioned CSS/JavaScript with revalidation or long caching. Fonts and images can use a long cache lifetime. `_headers` contains rules for hosts that support it. This static-only export initially uses built-in photos and reconciles managed photos through the public settings request; the managed Vercel deployment is preferred.

Static hosting alone cannot serve the managed inventory. To use the managed admin, host the Node handlers on Vercel (or a Node-capable server) and reverse-proxy `/api/*` and `/admin` on the same origin. The protected `/admin` route must never be replaced by an unprotected static editor. Do not upload the repository root, `.env` files, SQL, `server/` or `tools/` to a public document directory.
