# AutoHaus admin/site polish — 2026-09-17

Implementation notes for the current polish pass.

- Admin editor is equipment-only; legacy description values stay preserved internally.
- Empty price input shows `Цена при запитване` / `Price on request` as a placeholder.
- Product watermarking is a global Settings option with adjustable transparency (default 75%).
- Public inventory is ordered by `updated_at DESC`, so newly published or edited cars appear first.
- Public interaction guard disables native media/link dragging, right-click, and Ctrl/Cmd+U while retaining text selection for allowed content areas.
- Landing-page first-slide `AutoHaus` text and service-card panel CTAs are removed at runtime.
- Menu close/contact color repairs are applied globally.

Known translation behavior: the three default note phrases are already present in `i18n.js` and therefore switch to English. Arbitrary new free-form notes are not automatically machine-translated; unknown text remains in its source language.
