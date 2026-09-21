# AutoHaus stability review — 2026-09-21

Scope: existing public site and admin, based on main at 7502f22. Preserve the current design, published inventory, database schema, permissions and deployment configuration.

## Targeted fixes

- Stop the equipment-shortcut MutationObserver/requestAnimationFrame feedback loop in the admin.
- Register deferred admin routes before initial navigation, so reloading Settings does not fall back to Dashboard.
- Collect VAT together with form/draft data, retaining unrelated notes and hidden review metadata.
- Prevent duplicate vehicle POSTs after an ambiguous network error.
- Bound translation requests and retries; ignore obsolete responses; preserve English previews when translation is unavailable; do not save Bulgarian fallback as English.
- Wait for both upload workers before failed-upload cleanup, and permit retry after a transient watermark-asset failure.
- Add keyboard semantics/navigation to equipment language tabs and accessible names to icon-only menus.
- Preserve the responsive first gallery image; retain the last decoded image while changing photos; allow retry of a failed selection; try full-size JPEG before the small fallback.
- Prioritize selected images over speculative neighbors and honor Save-Data/slow connections.
- Revalidate expired inventory instead of displaying stale listings indefinitely while a background request goes unused.
- Accept edits to legacy rows with retired source provenance; provide the non-null translated-notes default when constructing legacy import/fixture rows. No database migration is involved.

## Automated verification

- `node --test tools/*.test.js`: 106 passing, zero failed/skipped.
- Includes translation timeout/race/retry/save regressions; upload-worker cleanup ordering; gallery request/decode races and fallbacks; draft/save/conflict behavior; authorization/session/role checks; isolated PostgreSQL schema replay and RLS checks.
- `node build.js`: passes; regenerated tracked CSS and independently versioned HTML assets.
- `node tools/check.js`: 161 JavaScript syntax checks, 84 unique canonical vehicles, 634 photos with six variants each, 84 paired BG/EN equipment files, HTML/configuration checks.
- Updated obsolete test harnesses to the current permanent-image renderer and equipment-only editor. Removed tests for intentionally retired AI-generator/sync interfaces rather than restoring those interfaces.

## Browser checks

Used the loopback-only in-memory fixture; it has no provider credentials and cannot send a real enquiry.

- Phone widths 320 and 390, tablet 768, desktop 1440; inspected screenshots and horizontal overflow.
- Create draft, price/VAT, BG equipment and readonly English preview; save/reload.
- Upload two photos through real browser image preparation; inspect previews; keyboard reorder; publish; reload and verify two saved photos.
- Verify public price/VAT/equipment synchronization, BG/EN switch, unpublish and unavailable-vehicle page.
- Settings change/save/reload; mobile menu; team and analytics rendering; keyboard language tabs.
- Desktop gallery rapid navigation and fullscreen open/navigation/Escape; mobile gallery; catalog brand popover/filtering.
- Vehicle enquiry simulated failure preserves draft; retry succeeds. Concierge branch/contact/review.
- Removed only the synthetic in-memory test vehicle after testing; production data was not edited.

## Verification boundaries

Fixture uploads, translations, mail delivery and staff membership are mocked. Server tests cover request validation and authorization separately. No authenticated production staff session was supplied, so live admin writes and actual third-party mail/storage delivery are not claimed as end-to-end verified. No live enquiry was sent and no real membership was created/deleted. Existing inquiry-provider configuration must remain valid for real deliveries.

Local checks are not a guarantee of every browser/device/network combination. Production deployment health and public smoke checks are performed after release.
