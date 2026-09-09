# Bentley homepage — measured spec (source for the AutoHaus rebuild)

Measured live with Playwright (Chromium 1223) at 375 / 768 / 1024 / 1440 / 1920.
Raw dumps: `scratchpad/pw/out/{structure,sections,bands,detail,deep,css,hero,hero2}.json`.
Everything below is measured, not estimated.

## Page skeleton @1440×900 (docH 5900)

| Band | top | height |
|---|---|---|
| Header (absolute, z3) | 0 | 127 |
| Hero stage (8-item slider) | 0 | 900 |
| Page gradient container | 900 | 4020.5 |
| — intro text teaser | 900 | 560 |
| — card wall | 1460 | 683 |
| — article teaser 1 (Mulliner) | 2143 | 700 |
| — article teaser 2 (Configurator) | 2843 | 700 |
| — article teaser 3 (Ownership) | 3543 | 700 |
| — CTA teaser (About) | 4243 | 677.5 |
| Footer | 4920.5 | 980 |

The whole middle is **one** `linear-gradient(#000000, #183319)` spanning 4020px — that
is why the page drifts from black to green. The footer is flat `#183319`.

## Tokens (read from `:root`)

```
--bm-primary-living-green #394d45   --bm-grid-gutter 24px
--bm-primary-teal         #637a77   --bm-grid-margin 48px
--bm-primary-moss         #dcd8c0   spacers 16 48 64 72 80 96 112
--bm-primary-blush        #e7cfb9   hero stage bg #040404
```

## Grid

12 columns · gutter 24px (`.row` margin `0 -12px`, columns pad `0 12px`) · page margin 48px.
At 1440: row 1368, column 114, `offset-1` = 125.984px. Common spans: 10 cols (1116),
5 cols (546), 4 cols (432).

## Type scale (family "Bentley", base weight **300**)

| Role | size/lh | weight | letter-spacing | case |
|---|---|---|---|---|
| h3 (hero headline) | 48/54 | 300 | normal | none |
| h4 (section headline) | 38/44 | 300 | normal | none |
| h6 (card title) | 24/28 | 300 | normal | none |
| body / body--small | 16/24 | 300 | 0.16px | none |
| teaser eyebrow | 13/18 | 300 | 0.13px | none |
| button label size-s | 13/16 | 400 | 1.3px | UPPER |
| button label size-l | 16/16 | 400 | 1.6px | UPPER |
| nav link | 13/24 | 400 | 1.3px | UPPER |

Everything is weight 300 except buttons/nav, which are 400 + 0.1em tracking + uppercase.

## Buttons — radius **0**

| variant | bg | border | padding | min-h | gap |
|---|---|---|---|---|---|
| primary   | #394d45 | 1px solid #394d45 | s 12/18 · l 16/22 | 40 / 48 | 12 / 14 |
| secondary | transparent | 1px solid #fff | same | same | same |
| tertiary  | transparent | 1px solid transparent | 12/16 | 40 | 12 |

Button group gap 24px (hero: 16px, column, right-aligned).

## Hero stage — the structural surprise

Not a full-bleed image. A **1344×702 inset media box** inside a 1440×900 stage:

```
.container            1440×900 grid, bg #040404
  .pagination         absolute, padding 178px 88px 0, gap 8px, z2
    .position         41×24 bg rgba(4,4,4,.4), 14/24 w400  "1 / 8"
    input[range]      284×24 bg rgba(4,4,4,.4), padding 12, margin 2
    button prev/next  42×42 bg rgba(4,4,4,.4)   (prev opacity .3 when disabled)
  .item ×8            padding 150px 48px 48px
    .background-image absolute inset -32px  (1504×964 — 32px overscan)
    .box-wrapper      48,150 1344×702 z1
      .media          img cover
      .gradient-top   1344×175.5  linear-gradient(#000, transparent)
      .gradient-bot   1344×351    linear-gradient(transparent, #000)
      .content        absolute, padding 40, space-between, align-items:flex-end
        .text         flex, gap 24, align-items:flex-end → h3 + p side by side
        .buttons      gap 16, right-aligned
```

## Article teaser — the signature motif

```
.article-teaser          1440×700, flex, align-items:center, min-height 700
  .fully-cover           absolute inset 0, object-fit cover
  .grid                  padding 0 48
    .row                 margin 0 -12, align-items:center
      .content-container 432 (4 cols), position relative, z1
        .decor           240×240 absolute, top -32 right -32,
                         background rgba(255,255,255,.2), backdrop-filter blur(40px),
                         animation bm-parallax (scroll-driven)
        .content         432×344, padding 48, backdrop-filter blur(40px), NO background
          h2 eyebrow     13/18  mb 16
          h3 headline    38/44  mb 16
          p  text        16/24  mb 40
          button-group   gap 24 → size-s primary
```

The panel is pure `backdrop-filter` over the photo; the decor square is the only
element carrying a fill. Both blur at 40px.

## Card wall

Section padding 64px 0. Scroll container padding `0 36px`, margin-bottom 48px, flex.
Card **318×459** (ratio .693), margin `0 12px` → stride 342. White bg, absolute cover
image, scrim `linear-gradient(rgba(0,0,0,.5), rgba(0,0,0,.49))`, text padding 32,
gap 16, justify-end. Title 24/28, body 16/24. Pagination buttons 42×42 `rgba(4,4,4,.4)`.
Cards enter staggered (translateY + opacity).

## CTA teaser

Padding 48 48 64. Row gap 48, align center. Media 432 (4 cols) at offset-1 holding
**two** 401.8×535.7 images, absolutely positioned, offset ~30px horizontally and
parallaxing at different rates. Text 546 (5 cols), gap 16, button group mt 24.

## Footer (980 tall)

Padding 48px 0, inner grid padding 0 48. Top links = grid gap 64 laid out
`[links 568] [logo] [links 568]`, each section flex `gap 8px 64px`. Social row.
`main-links-container` mb 64. Link columns: offset-1, width 1116, flex gap 32, mb 40.
External-link badges: flex gap 24, wraps to 2 rows. Meta bar padding 24px 0.

## Breakpoints (by @media rule count — these are the real ones)

`<768` · `≥768` · `≥1024` · `≥1440` · `≥1920` · `≥2560`, plus `(hover:hover)`.

| | <768 | ≥768 | ≥1024 | ≥1440 | ≥1920 |
|---|---|---|---|---|---|
| page margin | 16 | 32 | 40 | 48 | 112 |
| header pad | 16 16 24 | 16 32 | 40 40 24 | 48 48 24 | 56 112 24 |
| root font-size | 14 | 14 | 14 | 16 | 18 |
| h4 | 28 | 30 | 30 | 38 | 44 |
| h6 | 20 | 20 | 20 | 24 | 28 |
| teaser min-h | **900** | 600 | 600 | 700 | 800 |
| teaser panel w | 343 | 344 | 384 | 432 | 544 |
| decor | 120 | 160 | 160 | 240 | 240 |
| card | 284.5×407.7 | 224×321 | 304×458 | 318×459 | 400×674 |
| wall pad-x | 12 | 24 | 32 | 36 | 96 |
| intro pad-top / min-h | 64 / — | 72 / 360 | 80 / 400 | 80 / 560 | 80 / 560 |
| CTA layout | stacked | side-by-side | side-by-side | side-by-side | side-by-side |

Mobile teasers are *taller* than desktop (900 vs 700).

## Animation

Master easing **`cubic-bezier(0.16, 1, 0.3, 1)`**.

| keyframe | what it does |
|---|---|
| `bm-appear-animation` 2.4s | opacity + translateY/X via custom props — the entrance |
| `bm-appear-top/right/left/bottom` | ±100px Y, 20px / -100% X variants |
| `bm-text-appear-animation` | `blur(5px)` + `mask-image: linear-gradient(345deg,…)` wipe |
| `bm-parallax` | scroll-driven transform via `--parallax-x/y-start/end` |
| `bm-h-counter-animation` | `translateY(calc(-100% + 1lh))` — odometer counter |
| `bm-slider-bg-entry-animation` 3.6s | `brightness(.25) blur(16px)` → `brightness(1)` |
| `bm-shimmer-loading-animation` 2s | image placeholder shimmer |
| `bm-card-wall-last-card-scroll-release` | last card `margin-inline-end` 100% → 16px |

Header: `transition: background .15s ease-out`, entrance `bm-appear-animation 2.4s`.
Pagination: `bm-fade-in-animation 2.4s linear`. Images: `transition: opacity .2s`.

## Fine detail (polish pass — read from CSSOM rules, not inferred)

### Entrance choreography — all `cubic-bezier(0.16, 1, 0.3, 1)`

| element | keyframe | dur | delay | fill | from |
|---|---|---|---|---|---|
| hero backdrop | `bm-slider-bg-entry` | 3.6s | 0 | backwards | `brightness(.25) blur(16px)` → `brightness(1)` |
| hero media | `bm-appear` | 2.4s | 0 | backwards | y −24px, **scale 1.2**, opacity .001 |
| header | `bm-appear` | 2.4s | **1s** | both | y −40px |
| hero content | `bm-appear` | 2.4s | **1.6s** | backwards | y +72px |
| pagination | `bm-fade-in` | 2.4s | **2.4s** | backwards | opacity 0 (linear) |

`@keyframes bm-appear-animation` is fully token-driven:
`translateY(--appear-start-y) translateX(--appear-start-x) scale(--appear-start-scale)`
with `opacity: --appear-start-opacity`.

### Parallax — native scroll-driven, `animation-timeline: view(); animation-range: cover`

| element | x start→end | y start→end |
|---|---|---|
| teaser decor <768 | −16 → 0 | 20 → −20 |
| teaser decor ≥768 | −16 → 16 | 20 → −20 |
| CTA image 1 | — | **424 → −149** |
| CTA image 2 | — | **279 → −58** |

### Hover — the whole inventory. It is this short.

- primary button → bg+border `#637a77`, label `#fff`; **`transition: 0s`, instant**
- secondary/tertiary → `background-color: rgba(255,255,255,.2)`; border unchanged
- active: primary reverts bg and label goes `#637a77`; ghost wash → `.3`
- disabled: primary bg `#637a77`, all variants opacity `.3`
- footer links → `underline` at `text-underline-offset: 9px` — no colour change
- footer social → `border-color: currentcolor`
- range thumb → bar grows 2px → 4px tall
- **No card hover. No image scale. No nav colour change. No lift/translate.**

### Card wall

Card reveal starts at `translateY(120px)` / `opacity 0`, staggered per card.
Card is `aspect-ratio`, not a fixed height. Dragging adds a state that drops
both `scroll-behavior: smooth` and `scroll-snap-type`. Scrim is an **eased**
double gradient (≈11 stops a side), not a linear ramp: `.5` black → clear by
15%, clear to 40%, → `.75` black at 100%.

### Pagination

`__position` 14/24 w400 `letter-spacing: normal`, bg `rgba(4,4,4,.4)`,
`padding-inline-start:12px`, `margin-inline-end:-10px`.
The range is a real `<input type=range>` whose **thumb** is the indicator:
`width: calc(var(--visible-fraction) * 100%)` (= 1/8), 6px tall, drawn with
`linear-gradient(transparent 2px, currentcolor 0, currentcolor 4px, transparent 0)`.

### Per-breakpoint values (all measured)

| | 375 | 768 | 1024 | 1440 | 1920 |
|---|---|---|---|---|---|
| gutter / margin | 8 / 16 | 16 / 32 | 16 / 40 | 24 / 48 | 32 / 112 |
| root font-size | 14 | 14 | 14 | 16 | 18 |
| h3 | 32/38 | 36/42 | 36/42 | 48/54 | 54/60 |
| h4 | 28/34 | 30/36 | 30/36 | 38/44 | 44/50 |
| h6 | 20/24 | 20/24 | 20/24 | 24/28 | 28/32 |
| body | 14/20 | 14/20 | 16/24 | 16/24 | 18/26 |
| eyebrow | 12/16 | 12/16 | 13/18 | 13/18 | 14/18 |
| hero item padding | 128/16/44 | 102/32/32 | 134/40/40 | 150/48/48 | 158/112/112 |
| hero box aspect | auto | 704/406 | 944/546 | 1344/702 | 1696/810 |
| pagination padding | 132/20/0 | 110/40/0 | 150/72/0 | 178/88/0 | 182/160/0 |
| hero content padding | 0 | 24 | 32 | 40 | 48 |
| teaser min-height | 100vh | 600 | 600 | 700 | 800 |
| teaser panel span | 12 | 6 | 5 | 4 | 4 |
| decor size / offset | 120 / −16 | 160 / −24 | 160 / −24 | 240 / −32 | 240 / −32 |
| card aspect | 224/321 | 224/321 | 304/458 | 318/459 | 400/674 |
| card text padding | 16 | 24 | 24 | 32 | 48 |
| wall pad-x / mb | 12 / 24 | 24 / 24 | 32 / 32 | 36 / 48 | 96 / 64 |
| intro min-h / pad-top | 0 / 64 | 360 / 72 | 400 / 80 | 560 / 80 | 560 / 80 |

Hero stage height is **content-driven**, never `100vh`: pad-top + box + pad-bottom
= 778 / 540 / 720 / 900 / 1080.

### Footer typography (measured, and not what it looks like)

col links **11/16 w400 ls .11px** · col headings **20/28 w300** ·
main + external links **13/13 w400 `letter-spacing: normal` UPPERCASE** ·
meta links 11/16 w400, not uppercase.

## Second measurement pass (2026-07-27) — corrections and new findings

Re-measured live. **Where this section disagrees with the tables above, this
section is right** — the earlier numbers were read off the wrong element.

### Corrections to the tables above

| Claim above | Actual |
|---|---|
| body 16/24 at 1024 | **14/20**. Every piece of body copy on the page is `bm-body--small`: 14/20 · 14/20 · 14/20 · 16/24 · 18/26. There is no 1024 step. |
| teaser eyebrow 13/18 at 1024 | **12/16**. `__header` is 12/16 until 1440, then 13/18, then 14/18. |
| root font-size 14/14/14/16/18 | **16px at every breakpoint.** |
| "Cards enter staggered" | Exact: see the card-wall entry below. |
| footer col headings via h6 | Own scale: **16/22 · 16/22 · 16/22 · 20/28 · 22/30**. |

### Section rhythm (spacer 7 / spacer 9)

| | 375 | 768 | 1024 | 1440 | 1920 |
|---|---|---|---|---|---|
| spacer 7 (`padding-*--s`) | 40 | 40 | 48 | 48 | 48 |
| spacer 9 (`padding-*--m`) | 48 | 56 | 64 | 64 | 64 |
| card wall (both) | 48 | 56 | 64 | 64 | 64 |
| CTA teaser top / bottom | 40/48 | 40/56 | 48/64 | 48/64 | 48/64 |
| footer (both) | 32 | 32 | 40 | 48 | 64 |

`.bm-m-text-teaser__description` gap is **16px**, not 24.

### The slide transition — a conveyor, not a crossfade

`--slide-transition-duration: 1s`, and it is only set once the slider is
animation-enabled (so a no-JS render swaps instantly).

```
.__box  transition: opacity 1s ease-out, scale 1s ease-out   /* NOT the master easing */
upcoming   opacity 0   scale 1.2      (CSS, on every item after the first)
active     opacity 1   scale 1
passed     opacity 0   scale 0.8      (written inline by the slider's JS)
```

Verified against the live curve — outgoing/incoming at t=250ms are
`0.634 / 0.927` and `0.366 / 1.127`. Nothing ever reverses direction: a frame
enters big, rests, and keeps shrinking as it leaves. The blurred backdrop
crossfades on the same 1s clock.

**The clip is on `__box-wrapper`, the scale is on `__box`.** Merging those two
nodes makes the clip scale too, and the arriving frame throws its headline
outside the picture for the whole second.

Autoplay is `autoslide-duration="10"` → **10 000 ms** (measured 10055 / 10021).

### Entrance is gated on the image, and runs once

Every entrance animation carries `animation-play-state: var(--slider-entry-animation-state)`,
which starts `paused` and flips to `running` either when the hero image reports
loaded or when a `4s step-end` keyframe fires — a pure-CSS fallback so the page
can never sit frozen. The choreography plays on load and **never again**;
binding it to the active slide replays it on every autoplay tick.

### Card-wall entry (WAAPI, read off the live animations)

`opacity 0→1`, `translateY(120px)→0`, **3200 ms**, `cubic-bezier(.16,1,.3,1)`,
fill `both`, and a **reverse** stagger: delays 750, 600, 450, 300, 150, 0 —
i.e. `(count - 1 - index) * 150ms`, so the wave breaks from the off-screen edge
inward. All cards are animated together when the *wall* enters view, including
those parked off-screen horizontally.

### Pagination

- Arrows are `display:none` **below 1024** (hidden under 768, and again for
  768–1023 whenever the scrubber is shown). Scrubber is `width:100%` below
  1024, fixed `284px` at 1024+.
- Track is a **2px hairline** at `color-mix(in srgb, currentcolor 30%, transparent)`
  centred in a 6px box — not a solid grey bar. Thumb thickens 2px→4px on hover.
- The whole band is `pointer-events: none` with only the controls re-enabled,
  and sits at `z-index: 2` **under** the header. It is 220px tall and full
  width at 1440, so without this it blankets the entire header nav.
- The current number is an odometer (`.bm-h-counter`): a digit strip clipped to
  `1lh`, rolled `translateY(calc(-100% + 1lh)) → 0` over **2s** on
  `cubic-bezier(0, 0, 0.09, 1.02)`.

### There are no scroll reveals

`.bm-h-with-animation` on the teasers, the card wall and the CTA teaser enables
**only** `.bm-h-parallax` (`animation-timeline: view()`, `animation-range: cover`).
Teaser panels, CTA copy and card text have zero entry animation —
`getAnimations()` returns `[]` for all of them. The only page-load animation
outside the hero is the header's `bm-appear`. Images fade in at
`transition: opacity .2s` over a shimmering placeholder.

`bm-h-animation--text-appear` (the blur + mask wipe) is **not used** on the
homepage. Do not add it.

### Hero text row

`__text-container` is `flex: 1 0 66.6667%` at 1024+ (the button group takes
`1 0 33.3333%`), gains `text-wrap: balance` at 1440, and carries
`margin-bottom` 32 / 24 / 0. The headline's `margin-bottom` is 16 / 8 / 16 / 0.

## Card-wall expand — measured live at 1440 (2026-07-27)

Item anatomy: the `li` is a grid holding the card and a detail panel; the panel
is parked *under* the card at `grid-area 1/1` while closed, so the closed wall
is unaffected. The card anchor's href is the panel's id, so `:target` opens it
with no JS at all.

### Open timeline (t = 0 at click)

| t | what | duration / easing |
|---|---|---|
| 0 | item `grid-template-columns` `1fr 0fr` → 8 cols, `column-gap` 0 → 24 | 300 **linear** |
| 0 | card → `grid-column 1/5`, aspect 318/459 → **432/587** | 300 linear |
| 0 | panel → `grid-column 5/-1`, `visibility:visible` | instant |
| 0 | card headline `font-size` 24/28 → **48/54**, card body `display:none` | instant |
| 0–500 | **card** headline `bm-appear`: opacity 0→1, translateY 20px→0 | 500 **ease** |
| **250–550** | **panel `opacity` 0 → 1** | **300 ease-in, delay 250** |
| 300–600 | CTA bar `backdrop-filter` → blur(8px) | 300 ease, delay 300 |
| 500–1000 | CTA bar `background` #fff → rgba(255,255,255,.4) | 500 ease, delay 500 |

Measured card widths (linear): 318 · 334 · 354 · 374 · 394 · 414 · 432.
Measured panel opacity (ease-in): .01 · .10 · .22 · .43 · .63 · .86 · 1.00.

### The content does NOT stagger

Sampled every child through the whole open: `content-headline`, `richtext`,
`button-group`, each button and the close button all sit at **opacity 1.00 from
first frame to last**. They ride the one container fade. The *only* element with
its own animation is the **card's** headline (the 20px rise above) — and it
starts at t=0, i.e. *before* the panel fade, not after it.

### Inactive cards do not react

No dim, no blur, no scale, no filter — `filter` stays `none` and their widths
stay 318 throughout. They are only displaced by the growing item. (Any opacity
drift measured during an open is the 3.2s *entry* animation still finishing.)

### Close
`--open` is removed; the panel is hidden **instantly** (the base rule carries no
transition) and the headline snaps back to 24px. Only the geometry animates —
300ms linear, 432 → 318.

### Geometry per breakpoint
| | card open | panel | note |
|---|---|---|---|
| <1024 | full-screen | full-screen | item goes `fixed; inset:0; 100dvh; z-index:50`, `html` locks scroll, close pins top-right and drops its label |
| 1024 | 304×530 | 464 | card width unchanged, only taller |
| 1440 | 432×587 | 432 | |
| 1920 | 544×895 | 544 | |

CTA bar is `width: calc(100% + gutter)` anchored to the panel's right edge, so it
deliberately bleeds one gutter (24px) left over the gap — verified on the source
(group [822,456] against panel [846,432]).

`document.startViewTransition` is instrumented and **never fires** — despite the
`::view-transition-*(card-wall-open)` rules in their CSS, this interaction is
plain CSS transitions.

## Brand-asset substitutions for AutoHaus

Only these change; geometry, spacing, type metrics and motion are held to the above.

| Bentley | AutoHaus |
|---|---|
| page gradient `#000 → #183319` | `#000 → #1b1610` (gold family's dark end) |
| footer `#183319` | `#1b1610` |
| primary `#394d45` | `--gold #c9a25a`, label `#0b0e0f` |
| stage bg `#040404` | `#050505` |
| "Bentley" custom sans, single family | **Exo 2**, single family (AutoHaus brand face) |
| Bentley wordmark | AutoHaus logo (`#ah-logo`) |
| Bentley photography | AutoHaus's own photography |
| EN marketing copy | real Bulgarian AutoHaus copy |

One deliberate deviation, flagged: button/nav labels use Exo 2 **600** rather than
Bentley's 400. At 13px uppercase, Exo 2 400 is too thin to hold on photography, and
600 is the established AutoHaus UI weight. Tracking, size and case are unchanged.
