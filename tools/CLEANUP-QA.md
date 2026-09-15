# AutoHaus targeted cleanup verification

## Implemented

- Homepage: removed redundant links beside the menu toggle; retained overlay navigation, brand and right-side controls. Hero CTA uses the frame's right inset instead of the centre of an empty third-column allocation.
- Lightbox: the supplied interior photo contains 13px off-white borders within the JPEG. A pixel audit identifies 174 bundled legacy photos with the same verified matte. Presentation clips these margins only for matching local assets and exact dimensions. Original image files and remote/new uploads are unchanged. Resize handling accounts for object-fit letterboxing.
- Editor: removed the Quick Import add-on, its script/build entries and exclusive hooks. Shared sync/backend functions remain intact.
- Editor: removed category, tags and source URL controls, preserving existing metadata on save and valid defaults for new cars.
- Description workflow: optional pasted-text generator, clear source explanation, separate website content fields and unchanged BG/EN review/save validation.
- Photos: handle-based pointer/touch and keyboard sorting, preview/drop feedback, edge auto-scroll, cancellation and listener cleanup. Existing save path retains image metadata and dense order positions. Removed arrow controls and native-only drag handlers.

## Passed

- Production asset build and 152 JavaScript syntax checks.
- Catalog integrity: 84 unique cars, 634 photos with six variants, 84 paired BG/EN equipment files.
- 74 Node regression tests across backend, public loading/layout, admin workflow/cleanup, photo sorting and public cleanup.
- Security and schema suites: role enforcement, revocation, anonymous denial, schema replay and inventory protection.
- Pixel audit agrees with every photo margin allowlist entry. Unknown images/dimensions are left untouched.
- `git diff --check`.

## Still required before release

Browser automation was denied by the approval service because of its usage limit. No browser workaround was attempted. Therefore this cleanup has **not** been visually verified on desktop/mobile and has **not** been deployed.

When browser access is available, use the isolated fixture (`PORT=3012 node tools/ui-fixture-server.js` in the appropriate shell):

- Desktop 1440px and 1920px; mobile 390px and 320px: inspect homepage menu, hero CTA and multiple lightbox images including the supplied S 500 L interior.
- Admin new/edit: confirm absent import/category/tags/source URL controls and readable optional generator. Generate sample BG/EN, confirm review, save draft, publish/unpublish, navigate away/back.
- Reorder multiple photos using mouse, touch handle and keyboard; test first/last positions, cross-row movement, auto-scroll, Escape, pointer cancellation, saving and reloading.
- Check mobile save bar does not cover fields or drag destinations. Do not test destructive workflows on real saved inventory.
- Resolve the previous Vercel account/deployment access issue and confirm the final production URL/commit after publishing.
