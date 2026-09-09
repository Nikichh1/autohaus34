# Auto House Admin

Production admin for the existing static Auto House site. The public website remains plain HTML/CSS/JS; the admin adds Vercel Node API routes and managed services.

## 1. Supabase — auth + database

1. Create a Supabase project.
2. Open **SQL Editor** and run `admin/schema.sql` once.
3. In **Authentication → Users**, create the admin user(s) with email + password. Do not enable public sign-up for this workflow.
4. Add these environment variables:

```text
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
ADMIN_EMAILS=owner@example.com,staff@example.com
```

`SUPABASE_SERVICE_ROLE_KEY` is server-only. Never expose it in HTML or browser JS.

After the first login, the dashboard shows **Импортирай** if the table is empty. That one click imports the current 87 static vehicles and keeps them published. Until the database contains vehicles, the public site deliberately continues using `data/vehicles.base.js`.

## 2. Cloudinary — vehicle images

Create a Cloudinary product environment and set:

```text
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

Uploads are signed by `/api/admin/images`; the API secret never reaches the browser. Staff can upload normal phone/camera files directly. Delivery variants are automatically generated at 400, 800 and 1280 px in JPEG + WebP, with auto orientation, quality optimization and a site-compatible 800:490 crop without stretching the vehicle.

## 3. Description processor — free-tier API + local fallback

The primary processor uses the Gemini Developer API so it works identically from iPhone, Android and desktop browsers.

Create a Gemini API/auth key in Google AI Studio and add:

```text
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-3.1-flash-lite
```

`gemini-3.1-flash-lite` is selected because it is designed for high-volume translation and simple data processing and is available on the Gemini Free Tier. Keep the Google project on the **Free Tier without a billing account** if the goal is zero AI spend. When the free quota is exhausted the endpoint returns a quota error; it does not silently switch to a paid provider.

The key is server-only in Vercel. It is never exposed to the employee's phone/browser.

The workflow remains **paste → process → review → save**. The server requests structured BG + EN output and explicitly forbids inventing equipment, specifications, history, condition or marketing claims. Human review before saving remains mandatory.

If Gemini is unavailable or the free quota is exhausted, desktop Chrome can fall back to its on-device AI/Translator when supported. If neither AI path is available, the existing safe cleaner still removes obvious noise/duplicates and warns the employee to review manually.

Privacy note: Google's Gemini API Free Tier may use submitted content to improve Google products. If vehicle listing text later becomes sensitive/private business information, use a paid tier or another provider with the required data terms.

## 4. Existing inquiry email

Phase 2 still uses:

```text
RESEND_API_KEY=...
RESEND_FROM_EMAIL=verified-sender@your-domain.com
```

Vehicle enquiries are delivered to `autohousesell@gmail.com`.

## Mobile admin

The admin is mobile-first for daily staff work:

- inventory rows become touch-friendly cards on phones;
- inputs/selects use phone-safe sizes and a single-column editor;
- image upload works directly from the phone camera/photo library;
- image reorder/remove controls use larger touch targets;
- description processing is server-side, so it does not depend on phone hardware;
- a fixed bottom action bar exposes the important actions: cars, photos, AI text, publish/draft and save;
- iPhone safe-area padding is included.

Desktop keeps the wider Shopify-like layout.

## Vercel deployment

Recommended deployment:

1. Add the Supabase, Cloudinary, Gemini and Resend environment variables in **Vercel → Project → Settings → Environment Variables** for Production and Preview as appropriate.
2. Deploy the repo normally. No framework conversion or public-site rebuild is required.
3. Open `/admin/login.html`, sign in, then `/admin`.
4. Run the one-click current-inventory import if this is the first setup.

`/admin` is rewritten to a server-protected route. Admin data APIs validate the Supabase session on every request. Auth cookies are HttpOnly, Secure in HTTPS, SameSite=Strict and never readable by browser JS.

## SuperHosting / other normal hosting

The public website remains compatible with ordinary static hosting. The admin backend needs a Node 18+ runtime (or equivalent serverless runtime) for `/api/*`.

Practical options:

- Host the whole project on a Node-capable plan and map `/api/*` to the Node handlers.
- Keep the public static files on SuperHosting and reverse-proxy `/api/*` and `/admin` to the Vercel deployment.
- If the API is unavailable, the public site continues to use the static vehicle fallback; admin operations obviously require the backend.

Keep all secrets in the hosting environment, never in Git or public files.

## Admin workflow

- **Начало** — counts + recently edited cars.
- **Автомобили** — search, edit, publish/unpublish.
- **Добави** — create a structured vehicle.
- **Снимки** — multi-upload, automatic processing, reorder, remove.
- **Описание** — paste source → Gemini/free fallback → review BG/EN → save.
- **Публикуван / Чернова** — explicit state; saving a draft never publishes it accidentally.

## Data model

Public vehicle fields are derived from the single structured database row: make, model, body type, color, transmission, fuel, mileage, first registration, horsepower, price, tags, notes, descriptions, equipment and ordered images. The adapter maps that row to the current public site's legacy shape so existing `catalog.js` / `vehicle.js` can keep working without duplicating values.
