# AutoHaus

Four pages over the v34 design system — the measured Bentley-derived one,
unchanged — driven by the real inventory (87 cars, scraped from
`autohaus.bg/car`).

```
index.html        the brand — position, standard, chapters, expert, answers
collection.html   the collection — filter instrument over all 87 cars
vehicle.html      one dossier template, ?id=<slug>, serves every car
concierge.html    the request instrument — the reason this rebuild exists

style.css         the whole design system
main.js           shared core: config, data helpers, header, motion, focus overlay
collection.js     filtering + windowed rendering (collection.html)
showroom.js       the collection wall + the full-screen showroom layer
vehicle.js        dossier rendering, gallery, leasing
concierge.js      the step flow, matching, brief assembly, submission

data/vehicles.js  the inventory — the only file that changes week to week

SPEC.md           the measured spec this design system is built to. Still the
                  authority: if a number here and a number there disagree,
                  SPEC.md is right.
_previous/        the original 8-car build, kept because there is no git here
_v2_attempt/      a rejected redesign. Reference only, nothing loads it.
```

Run it with any static server — there is no build step:

```bash
py -m http.server 3010
```

---

## The two things you will actually need to change

### 1. Update the inventory

Everything on every page reads `data/vehicles.js`. Counts, filters, chapter
sizes, match numbers and the footer copy all derive from it, so there is no
second place to keep in sync — change the data and the site follows.

One record:

```js
{
  id: "911-targa-4-gts",          // slug, must be unique — it is the URL
  ref: "AH-018",                  // the plate number shown on cards
  make: "Porsche",
  model: "911 Targa 4 GTS",
  full: "Porsche 911 Targa 4 GTS",
  year: 2023, month: 10, unreg: false,
  km: 7000, hp: 480,
  fuel: "petrol",                 // petrol diesel hybrid phev ev
  gear: "auto",                   // auto manual
  colour: "Зелен металик",
  price: 142000,                  // or null for "цена при запитване"
  chapter: "performance",         // guard chauffeur performance utility
                                  // electrified classic saloon — ONE per car
  tags: ["performance"],          // any of the above plus "delivery"
  shots: ["https://…1.jpg", …],   // first shot is the card and hero image
  src: "https://autohaus.bg/car/911-targa-4-gts/"
}
```

`price: null` is a real state, not missing data — 16 cars are priced
privately, and the site treats that as a deliberate discretion rather than a
gap. Selling a car means deleting its record; `vehicle.html?id=…` for a car
that no longer exists shows a "sold, let us find you another" page rather
than an error.

`chapter` is what the collection filters on and what the homepage counts, so
each car gets exactly one. `tags` may repeat it and add `delivery`.

### 2. Point the concierge at a backend

Right now a finished brief is handed to the customer's mail client or
WhatsApp with the text pre-written. That works everywhere and costs nothing,
but it depends on the customer completing the hand-off.

To have briefs arrive as structured JSON instead, set one line — anywhere
before `main.js` loads, or edit the default in `main.js`:

```html
<script>window.AH_CONFIG = { endpoint: "https://formspree.io/f/xxxxxxx" };</script>
```

Any endpoint that accepts a JSON POST works — Formspree, Getform, an n8n or
Make webhook, or your own. The payload:

```json
{
  "ref": "AH-R-28986",
  "quality": "full",              // full | partial | light  <- route on this
  "intent": "source",
  "vehicle": { "id": "…", "ref": "AH-018", "name": "…", "price": 142000 },
  "wanted":  { "make": "Porsche", "model": "911 Turbo S", "must": ["4×4"], … },
  "budget":  { "band": "100-200", "bandLabel": "100 000 – 200 000 €", "pay": ["С бартер"] },
  "timing":  "До 3 месеца",
  "trade":   { "car": "BMW X5 xDrive30d", "year": "2019", "km": "90 000" },
  "contact": { "name": "…", "phone": "…", "email": "…", "reach": "Обаждане" },
  "matchesInStock": 3,
  "subject": "Заявка AH-R-28986 · Porsche 911 Turbo S · 100 000 – 200 000 € · До 3 месеца",
  "text":    "…the same brief as plain text…"
}
```

**`quality` is the field that buys back the owner's day.** `full` means the
brief has a car, a budget, a timeline and a reachable phone number — those
are worth reading personally. `light` means somebody clicked through without
answering anything. Filter on it before it reaches an inbox.

If the POST fails the brief is never lost: the page falls through to the
mail/WhatsApp hand-off with everything intact.

Other config keys: `email`, `salonPhone`, `expert`, `expertPhone`,
`whatsapp`, `address`.

---

## Design — v34, kept

The Bentley-derived design system is the one on every page. It was measured
off the live source with Playwright (see SPEC.md) and nothing in it has been
restyled: the 12-column grid and its gutters, the gold #c9a25a on the
#000 → #1b1610 gradient, Exo 2 at 300 for display and body with 600
uppercase at 1.3px tracking for labels, radius 0, no shadows, instant hover,
the master easing cubic-bezier(.16,1,.3,1), the inset 1344×702 hero box over
its blurred backdrop, the odometer counter, the card-wall expand, the frosted
teaser panels with their parallaxing decor squares, and the light paper
detail page.

An earlier pass replaced all of that with a darker, heavier identity of its
own. It was rejected and reverted; it is kept in `_v2_attempt/` for
reference and is not loaded by anything.

The three new pages were then built **out of the existing components** rather
than beside them:

| new thing | what it is made of |
|---|---|
| collection grid card | the card-wall card — same aspect, white ground, the same eased double-gradient scrim, same label / title / body order |
| filter chips | the button set at `--s` metrics; active state is the gold primary fill |
| quick-look overlay | the card-wall expand panel, lifted off the rail |
| concierge | the article teaser's frosted panel, given a whole page |
| vehicle dossier | the v34 light detail page, rendered from the dataset |

Only three genuinely new rules were added, each fixing a fault rather than
introducing a style:

1. Nav labels never wrap. "ЗА НАС" was breaking onto two lines and "КОНТАКТ"
   ran under the centred wordmark below 1280 — the left zone gets a fixed
   share of the 3-zone grid and five tracked uppercase links do not fit it.
   The last editorial link now waits for the width that can hold it.
2. `[hidden]` is forced with `!important`. `.btn` sets `display`, which
   silently outranks the attribute, so `el.hidden = true` did nothing —
   "Назад" and "Пропусни" were showing on the concierge's first step.
3. The dossier gets paragraph spacing, now that it runs to five paragraphs
   from the dataset instead of the two that were typed by hand.

## Speed and reach

The homepage used to ship **18.28 MB of photographs before it was usable**.
Every image was the WordPress original (700–900KB each), and the eight-slide
hero holds sixteen of them — all inside the viewport, so `loading="lazy"`
never applied to any of them. First paint is now **0.40 MB**.

| | before | after |
|---|---|---|
| first paint | 18.28 MB / 27 images | **0.40 MB / 2 images** |
| lazy, while scrolling | — | 3.41 MB / 11 |
| carousel, on demand | — | 2.83 MB / 14 |
| full scroll-through | 18.28 MB | 6.65 MB |

What did it:

1. **Right-sized sources.** WordPress already renders `-260x160`, `-300x188`,
   `-768x480`, `-784x490` and `-800x490` of every upload — verified present for
   all 87 cars. Each slot now carries `srcset` + `sizes` and the browser picks.
   `AH.img()` / `AH.srcset()` in `main.js` do this for anything rendered from
   the dataset; the static markup carries it inline.
2. **The blurred hero backdrop uses the 300px copy.** It sits under a 16px
   blur, so 300px is visually identical to 1280px — 83KB instead of 880KB, and
   roughly a tenth of the compositing cost, which is what old GPUs actually
   choke on.
3. **Slides load one ahead.** Only frame 1 has a real `src`; the rest carry
   `data-src` and are promoted as the carousel advances.
4. **Three font faces, not nine.** Only 300/400/600 are used and there are no
   italics, but all nine were being downloaded.
5. **Scripts `defer` from `<head>`**, so they download during parse rather
   than after it.
6. **`width`/`height` on every image**, so nothing shifts as they arrive.

### Old machines

Windows 7 tops out at Chrome 109 / Firefox 115 ESR. Everything here works
there. The three features that post-date it already degrade correctly, and are
used deliberately that way:

| feature | needs | what happens on Chrome 109 |
|---|---|---|
| `color-mix()` | Chrome 111 | the `rgba()` line above it wins |
| `animation-timeline: view()` | Chrome 115 | inside `@supports`; `main.js` drives the parallax instead |
| `text-wrap: balance / pretty` | Chrome 114 | ignored — normal wrapping |

`svh`/`dvh` (Chrome 108) are each declared with a `vh` line first, so an older
engine takes the `vh` value and a newer one the `svh`. One of those pairs was
in the wrong order and had been giving every browser `100vh` — fixed, so a
full-screen card no longer runs under a phone's address bar.

**Low-power path.** `main.js` reads `deviceMemory`, `hardwareConcurrency` and
`saveData`. Four cores or fewer, 4GB or less, or data-saver on, and
`<html class="lo-fx">` is set. That swaps the 16px hero blur and the two 40px
`backdrop-filter` panels for flat tints of the same value, and drops the
scroll-linked parallax. Layout, palette and timing are untouched — only the
compositing cost goes. Those three effects are what take a 2013 Intel HD
laptop into single-digit frame rates.

**`content-visibility` was tried and removed.** It skips layout for offscreen
bands, which means the browser has to guess their height — and the guess was
out by 338px across the CTA and the footer (5511px reserved against 5173px
real). A jumping scrollbar is a worse defect than the milliseconds it saves,
and the heights depend on the breakpoint and on how Bulgarian copy wraps, so
there is no honest fixed value to give it.

### Verified

Layout swept at 320 / 767 / 768 / 1023 / 1024 / 1366 / 1440 / 1920 across all
four pages: no horizontal scroll, no element past the viewport, no clipped
text, no tap target under 24px. All 68 image URLs referenced anywhere — static
markup plus generated cards — resolve.


## Mobile

Measured against `bentleymotors.com` with Playwright at 375×667, 393×852,
430×932, 360×800 and 412×915 (portrait, `isMobile`, `hasTouch`).

### The finding that mattered

**There is no scroll library.** No Lenis, no Locomotive, no ScrollTrigger, no
ScrollSmoother, no transformed body — checked for all of them. The scroll is
the browser's own. `html { scroll-behavior: smooth }` is set, but that only
affects anchor jumps.

What makes it feel expensive is **rhythm and restraint**:

- The whole homepage is **8.2 screens**. That is very few. Each swipe reveals
  a complete scene rather than part of one.
- The three article teasers are **exactly one screen tall each** — `min-height`
  resolves to 667 / 852 / 932 on the three iPhones. One photograph, one
  message, edge to edge.
- **Only five animations are scroll-driven**, all on `ViewTimeline` — so they
  run on the compositor and never touch the main thread — and all five are
  decoration: three teaser decor squares and the two CTA images.
- **Nothing fades in.** `getAnimations()` returns `[]` for every teaser panel,
  every piece of CTA copy and all card text. When a section arrives, its
  content is simply already there.

That last point is the one worth keeping. A fade-up on every block is what
makes a site feel templated; the confidence comes from *not* animating.

### What changed here

| | was | now (matches Bentley) |
|---|---|---|
| card rail snapping | `none` | `x mandatory` + `snap-align: start` |
| card width | 72.4% of viewport | **76%** (299px at 393 — theirs is 299) |
| teaser panel copy | left-aligned | centred |
| teaser headline | 28/34 | **32/38** |
| eyebrow | 12/16 | **10/14** |
| button label | 13–16px, ls 1.3–1.6 | **11/20, ls 1.1** |
| header row 1 | small pill, top-right | full-width outlined action |
| header row 2 | burger alone on the left | link · wordmark · MENU, balanced |
| scroll reveals | fade-up on every band | removed — matches their restraint |
| hero copy delay | up to ~5.6s behind the entrance gate | 0.8s delay, 2.4s gate |

The card rail was the biggest one. Snapping is off at 1024+ on purpose — it
fights the inline expand, which centres the opened card by scrolling the rail.
Below 1024 the open card goes `position: fixed` full-screen instead, so
snapping cannot fight anything there. It is now scoped to `max-width: 767px`,
and both behaviours were verified: at 1440 the rail still rests wherever it is
put and an opened card centres to within a pixel (276px of gap each side); at
393 five arbitrary scroll offsets all resolve to card boundaries.

A snapped rail also earns a piece of feedback that a free-scrolling one cannot
have: the framed card sits at full brightness and its neighbours drop to 62%,
so the eye always knows which car it is looking at.

### Type

The mobile scale does **not** change between 360 and 430 wide — one scale, no
fluid sizing, no `clamp()`. Verified identical on all five devices.

### Not measured

Two things resisted headless measurement, noted so nobody assumes otherwise:

- **Scroll-driven parallax travel.** In headless the `ViewTimeline`
  animations stay parked at progress 0, so the transforms read as frozen. The
  values they were parked at (`x −16, y 20` for the decor; `y 279` and `y 424`
  for the CTA pair) are exactly the start keyframes already recorded in
  SPEC.md, which confirms those numbers rather than replacing them. Per
  SPEC.md the travel is 16px x / 40px y for the decor and **573px** and
  **337px** for the two CTA images — that large, slow drift is the "heavy"
  motion, and it is already implemented here.
- **Their mobile flyout.** The burger did not open under automation, so the
  drawer here is built to the measured type scale and the house easing rather
  than copied.

## The Private Collection

The inventory is no longer a page you navigate to. It is a room you enter.

### 1. The wall (landing page, directly under the hero)

A drifting band of the real photography, before any words about the company.
It carries **no prices and no specification on purpose** — its only job is to
make the collection feel deep enough to be worth opening. Two rails move in
opposite directions at different speeds so nothing lines up and the eye keeps
finding a new frame.

Frames are dealt from different cars *and* different shots of the same car —
an interior next to a three-quarter next to a detail — because a row of
identical front-three-quarters is a listing, not a collection.

It never animates off screen (IntersectionObserver), pauses on hover or focus,
slows to 140s on `lo-fx` devices, and stops entirely under
`prefers-reduced-motion`.

### 2. The showroom (a layer, not a page)

"Влез в колекцията" does not navigate. The landing page stays loaded and
**recedes** — `scale(.972)` plus a dim on the master easing — while the
showroom rises over it. Closing reverses it and returns to the exact pixel.

The mechanics that make that safe:

- Scroll position is preserved by **pinning** the body at `-scrollY`, not by
  `overflow:hidden` alone, which collapses the offset and dumps you at the top.
- Restoring it is the fragile part: the document only regains its height once
  `position:fixed` comes off the body, so a scroll issued in the same tick
  lands against a zero-height page. The offset is set directly **and**
  re-asserted on the next frame, with `scroll-behavior` suspended for the hop.
  Verified exact at 1440 and 393.
- `history.pushState` on open, so Android back closes the room rather than
  leaving the site. Escape and the scrim close it too. Focus enters the close
  button and is trapped inside.
- Every trigger keeps a real `href` to `collection.html`. With JS off, or on a
  middle-click, it is an ordinary link to an ordinary page.

`collection.html` is unchanged and remains the no-JS path, the shareable URL
and what search engines index. The showroom is the same inventory entered a
different way — not a replacement.

### 3. Inside

Not a grid of equal cards. Every sixth item spans two columns, so the eye
moves through the gallery instead of scanning rows. Specification is hidden
until hover or focus (`grid-template-rows: 0fr` to `1fr`) — **desire first,
numbers second.**

Filters are two lines of chips: chapter, then marque. No dropdowns, no price
slider, no sort control — those belong on a marketplace. A chapter with
nothing in it is not offered at all.

The curated cards further down the landing page carry
`data-showroom="guard"` and friends, so they walk straight into a filtered
room rather than a filtered page.

### 4. On a phone

The showroom body is `scroll-snap-type: y mandatory` with
`scroll-snap-stop: always`, and each car fills the screen. It is a magazine
you turn, not a list you scroll. Specification is always visible there, since
there is no hover to reveal it.


## The business argument

The site exists to stop the owner being the switchboard. Four mechanisms:

1. **Answers before questions.** The nine questions that generate the most
   calls — availability, whether the price is final, why some prices are
   private, leasing, trade-in, viewing without an appointment, provenance,
   import timelines, and how to get the fastest reply — are answered on the
   homepage and repeated in context on every dossier.
2. **The concierge, not a contact form.** One question per screen, phrased
   as a conversation. It collects car, specification, budget, payment
   method, timeline, trade-in and contact, then shows the customer the
   finished brief before it is sent — which is what makes them finish it.
3. **A reward for answering.** After the budget question the page reports how
   many cars in the real collection match. Answering pays out immediately,
   and a good share of people find their car there and never need a human.
4. **A dignified exit for casual questions.** The concierge page ends with
   "just a quick question?" pointing at the answers and WhatsApp. Without
   it, five-second questions either fill a two-minute brief badly or become
   phone calls.

Ivan is repositioned, not removed: he is the fourth step of the standard —
the one who approves — and the published rules say a complete brief reaches
him personally within 24 hours while general questions are answered by the
site. That elevates him and filters for him at the same time.

---

## Notes

- Photography is hot-linked from `autohaus.bg/wp-content/uploads/…`. Moving
  the images onto the same host as this site would make the collection page
  markedly faster and remove the dependency.
- `autohaus.bg` itself is currently serving injected SEO spam (thousands of
  casino posts, hidden link blocks inside the WordPress nav). It does not
  affect this build — the scraper strips it and only reads the spec tables —
  but it is damaging the domain's search reputation and should be cleaned up.

---

## The vehicle dossier and the catalog (v39–v40)

### The reference that could not be measured

The brief named JamesEdition as the marketplace reference and asked for it to
be measured rather than assumed. It could not be: all four Playwright loads —
`/cars` and the Bugatti Chiron detail page, at 1440×900 and 393×852 — returned
Cloudflare's "Verify you are human" interstitial (HTTP 200, `title: "Just a
moment…"`, one screen of document, zero CTAs). Working around a bot check is
not something this build will do, so **nothing here claims to be derived from
JamesEdition's implementation.** What follows comes from the Bentley
measurements already in `SPEC.md` and from the psychology the brief set out.
If those pages need to be measured, the practical route is a browser session a
person has already passed the challenge in.

### Order is the design

The old detail page put a 142px specification strip second, 694px down, and
buried the gallery at 1287px. That is a listing. The dossier runs:

1. **Emotion** — `.vd-lede`, a lead frame at `clamp(420px, 72vh, 760px)` that
   scales from 1.06 as it settles. Marque, reference, model, and one line of
   figures. Nothing to read, one thing to feel.
2. **Beauty** — the gallery, full width, before any prose.
3. **Trust** — "Защо този", then how the car got here: the four-step standard,
   named, with the documents that back it.
4. **Detail** — the specification, now fifth. Nobody falls in love with a
   gearbox.
5. **Request** — the price panel, sticky beside the specification on a desktop
   so the ask is never more than a glance away.

### The gallery is one mechanism

`.vg-track` is a horizontal `scroll-snap-type: x mandatory` strip. On a phone
that is a native swipe with the platform's own momentum; on a desktop the
arrows scroll the same box. There is no JS animation loop and no transform
juggling, so it cannot drop a frame.

**The track is the state.** The counter, the thumbnail ring and the arrow
disabled-states are all read back from `scrollLeft`, which is why a swipe, an
arrow press and a thumbnail click can never disagree. Closing the lightbox
scrolls the track to whatever image was last magnified.

Two measured corrections: 3:2 across a 1344px column is 896px tall — taller
than the laptop reading it, so no photograph was ever seen whole; the frame is
now capped at `74svh`. And the arrows were centring on the picture *plus* its
filmstrip, 46px low, until `.vg-stage` gave them the right box.

### Highlights are derived, never invented

`highlights()` reads only fields that exist in the record — the guard tag,
`unreg`, `km`, kilometres per year against `year`, `price === null`, the
classic tag, `gear`, `fuel`, `hp`. A car with nothing remarkable in its data
gets the one claim that is true of every car here: full service history,
available at the viewing. No provenance is ever written that the dataset
cannot support.

### Search

Eighty-seven cars is exactly the size where dials stop being enough: someone
who already knows they want a G 63 should not have to walk Терен →
Mercedes-AMG to find it. `AH.matchQ` requires **every token to match, in any
order**, so "guard s600" and "s 600 guard" find the same car. Each car's
haystack carries its own Cyrillic marque spelling, so "мерцедес" and
"mercedes" are one query. `AH.sortBy` holds the one sort table.

Both live in `main.js` and are used by `collection.js` **and** `showroom.js` —
the page and the overlay must never return different answers to the same
question. The showroom gained sorting at the same time, for the same reason.

A search with no result is not a dead end: the typed words travel to the
concierge as `?q=` and arrive in the brief as "Търсих: …". The most useful
thing a person can tell you is the thing you did not have.

`/` focuses the field, Escape clears it, the query is in the URL, and a shared
link restores both the field and its clear button.

### Two measured fixes on the way through

- **`.back` was scoped to `.vd-hero`**, so the new lead frame rendered an
  unstyled link that fell out of the photograph. Below 1024px it is now hidden
  altogether: the masthead already carries a back arrow there, and two of them
  stacked down the left edge of the picture is one too many. The masthead's
  arrow is repointed at the car's own chapter on load, which is the only thing
  the in-hero button knew that the header did not.
- **The phone masthead is deliberately two rows** — the Concierge button sits
  above the logo — but `.phead` cleared only one, so the eyebrow on
  collection.html and concierge.html sat behind the logo row. Verified at 360
  and 393: 34px of clearance now.

Audited at 360, 430, 768, 1280 and 1440 across all five page types: no
horizontal overflow, no console errors, no failed requests.

---

## The catalog system (v41) — rebuilt on the measured reference

The earlier pass was designed from principle because JamesEdition sat behind a
Cloudflare check. It has now been **measured**: both pages loaded in a real
browser and every number in
[SPEC-JAMESEDITION.md](SPEC-JAMESEDITION.md) was read off the live DOM with
`getBoundingClientRect` / `getComputedStyle` at 1440×900 and 393×852. Hover
states were captured by moving a real pointer onto a card and diffing computed
styles, because their stylesheets are cross-origin.

### The correction that mattered

`/cars` is **not** a results grid. It is a *discovery landing page* — marque
slider, then named-search slider, then a grid of real cars. The results grid
lives at `/cars/all`. The first pass had been designed against the wrong page,
which is exactly why the landing-page brief did not fit it.

### Two files carry the whole system

- **`catalog.css`** — their geometry, our material.
- **`catalog.js`** — one card renderer and one filter engine, shared by the
  landing preview, the expanding layer, `collection.html` and "others from the
  collection". That sharing *is* the pattern: on their site the same
  `ListingCard` appears in every context, so it is learned once.

The translation is explicit, and only the paint changes:

| Theirs | Ours |
|---|---|
| pill radius `100px` | radius `0` (v34/Bentley) |
| teal `#006C75` | gold `#c9a25a` |
| white paper catalog | dark stage |
| Heldane + Inter | Exo 2 |
| `0.8px #E0E0E0` | `1px rgba(255,255,255,.14)` |

Everything structural is theirs and verified: photograph ratio **1.634 at every
breakpoint**, grid gaps **30/23** desktop and **20** row on mobile, pills **34px
tall with 6px gaps**, one filled pill and one only, a **400px** filter drawer
behind it over a `rgba(0,0,0,.3)` scrim, `138px` table label column, detail
gallery **1.276 main + two 2.573 stacked** at 4px gaps and 8px radius, a **380px
sticky** inquiry rail, and card text that **never shrinks** (16/14/14 at 393 as
at 1440).

### The finding that made the merge possible

Hovering one of their cards changes **nothing about the card** — no lift, no
shadow, no image zoom, no border shift, no underline. Only the photograph's own
controls fade in over `0.7s`. Verified with a real pointer, and reproduced here
exactly. Bentley's "no hover transforms" and JamesEdition's card discipline are
the same discipline, so the two references never had to be reconciled.

### The expansion

The preview grid and the expanded layer render **identical card markup at the
same column count**, so on opening the cards do not move or resize — measured
at x = 49 / 505 / 960 in both states. The room grows around them
(`scale(.985) → 1` on the master easing) rather than a new page arriving. The
scroll lock still pins the body at `-scrollY` and restores the exact pixel on
close (1312 → 1312 at 393), `pushState` keeps Android's back button meaning
"close", and Escape unwinds drawer → layer in that order.

### Where the data could not answer their question

Their **Body Style** and **Country/State** filters have no analogue in 87 cars
in one showroom in one city. Rather than ship controls the records cannot
answer, those two slots became **Раздел** (the seven chapters) and
**Двигател**. A filter that cannot be answered is a promise the page breaks.

Their mobile rail is `display:none` because the fixed bar replaces it. Ours
keeps the rail — it carries the leasing calculator and there is no other home
for it — but hides its buttons and footnote, because two identical concierge
buttons a thumb apart is the defect their `display:none` avoids.

### Four defects found and fixed during verification

- **`--line-d` was scoped to `body:not(.ah)`** in style.css, so on the dark
  pages `1px solid var(--line-d)` was an invalid declaration and every card
  border silently vanished. Declared at `:root`.
- **`grid-template-columns: 1fr`** on the single-column grid is
  `minmax(auto, 1fr)`, so the card's min-content width set the floor — and
  `.lc__name` / `.lc__meta` are `white-space: nowrap`, making that floor as wide
  as the longest model name. It pushed the track **46px past a 393px viewport**.
  Now `minmax(0,1fr)` with `min-width:0` on the flex children, which is also
  what makes the ellipsis work.
- **`.dgal` kept `grid-template-columns:1fr`** into the mobile media query,
  sizing the first gallery frame differently from every auto-placed one after it.
- A probe of my own reported the dependent Модел pill as visible when it was
  only *present*: `querySelectorAll` matches `[hidden]` elements. The rule was
  correct; the test was wrong.

Audited at **360 / 393 / 430 / 768 / 1280 / 1440 across 7 pages**: no horizontal
overflow, no console errors, no failed requests.

### v42 — carousel back, catalog on paper, the expansion animated

**The card wall is back**, and it is now derived from the data instead of
hand-typed: one card per chapter, each showing that chapter's dearest car, its
live count and its entry price. Its panel still opens in place, and its CTA
walks into the catalog layer already filtered while remaining a real URL with
JS off. It sits *after* the catalog preview, so the landing page reads
hero → discover by marque → the catalog itself → the chapters → services.

**The catalog surfaces are paper now**, following the reference: the two
landing sections, the expanding layer, its drawer and `collection.html`'s
results area are all `.pale`. The dark stage stays where AutoHaus earns it —
hero, card wall, teasers, footer — which gives the page a light/dark rhythm
rather than one flat tone.

That flushed out the same class of bug twice: **style.css declares the entire
paper palette inside `body:not(.ah)`**, so on a dark page every
`var(--ink)` / `var(--line)` / `var(--paper)` in the new block resolved to
nothing and the declarations were dropped — a white price on a white card.
`.pale` now carries its own copy of the palette and is self-contained.

**The expansion is a clip-path unfold.** The panel starts clipped to the
*visible* rectangle of the preview grid and animates that inset to zero over
`.62s` on the master easing, so the white surface opens from exactly where the
cards already are. The bar and tools arrive 160ms behind the opening edge and
the grid at 220ms; closing drops those delays (`.is-closing`) so the contents
never finish before the panel and leave an empty box collapsing.

Measured: origin `inset(384.7px 48px 0px)` at 1440 and `inset(406.9px 16px 0px)`
at 393 — the grid's own rectangle, gutters included — animating to `inset(0)`
and reversing on close. `clip-path` and `opacity` are both compositor
properties, so it costs no layout.

The origin falls back deliberately: the clicked section's grid, clipped to the
viewport; if under 80px of it is visible, the trigger's own rectangle, which is
on screen by definition because it was just clicked. Without that fallback a
click on a half-scrolled trigger collapsed the origin to a sliver at the screen
edge and the unfold read as a wipe.

Re-audited at 360 / 393 / 430 / 768 / 1280 / 1440 across 7 pages: clean.

### v43 — the finishing pass

Seven changes asked for by the owner, plus what each one turned over.

**The mark carries the bar.** `--logo-w` was 88/110px against 13px tracked nav
labels, which read as a caption rather than as the brand. It is now stepped per
breakpoint — 104 / 128 / 136 / 152 / 168 — and every page picks it up, because
they all share one header.

**A veil under the header.** The nav sets white type over a photograph whose
luminance changes every ten seconds, so on the sunlit showroom frame the menu
was genuinely hard to read. Two fixes, at two levels: the blurred backdrop is
held at `brightness(.5) saturate(.86)` instead of following the picture (the
`ah-bg-entry` keyframe now lands on the same value, or the bleed would step
brighter the moment the entrance hands back), and `.hd::before` lays a
graduated shadow under the bar — a linear ground plus a radial pool under the
middle zone, which is where the mark sits. It fades out before the framed
picture starts, and it is `pointer-events:none`, because it hangs 96px below
the bar and would otherwise swallow every click on the hero.

**The odometer counts in the carousel's own base.** The position strip stepped
with `(d + 9) % 10`, which is right for an odometer and wrong here: with three
slides, wrapping 3 → 1 rolled `3,4,5,6,7,8,9,0,1`. It now walks back through
`1..N`, so that wrap is two digits and no reachable position is skipped.

**The chapter carousel became a service carousel.** Seven cards of inventory
chapters — a question the catalog's own pill row and drawer answer far better —
gave way to four cards of what the showroom actually does: Лизинг, Auto Spa,
Внос по поръчка, Изкупуване и бартер. Two of them carry the page ids the rest
of the site links to (`#lizing` from every header and footer, `#care` from
three), so the leasing calculator moved into the Лизинг panel rather than being
deleted with the band it used to live in, and main.js opens the matching card
when one of those links lands — instant scroll first, because below 1024 the
open pins the body at whatever offset it is on.

The scrubber row also had to stop reserving space it does not use:
`visibility:hidden` left 42px of nothing under a rail that, at four cards, fits
a desktop exactly. It is `[hidden]` now.

**Three bands removed.** The centred intro paragraph under the carousel (the
hero, the collection blurb and the За AutoHaus band all said it already) and
the last two full-bleed teasers. `.intro` and the `--intro-*` tokens went with
them.

**The card stopped stepping its own photograph.** The grid card carried hover
arrows, a `1 / 24` counter and an `24 кадъра` pill. The arrows were invisible
twice over — white strokes on a 34%-black gradient over a sunlit bonnet, and
their `<use href="#arrow">` pointed at a symbol only two of the four pages
define, so on the landing page they rendered an empty box. All three are gone,
along with `AH.cardGallery`. What hovers now is one idea instead of three: the
frame breathes to 1.06 over 800ms, a wash lifts under the corner and a
`РАЗГЛЕДАЙ →` cue rises into it with its rule drawing itself. The hairline goes
gold — restated for `.pale` and `.lc--paper`, because a 4% white wash is a lift
on a dark grid and a hole in a white card.

**The dossier gained a contact sheet.** Above 1024 the mosaic showed three
frames of however many a car has and the line under it announced the total with
nothing to click; the rest existed only inside the lightbox. `Виж всички N
кадъра` now opens every frame in place — two columns on a phone, three above
1024 — and the box becomes the sheet's own footer control rather than pinning
itself to the bottom-right of a 2000px grid. The frame it covers when collapsed
gives up its counter badge; below 1024 it takes the opposite corner instead.

Verified in Chromium at 1440 and 390: no console errors, no failed requests
(bar the site's missing `favicon.ico`, which predates this pass), the deep
links from `collection.html` and the phone menu both land on an open Лизинг
card with a live calculator, and 400px of wheel over the rail still moves the
page 521px.

### v44 — the house angle

The owner's own mark on autohaus.bg sits in a black wedge in the top-left
corner, its right edge cut on a diagonal. That cut is the only piece of drawn
identity the business has, so it is now a rule rather than a decoration.

**The ratio.** Measured off that plate: 0.46 of the height in horizontal
travel, i.e. 24.7° off vertical. `--shear` in style.css holds it, and the
comment beside it states the three things anything new has to obey — the top
edge is the long one, the cut faces INWARD (a chip anchored left is cut on its
right, one anchored right is cut on its left), and the padding on the cut side
carries the cut on top of its own inset or the text runs out through the
diagonal. Two nearly-equal angles read as a mistake; one repeated angle reads
as a signature.

**Where it is allowed.** Only on things that sit ON something: the brand
plate, the card badge, the service-card label, the dossier's frame counter and
its contact-sheet box. Never on a button, a field or a card — the underlying
system is square (radius 0, hairline borders) and the angle is the accent, not
the grammar. The contact-sheet box proves the rule by dropping the angle when
it stops being a chip on a photograph and becomes a control in the flow.

**The brand plate.** Two wedges in the top corners of the landing page, and
they do a job as well as saying a name: the header is `position:absolute` and
scrolls away with the hero, which left the entire page below the fold with no
mark and no route back to the menu at all. They slide in the moment the hero
is off the screen and slide back out when it returns, so the hero keeps the
three-zone header it was designed with and everything after it is signed.

Armed by an `IntersectionObserver` on the hero itself, not a scroll offset —
the hero is taller than the screen on a phone and shorter on a desktop, so any
fixed threshold is wrong on one of them. `isIntersecting` going false *is* the
definition of "after the hero banner", at every height.

Three details the band depends on. It is `pointer-events:none`, because the
middle of it lies across the page and would otherwise eat every click there.
It is `overflow:hidden`, because the wedges park at `translateX(±101%)` and
without the clip that is real content past the viewport edge and a horizontal
scrollbar at every width. And `visibility` switches instantly on the way in but
only at the end of the slide on the way out (`visibility 0s linear .62s`) —
it is a discrete property, so a plain transition flips it at the halfway mark
and the wedge spends 300ms hidden while it is still visibly moving.

The plate carries a second Меню trigger. Both triggers drive the one overlay,
both carry its `aria-expanded`, and on close focus returns to whichever of them
is actually on the screen — returning it to the header burger, which scrolled
away with the header, is how a keyboard user loses their place.

Re-audited at 390 / 768 / 1024 / 1440 / 1920 across all four pages: no
horizontal overflow, no console errors, no failed requests.

### v45 — one plate, two languages

**The plate is one wedge now, and the trigger sits inside it.** Two wedges in
opposite corners were two objects the eye had to visit; together they are one
object with the mark as its destination, which is also how the owner's own
plate reads. Menu first, then the mark.

**And it draws itself rather than sliding in.** The closed state is a
zero-area sliver at the left edge that already carries the angle:

    closed  polygon(0 0, CUT 0, 0 100%, 0 100%)
    open    polygon(0 0, 100% 0, calc(100% - CUT) 100%, 0 100%)

Interpolating those holds `point2.x - point3.x` at exactly CUT on every frame,
so the diagonal keeps its lean the whole way across instead of starting
shallow and steepening — the difference between a shape being drawn and a
shape being pushed. The contents do not travel with the wipe; they rise into
place behind it, trigger at 140ms and mark at 220ms, so there is one long
gesture with two short ones inside it. Leaving reverses the order — contents
first, then the geometry closes over the space — which is the rule the
card-wall panel already follows.

**Колекцията and Калкулатор are gone from the bar.** Both were already in it
twice over: Автомобили and Лизинг sit on the left and the whole menu is behind
the burger. The language switch took the space, because it was the one control
with nowhere else to live.

**BG / EN, and the key is the Bulgarian.** `i18n.js` walks text nodes and
translatable attributes and swaps any whose content it recognises. That choice
is the whole design:

  · no other file changes, so nothing can drift out of step with the copy;
  · a phrase that is not in the table stays Bulgarian rather than rendering as
    a missing key — the failure mode is "untranslated", never "broken";
  · the five renderers that assemble half the visible site out of the dataset
    need no `t()` calls at all, because a MutationObserver translates whatever
    they drop into the DOM on the next frame.

Three layers do the work. An exact table for the 300-odd fixed phrases. A
pattern list for everything carrying a number, which an exact table cannot
hold — "Виж всички 87 автомобила" moves with the inventory. And a splitter for
the middot-joined lines a card and a dossier build out of independent facts
("500 км · 530 к.с. · Бензин"), which looks up each part on its own rather
than needing a pattern per permutation of what a record happens to carry.

The dossier's generated prose is done with whole-sentence patterns and never
with fragment substitution: a sentence that comes back half-translated reads
worse than one that never changed. The original Bulgarian is cached on the
node, so switching back is an exact restore, not a second translation. The
choice persists in localStorage and `<html lang>` follows it.

**The switch is a wipe, not a repaint.** A language switch that simply
repaints reads as a glitch — the eye sees a page it already knows change under
it and cannot tell what moved. A panel at the house angle sweeps in, the text
is swapped where nobody can see it, and it leaves the other way with the new
language settling in behind it. The word being switched to rides the panel, so
the change is announced rather than discovered.

Coverage was measured, not assumed: a Chromium pass walks every text node on
all four pages in English and reports anything still Cyrillic. It reports
nothing, on all four, except the `<noscript>` block — which only renders when
scripting is off, in which case the switch cannot run either.

Re-audited at 390 / 768 / 1024 / 1440 / 1920 across all four pages: no
horizontal overflow, no console errors, no failed requests.

### v46 — the refinement pass

The identity was right; the execution was a set of working animations rather
than a designed one. This pass is about the difference.

**One curve per job, and everything on it.** The site had five named curves and
a seven-step duration scale, and about forty rules that ignored both — `.4s
var(--ease)`, `.5s ease`, `ease-out`, a `linear` opacity on a full-screen
surface. Everything now resolves to a token, and the rule for which token is
physical rather than aesthetic:

    arriving, opening, photographs   --e-mass   long glide, soft landing
    leaving, dismissing              --e-exit   slow to commit, then gone
    travelling between two places    --e-move   eased both ends
    a control answering a pointer    --e-ui     fast in, settled out

The single biggest change is that **departures stopped using the arrival
curve.** A thing that leaves on an ease-out hangs about at the end of its own
exit, which is what made every dismissal on this site feel slow even where it
was short. Every overlay, drawer, panel and bar now opens on mass and closes on
exit, and the close is deliberately the shorter of the two.

Two timings were plainly wrong rather than merely inconsistent: the dossier's
section reveal moved **72px over 2.4 seconds** (a section that arrives after the
reader has gone looking for it), and the catalog layer faded a full-screen
surface on a **straight linear ramp**. 26px/950ms and `--e-mass`.

**The plate is drawn, and what it uncovers lags behind the edge.** The wedge
now opens on `--e-mass` instead of `--e-enter`, which had it covering 80% of
its travel in the first quarter of the time — a snap on an object that size.
The contents lost their opacity fade entirely: they are children of the clip,
so the diagonal is already their mask, and fading them on top of a mask is the
one thing that made this read as a web animation rather than a reveal. They
now only lag — 26px along the wipe's own axis, trigger at 100ms, mark at 160ms,
language at 240ms — so the plate assembles left to right at two speeds.

It also gained a body: a `drop-shadow` (which follows the clip, so the diagonal
casts a diagonal — and costs nothing while the wedge is a sliver, so the shadow
grows with the reveal for free), a surface gradient, and a 1px lit top edge.

**The switch moved into the plate, and stopped being a button.** Below the hero
the header is gone, and the language control went with it — you could change
language on the first screen and nowhere else. Trigger, mark, language now
share one wedge with the mark between them as the anchor. And the control is no
longer a bordered box with a solid gold cell sliding inside it: it is two words
on a hairline with a 2px gold rule travelling underneath. Same mechanism, but
the gold marks a position instead of filling a button — on a 56px black wedge
the filled version was the brightest object on the plate, competing with the
mark it sits beside.

**The blade.** The language wipe covered, paused, and withdrew, and the page
then faded itself back in behind it — which is exactly the "loading" feeling a
language switch must never have. Now: the cover accelerates and the clear
decelerates, so the two halves meet at maximum velocity and read as one blade
passing through the screen. The panel is sized to the viewport plus its own
lean instead of 400vw, so both of its skewed edges are on screen during the
pass, and each carries a 2px rule in the house gold — the eye tracks the lit
edge, not the darkness. The page underneath does not move at all.

The nameplate moved inside the panel. As a sibling it was pinned to the middle
of the viewport while the panel travelled, so for ~300ms of the clear it hung
over a page that was already revealed. Carried by the blade it can only ever be
over black — and it lands centred for free, because a panel that is the
viewport plus its lean has its centre exactly at the viewport's centre.

**Elevation is light, not boxes.** Two steps, not five, and nothing carries a
shadow at rest: a grid of 87 shadowed cards is the cheapest-looking thing a
catalogue can do. Things that genuinely leave the surface get one wide, very
soft shadow that reads as ambient occlusion, plus a 1px lit edge, which is most
of the effect. Overlay scrims went from flat percentages to graded ones, so the
scrim tells the eye which way the depth runs.

**The menu was the weakest surface on the site** and had a silent bug: the
entrance animation used `animation-fill-mode: both`, whose end keyframe sets
`transform` — so every row's transform was pinned for as long as the menu was
open and the hover moved nothing, at any width. `backwards` holds the from-state
for the stagger and hands the element back to its own rules on landing. The
menu also gained the mark, a bounded column so the rules measure the type
rather than the viewport, a two-column layout above 1024 (60% of a desktop
screen was empty), a lit ground, and the stagger it previously only had on
phones.

Measured, not eyeballed: a Chromium pass reads the computed value of every
hover on the site before and after the pointer arrives and reports any rule
that changes nothing. All seven respond. A wheel probe at eight scroll offsets
delivers 300px of page movement for 300px of wheel at every one, with no
scrollable ancestor under the pointer anywhere. Re-audited at 390 / 768 / 1024
/ 1440 / 1920 across all four pages: no horizontal overflow, no console errors,
no failed requests.

### v47 — the navigation system

**The menu is a panel, not a takeover.** It was a full-screen sheet: the page
vanished, a list appeared on black, and the visitor was somewhere else until
they closed it. That is a modal, and a modal is the one thing a navigation
should never be — it breaks the feeling of being inside the site at the exact
moment the visitor is deciding where in the site to go.

It belongs to the same object as the plate now. The sheet's shape IS the plate
with a body: full width across the top, cutting in by `--plate-cut` over
exactly the plate's own height, then vertical for the rest of the drop. Opened
from the trigger in the plate, it reads as that wedge growing downward.

**The reveal is a rake that settles.** Two clips, because one element cannot
carry two — `.mob__sheet` holds the architecture, `.mob__reveal` holds the
motion:

    closed  polygon(0 0, 100% 0, 100% -34%, 0 0)
    open    polygon(0 0, 100% 0, 100% 100%,  0 100%)

The two bottom points travel different distances, so their difference — the
rake — falls linearly to zero. The panel arrives on the diagonal and settles
square. The page behind stays visible and goes quiet: a graded scrim at
`blur(6px)`, tuned down from 10 because at 10 the page stopped being a place
and became a texture. Clicking it closes the menu, which is the exit a modal
never offered.

461px of a 1440 viewport, 320 of a 390 — a strip of the page is visible at
every width, which is the whole point of the redesign and had to survive the
smallest screen.

**The plate lost ~18% of its height and none of its presence.** 56/64/68/76/84
→ 50/56/58/62/68. A 76px black band at 1440 is 8.4% of the viewport,
permanently, and over a long browse it was competing with the page rather than
accompanying it. The mark takes a *larger* share of the smaller plate (1.72 of
its height, up from 1.58), the internal gaps and the label step down with it,
and the shadow went from `.52` to `.4`.

The bigger change is material: the plate is **translucent with a real blur**
now. The content it covers stays faintly legible underneath, so the eye treats
it as chrome rather than as a second page — which is most of why it stopped
competing.

**One navigation system across four pages.**

  · The catalog popup opened with the words "AutoHaus · Пловдив" set as an
    eyebrow on a plain band — the one navigation surface on the site that
    spelled the name out instead of signing itself. It carries the plate's
    corner now: same shear, same material, same mark, same height, so arriving
    in the collection from anywhere puts the identity where the reader last
    saw it.
  · `collection.html` and `concierge.html` have the same `position:absolute`
    header as the landing page, so both lost their mark AND their menu the
    moment the reader scrolled — the landing page transformed and the internal
    pages simply went bare. Both carry the plate now, armed off their own
    masthead rather than off a hero they do not have.
  · The fixed filter bar stacks under it rather than beneath it. `main.js`
    publishes `--plate-top` on `<html>`, so the bar reads one custom property
    and nothing else had to be taught about the plate. Measured: plate bottom
    62, bar top 62, overlap 0.

**The language switch stopped being a button.** A bordered box with a solid
gold cell sliding inside it was merely loud in the header; inside a 50px plate
it was the brightest object on the wedge, competing with the mark beside it.
Two words on a hairline with a 2px gold rule travelling underneath — same
mechanism, but the gold marks a position instead of filling a button.

Verified: 20 page×width combinations with no horizontal overflow, no duplicate
ids, no console errors and no bar overlap; the hero is byte-for-byte the state
it was designed in (plate hidden, header mark still 152px); Tab cycles the ten
focusable things inside the panel and never escapes to the page behind it;
Escape returns focus to the trigger and restores the scroll position exactly;
and under `prefers-reduced-motion` the panel and the language switch both still
work.

### v48 — the polish pass

Nothing new. Three defects found by measurement rather than by looking, and
the last of the console noise.

**THE FILTER BAR'S RELEASE WAS THROWING THE READER 76px.** Riding the threshold
frame by frame on collection.html: on the way back up the document collapsed
3851 -> 3765 in one frame and then crawled back over 28 frames, and the browser
dragged the scroll from 345 to 269 and back again. Three separate causes, all
of them real:

1. **`AH.morph` animated the root's height.** When the root ends the morph out
   of the flow — the popup's tools, or the bar while it is still fixed —
   animating its height costs nothing. When it ends IN the flow, its height IS
   the document's height, and animating it animates the document for 340ms.
   The box snaps now and the FLIP'd parts carry the motion, which is what a
   FLIP is for: the eye follows the type, which is gliding, not the background
   edge, which is already home. Measured after: `docHeights=[3851]`,
   `scrollYs=[345]` — the document and the scroll are constants.

2. **The trigger did not know about the plate.** The sentinel answered "has the
   bar reached the top", and the bar used to land there — but it lands at
   `--plate-h` now. A `rootMargin` of `-{plate-h}` moves the moment of judging
   to the moment the flow position equals the pinned position. Measured: flow
   top 62 -> fixed top 62.

3. **One stack, two triggers.** The plate armed off `.phead` and the bar off
   the sentinel, 62px apart — so the plate arrived after the bar had already
   pinned and shoved it down its own height, in one frame. Where a tools bar
   exists it now owns the moment: `collection.js` calls `AH.armPlate()` inside
   the same synchronous mutation that pins the bar.

Verified at 390 / 1024 / 1440, both directions: the first card below the bar
never moves except by exactly the distance scrolled, and no scroll is refused.

**THE POPUP'S BAR ON A PHONE** was three objects fighting over 390px: the
wedge, a count ellipsised to "87 авто…", and a 117px close button. The count is
stated in full one row below, so it goes; the close keeps only its mark. The
count/sort row below it was breaking into three lines — `flex-wrap:wrap` let
the browser break INSIDE the count — and now takes a row each.

That fix then caused its own regression, which is the most useful thing in this
entry: **letting the count wrap made the pinning bar's resting height stop
being a constant**, and a resting height that is not a constant cannot be
reserved in a spacer. Measured at 390: 22px of slip back into the grid and nine
refused scrolls. The wrap is now allowed only where nothing reserves the height
— the landing preview, which is in the flow, and the popup's tools, which
overlay. The pinning bar keeps one deterministic line.

**A favicon**, lifted from the `#ah-logo` sprite so the tab mark cannot drift
from the logo, and cropped to the car alone: at 16px the wordmark beside it is
not type any more, it is noise. That was the last 404; the console is silent on
all 20 page x width combinations.

Standing checks all still pass: seven of seven hovers respond, Tab cycles the
menu panel and never escapes, Escape returns focus to the trigger and restores
the scroll exactly, the hero is untouched, and reduced motion works.

### v49 — subtraction

Four removals and one fix. Nothing was added.

**The bare top band.** The plate is ~380px of a 1440 viewport, so across the
remaining 1060 the page ran under the top edge with nothing behind it — on the
collection page, card photographs sliced off mid-bonnet against the viewport
edge with a full-width filter bar immediately beneath. `.plate::after` gives
that band the same graded floor the hero header uses: a shadow, no tint, gone
before it reaches the content, and armed with the plate so the hero never sees
it.

**"Разгледай по марка" is gone.** Fourteen marque tiles in a scrolling row is a
stock-catalogue pattern. Nobody arrives at a private collection of 87 cars
wanting to browse by badge, and it pushed the collection itself below the fold.

**The armoured chapter is gone, the armoured cars are not.** "Брониран клас"
was a chapter in the taxonomy and a badge on every card that carried the tag.
It is a specification, not a way anyone chooses a car — those five vehicles are
chauffeur cars first and armoured second. The cars keep their place in the
collection under `chauffeur`; what protection they carry is on the dossier,
reviewed in person rather than advertised.

**The filter row fits.** It was six dropdown pills plus the Филтри button —
wider than a 1440 laptop and far wider than any phone, so the last controls sat
off the right edge behind a horizontal scroll almost nobody finds. The filters
were not hard to use; they were invisible. The row is now what a buyer at this
value narrows by first — marque, then money — with year, chapter and engine in
the drawer they already shared. Measured: zero overflow at 1440 AND at 390,
where it used to hide two controls.

**The landing preview is a selection, not an instrument.** It rendered the full
pill row — every marque, then the chapters — above twelve cards: a weaker
duplicate of the tool that lives one click away, and long enough to scroll off
the edge at every width. The count, the sort and "Виж всички" stay.

### v50 — the consultation room

The concierge was the last page still built like a form. Its flow was already
right — one question at a time, branching on the intent, a real brief at the
end — and none of it looked like AutoHaus: no photograph, no wedge, no stage,
no elevation. Put beside the landing page the two shared a stylesheet and did
not read as the same company. It is a room now. Nothing about what it collects
or what it sends changed; the payload above is identical.

**The stage.** One photograph of the showroom floor, lit by a gradient raked to
**the house angle** — 24.7° off vertical, the same lean as the corner plate and
the language wipe, so the gradient travels at 114.7° and its bands lie parallel
to the cut. The angle does *lighting* here rather than shape, which is the only
way a full-height surface can carry it: the wedge ratio is 0.46 of the height in
horizontal travel, and on a 900px panel that is 414px — a triangle, not a
signature. So the room is raked and only two small things are actually cut: the
Concierge tag and Иван's plate. Both obey all three rules (long top edge, cut
facing inward, padding on the cut side carrying the cut). No `filter` and no
`backdrop-filter` anywhere on the page: a full-bleed `brightness()` repaints the
viewport on every scroll frame, and this page has two sticky objects moving over
it.

**The host.** A rail that stays with you and is named: Иван, in a plate, with a
line that **changes with the question** ("Числото не е обещание. То само скъсява
търсенето."). Under him, the spine — which is the page's one genuinely new
idea and also a subtraction. It started as two components, a progress bar and a
"what you have told us" list, and they turned out to be the same object: every
question the reader will actually be asked, in order, with its **answer printed
under its own name** once given, and each answered row a button back to the
question it came from. That is the difference between a form asking and a person
listening, it makes the review step a confirmation rather than the first chance
to correct anything, and it costs less height than the two lists did — which is
what makes a sticky rail survive a 1024×800 laptop. Below 1024 the spine lies
down into the 2px meter it replaced and the answers come back as a one-line
receipt on top of the action bar, collapsed under a fade, tap to open. Only ever
one of the two renders, so nothing is duplicated in the focus order.

**One question, always on the same line.** The conversation column has a fixed
top inset instead of centring, so the question lands at the same y on every
step and nothing about the page moves between them. Measured frame by frame
across a step change at 1440: **0.0px of drift** on the rail, the column, the
action bar and the room, and 0px of scroll. Arrivals run on `--e-enter` with the
parts landing in sequence (question, help, then the controls at 80ms apart);
departures run on `--e-exit` and are shorter, with the outgoing step lifted out
of the flow and marked `inert` so nothing in it can take focus while it leaves.
The greeting recedes once the first answer is given — pleasantries that stay on
screen for eight questions stop being pleasantries, and the rail needs the room.

**Nine defects found by measuring, not by reading.** Five were on this page and
four were site-wide, found because this page happened to show them:

1. `textarea` was missing from `button,input,select{font:inherit}`, so the two
   free-text boxes — where people write the most personal part of an enquiry —
   set their text in the browser's default **monospace**. Also fixed the vehicle
   page's enquiry box.
2. **The header collided with its own wordmark at 768–939** on every page: the
   fourth editorial link ran underneath it, and the Concierge button overhung it
   by 34px at 768. The start and end zones are fixed `1fr` shares of a 3-zone
   grid, so no amount of gap tightening recovers the space. "За нас" drops (it is
   in the drawer and the footer) and so do the social marks (in the footer, the
   drawer, and the footer again). Clearances now 34/54px at 768, 37/52px at 940.
3. The action bar is opaque over a photograph, so a background on its own box
   drew **a hard vertical seam down the middle of the room**. The ground is a
   separate layer that overhangs the column and feathers out on both sides.
4. That overhang was 56px each side and **overflowed the document** — 40px at
   360, 24 at 900, 16 at 1280, hidden by `body{overflow-x:hidden}` and real all
   the same. `overflow-x:clip` on the room, not `hidden`: `hidden` would make it
   a scroll container and the sticky rail would stop sticking.
5. The bar's ground ramp was in **percentages**, so on a phone (194px tall bar
   with the receipt on top) "opaque by 26%" left the first line of the record in
   the transparent part and the match readout read straight through it. Lengths,
   and the feather moved above the bar.
6. Exo 2 has **no glyph for U+21B5**, so the keyboard hint rendered as an empty
   box. Drawn as an SVG.
7. The masthead below 1024 kept the rail's spacing and pushed all four option
   cards below the fold at 900×700. Tightened; measured again.
8. Enter on a focused chip **skipped the step** instead of toggling the chip.
9. The footer's whole legal column, both social labels and the VAT line were
   never in the dictionary, so they stayed Bulgarian in English **on every page**.
   Found with a walk that reports every text node and translatable attribute
   still in Cyrillic after the switch — the flow now reports clean at all nine
   steps. "Срок" also meant two different things (a leasing term and a delivery
   timescale) through one key; the leasing selector asks for "Срок в месеци" now.

### v51 — the catalog layer: a real instrument

The popup held one gold **Филтри** pill, four marque pills out of fourteen,
and everything else behind a 400px drawer. Three faults, and the middle one
is the worst thing on the site so far:

**Ten of the fourteen marques were unreachable in practice.** The row showed a
shortlist; the rest lived in the drawer. And the drawer had been built in the
dark theme and shipped onto a white panel with **no `.pale` override at all**,
so every one of its chips rendered white on white. A buyer who wanted an Audi
could not see that Audi existed, and a buyer who opened the drawer to find out
could not read it. The lesson is stated in the CSS where the overrides now
live: a control that exists on both surfaces has to be written twice, or it
does not exist on one of them.

**The mark sat on the top edge of its own wedge.** A second `.cat__id` rule —
a leftover from when that wedge held a mark *and* a count on two lines — set
`flex-direction:column` after the rule that centred it. The count had moved to
the tools row long ago; the column stayed. Measured: mark top 0 in a
49/55/57/61/67px bar, at all five breakpoints. One rule now.

**The card wore a sticker.** `.lc__badge` pasted "Доставъчен пробег" /
"Нерегистриран" / "Класика" into the corner of the photograph. It landed on
some cards and not others, so a grid of eighty read as unevenly finished; it
is the visual language of a marketplace listing rather than of a collection;
and every fact it stated is already on the card — 500 км *is* delivery
mileage — or on the dossier, where it can be explained instead of asserted.
Gone, with its CSS. `AH.sorts.recent` still reads the `delivery` tag: sorting
by it was always fine, advertising it was not.

#### What replaced the pills

**Eight named controls in one row.** Марка · Модел · Цена · Година · Пробег ·
**Мощност** · Двигател · Раздел. Each states its own question when empty and
its own answer when set — "Марка" becomes "Porsche", "Мощност" becomes "от
500 к.с." — which is the trick that keeps eight of them inside 704px at 768,
*narrower than the four pills they replace were*. Nothing is hidden behind a
count; every filter this collection can answer is a word on the screen before
anything is clicked. Модел still appears only once a marque makes it
answerable.

The control is the concierge room's option card at bar scale: hairline box, a
gold rule drawing down the leading edge when it carries a value, a lit top
edge under the pointer. Same grammar, one third the size — and square,
because the house angle is for things that sit ON something, never for a
button or a field.

**Horsepower is a first-class filter now**, because it is the one
specification a performance buyer opens a catalogue with and every record in
the set carries it. It went into the engine rather than beside it: `Пробег`
had been bolted onto `AH.*` from showroom.js by wrapping six entry points,
with a comment saying it belonged in catalog.js. It does — a filter the
instrument offers has to be one the engine owns, or the counts, the badge and
the shared URL are computed by a different definition of "matches" than the
results are. Both live in `catalog.js` now and the adapter is gone.

**One description, two surfaces.** `panelBody(kind)` returns the inside of a
control's panel and is used verbatim by the dropdown from 768 up and by the
stacked sheet below it. A filter cannot behave differently depending on the
width of the screen it is read on, because there is only one description of
it. Below 768 the row is a single **Филтри (n)** control opening a bottom
sheet with all eight panels; the drawer that slid in from the left is gone.

#### Six more found by measuring

1. **The phone's close button had no ✕.** The `@media(max-width:599px)`
   overrides for `.cat__x` are declared 60 lines *above* the base rule at
   equal specificity, so source order handed back its 41px padding and its
   10px gap: the button became 57px of pure padding with the mark squeezed to
   zero height. An empty black wedge where the only way out of the collection
   should be. The overrides now sit with the rule they override.
2. **Horsepower snapped to 499.** A range input steps from its `min`, so with
   min 89 and step 10 the reachable values were 89, 99 … 499. Typing "500"
   read back as "499–839 к.с.", which looks like an arithmetic bug in a shop
   selling cars by the hundred thousand. The bounds round outward to 80/850.
3. **The condense FLIP was given the wrong element.** The filter row is
   wrapped now (a panel cannot open out of a horizontal scroller — it would
   be clipped at the first edge), so `AH.morph` has to be handed the wrapper,
   which is the grid item. Verified after: `bodyHeights: 1` — the scroll
   container still never changes size while you are scrolling it.
4. **The dossier's question box was styled by a filter component.** It
   borrowed `.fin` from the drawer and lost its width and its square corners
   when the drawer went. It has its own `.dask` rule and no inline style soup.
5. Fourteen marques do not fit a dropdown, so the list scrolls — and a list
   that stops mid-row reads as a clipping fault. The last 26px fade, and the
   fade goes once there is nothing left to reach.
6. Five strings and eight `aria-label`s were missing from the dictionary, plus
   two rules for the composed range values ("от 500 к.с." → "from 500 hp").
   The EN walk now reports clean with the layer open, a panel open and three
   filters set, at desktop and phone.
