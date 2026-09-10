# AutoHaus admin

The existing website uses Vercel Node handlers, Supabase authentication/database, signed Cloudinary uploads and server-side Gemini Flash-Lite. The browser never receives the Supabase service key, Cloudinary secret or Gemini key. All required variable names are in `.env.example`.

## Supabase

1. Create or select the Supabase project and run the complete `admin/schema.sql` in its SQL Editor. The script is transactional and can be rerun to upgrade the earlier schema without replacing vehicles.
2. Create staff email/password users in Authentication → Users, with confirmed email. Disable public signup for this staff-only workflow.
3. Set `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` and `ADMIN_EMAILS` in the existing Vercel project's environment variables. `ADMIN_EMAILS` is a comma-separated list of staff email addresses; an empty list denies everyone.
4. Redeploy, open `/admin/login.html` and sign in. On a fresh database, **Импортирай / Import** imports the canonical 87 vehicles, original equipment and existing optimized photos in one transaction. Repeating the import cannot overwrite edits or restore deleted vehicles.

Only the server's service role can read/write inventory or check authentication sessions. Browser database roles have no table permissions. Every admin API verifies both the Supabase user and its active server session. Logout revokes that session. Cookies are HttpOnly, Secure on HTTPS and SameSite Strict. Mutations require same-origin JSON. Concurrent editing is protected by a saved-version check.

The public API returns only published vehicles and excludes original pasted descriptions and private review notes. An initialized but empty inventory remains empty. Before initialization, or during an unavailable backend response, the public site uses its bundled 87-car snapshot. As a consequence, the last deployed snapshot can temporarily reappear during a backend outage; keep the snapshot current when retiring listings permanently.

## Cloudinary

Set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET` in Vercel. An unsigned upload preset is not required. The server signs uploads; the phone sends image files directly to Cloudinary and the server verifies the returned signature.

Staff can select multiple photos from the gallery or use the separate camera button. Photos have progress, retry, move-earlier/later, make-cover and remove controls. A car supports up to 80 photos; each selected file must be at most 45 MB. Supported formats include JPEG, PNG, WebP and HEIC/HEIF. Actual account upload limits still apply.

Delivery uses automatic orientation, optimized JPEG/WebP and 400/800/1280 px variants. Limit-and-pad transformations preserve the whole image without stretching or enlarging small originals. Existing inventory uses the local optimized image variants. Removing a photo changes the editor immediately; the remote asset is deleted only after a successful vehicle save and only if no other vehicle references it.

## Gemini description processing

Set `GEMINI_API_KEY` from Google AI Studio. The default `GEMINI_MODEL` is `gemini-3.1-flash-lite`; no OpenAI subscription/key is used. Google's [current pricing](https://ai.google.dev/gemini-api/docs/pricing#gemini-3.1-flash-lite) lists free input/output for this model. Use a project on the free tier without enabling billing for zero AI spend. Quotas depend on the Google project and are not unlimited.

The workflow is **paste → process → review BG + EN → save** on iPhone, Android and desktop. Instructions require every distinct supplied fact, OEM code, number and qualification to be preserved, prohibit invented equipment/specifications, remove copied-site clutter and avoid duplicating matching structured fields. Conflicts retain the original disputed wording in review notes. Both equipment lists must contain the same number of aligned lines. Incomplete or malformed model output is rejected.

Staff must compare the result with the original and check the review confirmation before saving processed output. This review is necessary because model instructions cannot guarantee factual correctness. The original source and review notes are saved privately with the vehicle. Free-quota errors retain the original and existing edits, with retry or manual BG/EN editing available. There is no automatic paid-provider or browser-specific AI fallback.

Google's free-tier data terms apply to submitted listing text; see the linked pricing page. Keys stay in Vercel server environment variables.

## Daily use

- **Add car** → make/model → photos → specifications → optional description processing → **Save draft** or **Publish**.
- Find a car by make, model or reference; edit it from its card. Published and draft filters are available.
- Save/Publish stays visible on phones, with safe-area spacing and 16 px inputs. Photo actions work by tap; desktop drag-and-drop is optional.
- Unsaved edits are recovered in the same browser tab for up to 24 hours. Closing a tab can discard this local recovery, so save before closing. A session-expiry message lets staff sign in again without silently replacing their form.

The implementation can be published before service credentials are available. Authentication, persistent edits, real photo uploads and live AI processing require the corresponding configured accounts. Email-provider configuration is intentionally deferred.
