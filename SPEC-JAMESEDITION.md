# JamesEdition — measured reference

Measured live in a real browser at 1440×900 and 393×852 on 2026-07-30, by
reading `getBoundingClientRect` and `getComputedStyle` off the actual pages.
Nothing in this file is inferred. Where a number is derived (a gap computed
from two `left` values) it is marked.

Pages measured:
- `/cars` — the category **landing** page (sliders + trending grid). Not a results grid.
- `/cars/all` — the real **results grid** (filter bar, sort, cards, pagination).
- `/cars/bugatti/chiron/2023-bugatti-chiron-for-sale-18248970` — the **detail** page.

Their own stylesheets are cross-origin, so hover states were measured by
moving a real pointer onto a card and diffing computed styles.

---

## 0. Foundations

| Token | Value |
|---|---|
| Container max-width | `1920px` |
| Gutter (desktop) | `72px` → content **1281px** at 1440 |
| Gutter (mobile) | `20px` → content **354px** at 393 |
| Filter-bar gutter (mobile) | `16px` left |
| Display font | **Heldane** (serif), weight 400 only |
| UI font | **Inter** |
| Ink | `#151515` |
| Muted | `#606060` (card location), `#717171` (detail meta) |
| Hairline | `#E0E0E0` at **0.8px** |
| Accent | `#006C75` (teal — "Call agent", "Save search", mobile CTA) |
| Card radius | `0` |
| Pill radius | `100px` |
| Gallery radius | `8px` desktop, `0` mobile |
| Shadows | **none** on cards. Only on floating chips: `0 0 4px rgba(0,0,0,.25)` |
| Control transition | `color .08s, background-color .08s, border-color .08s` |
| Header transition | `background-color .25s, color .25s, transform .25s` |
| Gallery-control fade | `opacity .7s` |

### Type scale (measured)

| Role | Font | Size/LH | Weight | Tracking | Case |
|---|---|---|---|---|---|
| Hero title | Heldane | 68/68 | 400 | normal | as-is |
| Hero subtitle | Inter | 11/15 | 500 | 1px | UPPER |
| Page h1 (desktop) | Heldane | 32/44 | 400 | normal | as-is |
| Page h1 (mobile) | Heldane | 24/32 | 400 | normal | as-is |
| Section h2 (landing) | Heldane | 34/38 | 400 | normal | as-is |
| Section h2 (detail body) | Heldane | 24/32 | 400 | normal | as-is |
| Section h2 (detail footer) | Heldane | 32/44 | 400 | normal | as-is |
| Detail h1 + price (mobile) | Heldane | 28/32 | 400 | normal | as-is |
| Card price | Inter | 16/24 | **600** | normal | as-is |
| Card year+make+model | Inter | 14/22 | 400 | normal | capitalize |
| Card location | Inter | 14/22 | 400 | normal | capitalize |
| Controls / pills | Inter | 14/22 | 400 | normal | as-is |
| Filter group label | Inter | 16/24 | 500 | normal | as-is |
| Body copy | Inter | 16/24 | 400 | normal | as-is |
| Count eyebrow ("8 LISTINGS") | Inter | 11/11 | 500 | 1px | UPPER |
| Card badge | Inter | 12/15 | 600 | normal | as-is |
| "View N photos" | Inter | 12/40 | 500 | normal | UPPER |

**Typography does not shrink between breakpoints** except the Heldane
headings. Card text is 16/14/14 on a phone exactly as on a desktop.

---

## 1. The ListingCard — the atom of the whole system

Identical on the landing "Trending" grid and on `/cars/all`.

```
.ListingCard                412 × 352   border 0.8px solid #E0E0E0   radius 0   shadow none
                            display:flex; flex-direction:column
  .ListingCard__picture     412 × 252   bg #E0E0E0 (placeholder)
                            aspect held by padding-bottom: 252.3px (61.24%)
                            → ratio 1.634  (constant at every breakpoint)
    .je2-single-slider      absolute, fills picture
      img                   object-fit: cover
    .ListingCard__badges    absolute, inset 13px from top-left
      __badges__text        12/15 w600 #151515, bg #fff, radius 3px, pad 0 6px
                            e.g. "New 3 hours ago"
    .ListingCard__save      40 × 40, radius 50%, bg #fff, pad 10px
                            absolute top-right, inset 13px
    __images-count          41 × 28, bg rgba(0,0,0,.6), radius 6px, pad 4px 8px
                            absolute bottom-right, inset 12px — "1 / 47"
    __left / __right        78 × 80 hit areas, vertically centred, hover-only
    __show-more             hover-only, centred near bottom
      __show-more-button    h40, bg #fff, radius 20px, pad 0 16px,
                            shadow 0 0 4px rgba(0,0,0,.25), 12/40 w500 UPPER #393939
  .ListingCard__description padding 12px 0; width 378 (17px inset each side)
      __price               16/24 w600 #151515          ← PRICE IS FIRST
      __tags                14/22 w400 #151515 capitalize  "2004 Chevrolet Corvette"
      __title               14/22 w400 #606060             "Orlando, FL, United States"
  .ListingCard__actions     97 × 42, absolute right of description — "Contact" + logo
```

**Information order is price → vehicle → place.** The price leads. The
vehicle name is one line, `year make model`. The third line is provenance.

### Hover — measured, and it is the surprise

Hovering a card changes **nothing about the card**:

| Property | Rest | Hover |
|---|---|---|
| `box-shadow` | none | none |
| `transform` | none | none |
| `border-top-color` | `#E0E0E0` | `#E0E0E0` |
| image `transform` | none | none |
| image `opacity` | 1 | 1 |
| price `color` / underline | `#151515` / none | `#151515` / none |

The only changes are inside the picture:
- `__left` / `__right` — `display: none` → `flex` (78×80 arrow zones)
- `__show-more` — `display: none` → `flex`, `transition: opacity .7s`

No lift. No zoom. No shadow. No underline. The card is furniture; the
photograph is the only thing that reacts. This agrees exactly with the
Bentley discipline already in `SPEC.md` — the two references do not conflict.

---

## 2. `/cars/all` — the results grid

```
je3-header                 sticky, z-index 301, h 113 desktop / 111 mobile
  je3-search-field         540 × 36, bg #fff, radius 100px, pad 0 20px
                           placeholder "Search Cars"
je3-filter-bar             h 54, padding 10px 0, flex, content width
                           mobile: overflow-x: scroll, padding 10px 0 10px 16px
je2-search-page__left-side content width (no sidebar — results are full width)
  je2-search-page__header  h 74, flex
    __left    h1 "Luxury Cars for Sale"     Heldane 32/44
    __right   "10,400+ listings"  +  "Sort: …"   (h 22, right-aligned)
  je2-grid _serp_results
    je2-grid__content      grid, 3 × 411.6px, gap 30px row / 23px col
                           mobile: 1 × 353.6px, gap 20px row
  je2-search-page__pagination   flex column, centred
    je2-button "Next"      350 × 50, radius 100px, border 0.8px #E0E0E0,
                           Inter 16/24 w500
    Pagination             1 2 3 … 50
```

### Filter bar — every control, in order

All pills: **h 34, radius 100px, border 0.8px, padding 5px 14px, Inter 14/22**.
Gap **6px** (derived from consecutive `left` values).

| # | Control | Type | W | Style |
|---|---|---|---|---|
| 1 | **Filters** | button | 94 | bg `#151515`, border `#151515`, text `#fff` |
| 2 | All Makes | select | 112 | border `#E0E0E0` |
| 3 | All Models | select | — | `_hidden` until a make is chosen |
| 4 | **Year** | button | 79 | border `#E0E0E0` |
| 5 | **Price** | button | 83 | border `#E0E0E0` |
| 6 | **Body Style** | button | 121 | border `#E0E0E0` |
| 7 | All Countries | select | 133 | border `#E0E0E0` |
| 8 | All states | select | — | `_hidden` until a country is chosen |
| 9 | Save search | button | 130 | border + text `#006C75` |

The first pill is filled black — it is the only filled control on the page.
Dependent selects do not appear until their parent is set.

### Sort

Inline text control in the results header, right-aligned, no border, Inter
14/22. Label is literally `Sort:`. Options, in order:

**Premium · Popular · Recent · Price lowest first · Price highest first**

### The Filters drawer

```
.je2-search-filters            position fixed, inset 0, z-index 2000
                               scrim rgba(0,0,0,.3), classes _opened _animated
  __container                  400px wide, full height, bg #fff, slides from LEFT
    (header 56px with a 50×48 close button at its right)
  __content                    padding 32px → group width 321
```

Groups, in document order: **Make & Model → Country/State → Price range →
Mileage → Body Style → Year → Drive → Color → Interior color** (…more below the fold).

- Group label: Inter 16/24 w500 `#151515`
- Select: 319 × 46
- Range groups: **two overlapping `input[type=range]` (297 wide) above two
  text inputs 150 × 48** with placeholders `$ No Min` / `$ No Max`, each with
  a 28 × 46 reset button inside
- Body Style etc.: checkbox rows, 48px tall

### Mobile catalog

- Gutter 20px, content 354
- h1 Heldane 24/32
- **Filter bar scrolls horizontally**; pills keep desktop dimensions exactly
- Grid 1 column, row gap 20px
- Card 354 × 316, picture 354 × 217 → **ratio 1.634, unchanged**
- Floating "Save search" pill: fixed, `bottom: 32px`, centred, 167 × 42,
  bg `#006C75`, radius 20px, z-index 100

---

## 3. `/cars` — the discovery landing page

Section rhythm: **`margin-bottom: 100px`**, padding `0 72px`.

```
je2-top-banner-new           h 720 (min-height 600)
  __content-wrapper          flex, align-items:flex-end, justify-content:space-between
                             padding 0 72px 60px, max-width 1920
    __title                  "Luxury Cars"        Heldane 68/68 #fff
    __subtitle               "EXPLORE 31,000+ …"  Inter 11/15 w500 1px UPPER #fff
je2-category__section  "Popular Makes"      h2 Heldane 34/38  + "View all" (Inter 16/24 w500, plain text, right)
  je2-slider                 8 items across, item 139, image 140 × 107 (ratio 1.31), gap 24px
je2-category__section  "Popular Searches"   h2 Heldane 34/38
  je2-slider                 3 columns × 3 stacked rows; each row =
                             square 128 × 128 thumb + name (Inter 16/24 w500)
                             + "8 LISTINGS" (Inter 11/11 w500 1px UPPER)
je2-category__section  "Trending"           h2 Heldane 34/38
  je2-grid _category_featured
    je2-grid__content        grid 3 × 411.6px, gap 30px / 23px — ListingCards
je2-category__section  "The Journal"        grid 682/576, gap 30/22
je2-category__section  "Popular Links"      grid 4 × 303.7px, gap 22px
```

**The landing page's job is discovery, not listing**: browse by marque,
browse by named search, then a grid of real cars. The same `ListingCard`
appears here as on the results page — one atom, two contexts.

---

## 4. The detail page

`docHeight 4213` at 1440×900 = **4.68 screens**. Mobile 5.24 screens.

```
je2-listing__top _max-width _mobile-reverse            top 83, h 538
  je2-top-gallery _w-side-images    1281 × 500, radius 8px, overflow hidden
      main image     638 × 500  (ratio 1.276)   left column
      __side-images  638 wide column at left+642: two stacked 638 × 248 (ratio 2.573), gap 4px
  je2-top-gallery__controls         h 42 — "Save · Share" left, "1/30 Photos" right

je2-listing__body-wrapper           flex
  je2-listing__body                 901 wide → sections 849
  je2-listing__inquiry              380 wide, position: sticky   ← the contact rail
```

### Section order in the body column

Every body section: `padding: 24px 0 0` with `border-top: 0.8px solid #E0E0E0`
(the first has neither).

| # | Section | Heading | Content |
|---|---|---|---|
| 1 | `je2-listing-info` | *none* | h1 `2023 Bugatti Chiron` (Heldane 32/44) **left**, price `Price On Request` (Heldane 32/44) **right**, location beneath |
| 2 | `je2-listing-specs` | *none* | h 48 flex, `overflow-x: auto` — **value above label** pairs: "2023 / Year", "3K Mi / Mileage" (Inter 16/24) |
| 3 | `je2-listing-about` | **About This Car** (Heldane 24/32) | body Inter 16/24, `je2-read-more` clamp with expand |
| 4 | `je2-listing-details-table` | **Car Details** | `display:grid; grid-template-columns:138px 663px; gap:16px 48px` — VAT Type, Year, Location, Address … |
| 5 | `je2-ask-question` | **Ask a Question** | agent block + textarea (849 × 100) + submit |
| 6 | `je2-listed-by` | **For Sale by** | office info, listing count, report link |

Then, at full content width (1281), `padding: 48px 0 0`:

| 7 | **You Might Also Like** (Heldane 32/44) | ListingCard slider |
| 8 | **Related Stories** (Heldane 32/44, border-top) | Journal cards |

### The inquiry rail (desktop)

`position: sticky`, 380 wide, 330-wide fields:

- 64px circular agent avatar + name (Inter 16/24 w500) + "Joined 8 years ago" (Inter 16/24 `#717171`)
- "Call Agent" — icon + text in `#006C75`
- Fields **330 × 48**: `Your name` · `Your email address` · phone with country dial code · `Your message` (label Inter 14/22 `#717171`)
- Submit **Send message** 330 × 48

### Mobile detail

- Gutter 20px, content 354
- Gallery **full-bleed 394 × 341 (ratio 1.155)**, radius 0, `__side-images { display: none }` → one swipeable frame
- `je2-mobile-top-bar` — **sticky, h 70, z 20**, carries title + price once scrolled
- `je2-listing-info` becomes `flex-direction: column`; h1 and price both Heldane **28/32**, stacked
- Details table stays 2 columns: `138px 210px`, gap `16px 5px`
- **Inquiry rail `display: none`**
- `je2-listing__bottom-bar` — **position fixed, h 64, padding 10px 20px**:
  "Message" 301 × 44 bg `#006C75` white radius 0, plus a 44 × 44 call button
- Footer sections `padding: 32px 0 0` (48 on desktop)

---

## 5. What is actually worth taking

The patterns, not the paint:

1. **One card atom, everywhere.** Landing, results, "you might also like" —
   the same component. Learn it once.
2. **Price first.** Then `year make model`. Then place. Three lines, fixed order.
3. **Filters are a horizontal pill row, not a sidebar** — so results start
   near the top of the page. Depth lives in a drawer behind one filled pill.
4. **Dependent filters stay hidden until they can work** (models after make).
5. **The image ratio never changes**; only the column count does.
6. **Card typography never shrinks.**
7. **Count + sort sit together, right-aligned, above the grid**, as plain text.
8. **Nothing moves on hover except the photograph's own controls.**
9. **Detail page: gallery → title/price row → spec strip → prose → table →
   ask → seller.** Contact is duplicated: a sticky rail on desktop, a fixed
   bar on a phone.
10. **Value-above-label** spec pairs, horizontally scrollable on small screens.
