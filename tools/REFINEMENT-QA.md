# AutoHaus refinement verification

Verified locally on 2026-09-15. No production records, credentials, or database schema were changed. Nothing was deployed.

## Implemented

- Compact vehicle facts and inquiry area, retaining the existing AutoHaus palette, typography, geometric details and main gallery presentation.
- Permanent thumbnail rail, keyboard navigation, responsive image selection, and protection against out-of-order image decoding.
- Structured paragraphs and equipment groups, with short lists left unclipped. Every canonical BG/EN equipment line is covered by a preservation test.
- Admin source text separated from editable BG/EN website outputs; language tabs, manual editing, review confirmation and existing saved fields remain available.
- Public shell no longer waits for inventory. Intent-prefetched vehicle data is reused across navigation. Cover image variants remain available instead of falling back to full-size images.
- Public caches share a bounded 30-second freshness deadline, deduplicate concurrent reads, and do not return expired listings after a failure. Same-browser admin mutations invalidate public prefetches.
- Admin direct editors load alongside the compact list, use short-lived detail prefetching, and retain the mounted editor on ordinary saves. AI requests send relevant vehicle facts rather than the full editor/gallery payload.
- Homepage service-card images, overlays and copy no longer run separate entrance effects; mobile cards are visible without a delayed reveal.

## Browser checks

Used `tools/ui-fixture-server.js`, an isolated in-memory test origin excluded from deployment. AI and inquiry responses were mocked; tests did not send real inquiries or change live inventory.

- Desktop: 1440 × 1000 and 1440 × 900.
- Tablet: 768 × 1024.
- Phones: 390 × 844 and 320 × 740.
- Product: 8-photo vehicle with 133 source equipment lines; 0/1/2-photo fixtures; short, empty, multiline and grouped equipment content; English/Bulgarian labels; thumbnail selection, repeated selection, Home/End, previous/next, lightbox open/close, expand/collapse.
- Inquiry: successful submission; failure retains text and restores the submit button; legal links remain in the footer.
- Admin: dashboard, list/search, direct edit, new draft, save/reopen, publish/unpublish, generated BG/EN review gate, quota failure/manual fallback, language tabs, mobile menu, analytics/team/security navigation.
- No horizontal document overflow observed at the checked widths. Tested working tabs reported no new console errors.
- Homepage: first scroll to service cards, desktop expansion, mobile open/close, stable photo transforms and overlays.

## Automated checks

```sh
node build.js
node tools/check.js
node --test tools/backend.test.js tools/public-loading.test.js tools/admin-workflow.test.js tools/product-layout.test.js
node tools/security.test.js
node tools/schema.test.js
git diff --check
```

The combined Node suites pass 51 tests, including cache expiry/invalidation, late-response races, source/equipment preservation, stale-save conflicts, authentication and permission checks. Expected failure-path tests deliberately simulate provider outages and quota errors.

These checks establish the local implementation and request behavior, not a guarantee of production network latency or successful delivery by external AI/email providers. Production cache lifetime is at most 30 seconds; other visitors may see an existing published listing until that short deadline expires.
