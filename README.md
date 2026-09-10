# AutoHaus

The existing AutoHaus public website, in Bulgarian and English, with a phone-first inventory admin. The public design keeps the original Exo 2 typography, gold accents, dark landing page and light vehicle pages.

## Run and check

Node.js 22 or later is sufficient; the deployed application has no package dependencies.

```sh
node build.js
node tools/check.js
node --test tools/backend.test.js
node tools/dev-server.js
```

Open `http://127.0.0.1:3010`. This preview runs the actual API handlers, so `/admin` requires configured Supabase authentication. Service environment variables are described in [ADMIN.md](ADMIN.md).

`build.js` regenerates the minified CSS, updates asset versions and produces `dist/` containing browser assets only. Backend code, credentials, SQL and tests are excluded from the public output. The project uses plain JavaScript, so there is no TypeScript compiler or framework lint task to run. `tools/check.js` checks all JavaScript syntax, HTML asset references, the 87-car snapshot and its photo/equipment files.

## Structure

- `index.html`, `main.js`, `catalog.js`, `showroom.js`: landing page, services, contacts, search and vehicle listing.
- `vehicle.html`, `vehicle.js`: gallery, structured facts, bilingual equipment/description and direct inquiry.
- `concierge.html`, `concierge.js`: general inquiries.
- `legal.html`, `i18n.js`: company information, policy content and shared BG/EN translation.
- `style.css`, `catalog.css`: authored styles. The `.min.css` copies are generated.
- `data/vehicles.base.js`: verified 87-car fallback snapshot. `data/eq/` contains 83 original equipment lists with aligned English translations.
- `data/vehicles.js`: asynchronous managed-inventory loader. Every inventory renderer waits for this result; unavailable services select the snapshot. An intentionally empty managed inventory stays empty.
- `admin/`: mobile inventory editor, login and database schema.
- `api/`, `server/`: protected Vercel handlers, Supabase sessions/data, signed Cloudinary uploads and server-side Gemini Flash-Lite.

The previous phase-specific DOM patches, synchronous network loading and downloaded-code evaluation have been removed. Changes now live in the markup, renderers and authored styles that own them.

## Facts and publishing

Use the project vehicle records and official [AutoHaus contact page](https://autohaus.bg/контакти/) as factual sources. The brand is AutoHaus; the legal entity is Аутохаус България ЕООД / Autohaus Bulgaria Ltd., ЕИК 200771286, VAT BG200771286. Vehicle inquiries use Иван Манев, +359 884 777 045 and `autohousesell@gmail.com`.

The existing GitHub `main` branch is connected to the Vercel project. See [DEPLOY.md](DEPLOY.md) for deployment and [ADMIN.md](ADMIN.md) for the credentials and database setup. Inquiry-email configuration is intentionally deferred at this stage.
