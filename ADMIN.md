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

## 3. Description processor — free local AI

No OpenAI API key is required.

The admin uses Chrome's built-in local AI and Translator APIs when available. The model runs on the admin employee's computer, so vehicle text is not sent to an external AI provider and there is no per-request AI charge.

Recommended environment for the full AI workflow:

- desktop Google Chrome
- Windows 10/11, macOS 13+, Linux or supported ChromeOS hardware
- enough local RAM/storage for Chrome's built-in model
- internet connection only when Chrome initially downloads the required local model(s)

The workflow stays: **paste → process → review → save**. Source text is cleaned and structured in English locally, then Chrome's local Translator produces Bulgarian. The processor is instructed never to invent equipment/specifications. Human review before saving remains mandatory.

If the generative local model is unavailable, the admin automatically falls back to safe local cleanup/deduplication and uses the local Translator when available. The UI warns the employee that the fallback result needs review.

The old `/api/admin/description` OpenAI endpoint remains unused by the default admin workflow and no `OPENAI_API_KEY` is required.

## 4. Existing inquiry email

Phase 2 still uses:

```text
RESEND_API_KEY=...
RESEND_FROM_EMAIL=verified-sender@your-domain.com
```

Vehicle enquiries are delivered to `autohousesell@gmail.com`.

## Vercel deployment

Recommended deployment:

1. Add the Supabase, Cloudinary and Resend environment variables in **Vercel → Project → Settings → Environment Variables** for Production and Preview as appropriate.
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
- **Снимки** — multi-upload, automatic processing, drag reorder, remove.
- **Описание** — paste source → local process → review BG/EN → save.
- **Публикуван / Чернова** — explicit state; saving a draft never publishes it accidentally.

## Data model

Public vehicle fields are derived from the single structured database row: make, model, body type, color, transmission, fuel, mileage, first registration, horsepower, price, tags, notes, descriptions, equipment and ordered images. The adapter maps that row to the current public site's legacy shape so existing `catalog.js` / `vehicle.js` can keep working without duplicating values.
