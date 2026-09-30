# AutoHaus admin

The existing `autohaus34` Supabase project supplies email/password authentication, inventory and free Supabase Storage. Vercel hosts the protected APIs. The public Supabase project URL/key are identifiers, not privileged credentials. Gemini credentials remain server-side.

## Staff workflow

Open `/admin/login.html`. Search a car and edit it, or choose **Add car**. On a phone, select several gallery photos or use the camera. Tap arrows or **Set cover** to reorder; save after removing a photo. Each photo receives its own signed upload URL and is resized to an oriented JPEG up to 1920 px before upload.

Paste the original description, process with Gemini, review BG + EN, confirm the review and save. Save/Publish stays at the bottom on phones. Drafts and unpublished cars remain private. Unsaved changes can be recovered in the same tab for 24 hours; saving is still required before closing the tab.

Owner manages team access. Admin manages inventory and sync. Editor edits vehicles. Viewer cannot write. Permissions are checked by the API and Supabase RLS against current active membership and a live session; revoked accounts do not retain access until token expiry. Concurrent edits return a conflict instead of silently overwriting newer work.

## Inventory sync

The public catalogue reads managed inventory. The bundled public inventory is deliberately empty, so an outage cannot resurrect sold cars. `data/inventory.snapshot.json` is a private verification fixture, not a public catalogue fallback. `data/photos.js` indexes the exact source photos with existing responsive derivatives.

**Sync AutoHaus** reads only official listing tables and equipment. It preserves existing publication decisions and translations for unchanged factual lines. New or changed listings without complete translations stay drafts for review. Departed official listings are unpublished; manually added cars are retained. The retired static bootstrap API returns 410.

## Gemini

Set `GEMINI_API_KEY` in the Vercel project. The server uses `GEMINI_MODEL=gemini-3.1-flash-lite` by default. Use Google's free-tier project without enabling billing for normal free usage. Quota errors keep the pasted text and allow manual editing or a later retry; there is no paid OpenAI fallback.

Supabase and image storage are already provisioned. Cloudinary configuration is no longer needed for new uploads; existing Cloudinary images remain supported. Inquiry email setup is intentionally deferred.

## Database maintenance

## Website photos

Open **Website photos** (`/admin#media`) for all five hero slides and five service cards. Choose a file or the phone camera, check the preview, then upload and publish. JPEG/PNG/WebP/AVIF input is optimized in the browser to at most 1920 pixels on its longest side. HEIC requires browser support; the screen provides a JPEG fallback instruction. Files over 35 MB are rejected. Responsive WebP/JPEG versions and a small hero background are uploaded under a unique `site-media/UUID/` family. Existing photos remain visible until all files are verified and an atomic, concurrency-checked swap succeeds.

The collapsed archive restores a previous photo or the built-in original. Owner/admin can permanently delete an unused family after explicit confirmation; editor can replace/restore; viewer is read-only. Deletion removes files first and metadata only after successful storage removal; failed/interrupted operations remain visible for retry. A 125-minute guard after upload signing prevents still-valid signed URLs from recreating deleted files. Originals bundled in Git are recoverable factory defaults and cannot be purged through this screen.

Apply `20260930_homepage_images.sql` and `20260930_homepage_images_hardening.sql` before deployment. The public settings view exposes active image dimensions/identifiers only, not archive filenames or uploader information. Vercel renders those images into the existing homepage HTML, including the first-image preloads, with a short CDN cache. The existing settings request reconciles changes without another public request. Other inventory behavior and vehicle uploads are unchanged.

## Database maintenance safety

The current production database includes team roles, storage and analytics added after the original bootstrap schema. **Do not reapply `admin/schema.sql` to this managed project**: it is retained only for the isolated legacy schema/import regression test. Production changes belong in `admin/migrations/` and should be applied through Supabase migrations. Deploy the explicit public API column list before applying `20260914_private_source_columns.sql`.

Checks: `node tools/check.js`, `node --test tools/backend.test.js`, `node tools/schema.test.js`, and `node build.js`. The schema test optionally requires local `@electric-sql/pglite`; production has no package dependencies. `tools/ui-fixture-server.js` runs isolated browser tests without real credentials or inventory mutations.
