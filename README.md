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
data/eq/<id>.js   one car's equipment list, verbatim from its listing.
                  vehicle.js loads exactly one; see data/eq/README.

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
gave way to four cards of what the showroom actually does. (The four have
since been re-cut — see v53 — but the mechanism below is unchanged.) Two of
them carry the page ids the rest
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

### v52 — the performance pass

The brief was "make it feel instant". Everything below was measured before
and after on three simulated devices — desktop, a mid phone (4× CPU, 12 Mbps)
and a slow one (6× CPU, 1.6 Mbps, 300 ms RTT) — because on this site almost
every intuition about what was slow turned out to be wrong.

**First paint, before → after:**

| | desktop | mid phone | slow phone |
|---|---|---|---|
| Landing | 568 → **292 ms** | 904 → **632 ms** | 4100 → **1212 ms** |
| Concierge | 172 → **100 ms** | 796 → **520 ms** | 3816 → **1168 ms** |
| Vehicle | 156 → **88 ms** | 704 → **368 ms** | 3612 → **992 ms** |

CSS on the wire went 273 KB → **25 KB**. Vehicle CLS on a slow phone went
0.1005 → **0.0033**; the `?v=<car>` concierge deep link 0.289 → **0.047**.

#### What was actually slow

**Nothing in the JavaScript.** Sampling the main thread at 4× throttle put
every script under 120 ms of self time. The load was 36% style recalculation
and 31% layout — the cost of matching 1277 rules against a 750-node DOM
while four scripts mutate it — and 1% image decode. Every intuition about
"heavy JS" was wrong here.

**First paint was gated by one thing: 271 KB of render-blocking CSS.** On the
slow phone `style.css` alone took 3.3 s, and it was sharing the pipe with two
stylesheets, five scripts and two images — 160 KB arriving before the first
pixel, of which 83 KB drew anything. Four changes, in order of what they were
worth:

1. **Compression (2.2 s).** `py -m http.server` sends everything
   uncompressed; no real host does. Brotli alone took first paint 4008 →
   1796 ms. This is a hosting setting, not code — see `DEPLOY.md`, and treat
   it as the first thing to check if the site ever feels slow again.
2. **Only style.css blocks now (312 ms).** `catalog.css` loads non-blocking
   on the landing page and the scripts start when the stylesheet lands,
   inserted in order with `script.async = false` (the exact equivalent of
   `defer`). The stylesheet gets the whole pipe.
3. **`build.js` (200 ms).** Comments are 44% of `style.css` and they are the
   most valuable thing in the repo, so they stay — and a stripped copy is
   generated for the browser. 49 KB → 18 KB over brotli. Verified by
   comparing every computed property of every element at four page/width
   combinations: indistinguishable.
4. **Exo 2 self-hosted.** The Google stylesheet was a render-blocking request
   to a third-party origin — a DNS lookup, a TCP connect and a TLS handshake
   before any of our own CSS was read, then a *second* origin for the files.
   405 ms, gone. Six subset files instead of fifteen: this site is Bulgarian
   and English.

#### The layout shifts were the font swapping

`font-display:swap` paints in Arial and replaces it with Exo 2 a moment
later, and Exo 2 is 3.6% narrower than Arial Bold — enough that a tracked
label which wrapped in one fitted on one line in the other, and a whole 42 px
line appeared and vanished under the reader. The fallback now carries Exo 2's
own metrics (`size-adjust`, `ascent-override`), calibrated against 17,500
characters of the real site text rather than a sample phrase — the ratio is
text-dependent, and one well-chosen sentence gave answers 2% out. Residual
error: 0.00% / −0.01% / +0.12% at the three weights.

Two more, both found by bisecting rather than reading: `catalog.css` holds the
entire vehicle dossier, so making it non-blocking there reflowed the title
(fixed — it blocks on that page only); and `defer` does not hold first paint,
so the concierge painted and then grew by the chosen-car card. The URL knows
what is coming, so that space is now booked before anything is drawn.

#### What did NOT need fixing, and the measurements that said so

- **The scroll.** Ablating the blurred hero backdrop, every
  `backdrop-filter`, the `view()` parallax and the whole card wall changed
  p50 frame time by under 1 ms each. Against bentleymotors.com on the same
  gesture, same throttle: **3 janky frames to their 10, half the style cost,
  a tenth of the script time, 40% less main-thread work.** It was already
  better than the reference. The one place they win is layout (14 passes to
  our 75) and it is worth 38 ms spread over a ten-second gesture.
- **Image decode.** 1% of load. The 1.3 MB the landing page pulls on a phone
  is bandwidth, not main-thread time, and none of it is oversized for the box
  it lands in.
- **JS minification.** A stripper was written, measured and thrown away: it
  corrupted `main.js` by mistaking the tail of a regular expression for a
  comment. The scripts are off the critical path and brotli takes `main.js`
  to 20 KB on its own. `build.js` does CSS only, deliberately.

#### The one thing that got worse

Total Blocking Time on the landing page rose (499 → 539 ms on the slow
phone). It is a window-relative measure: the same work now happens in a
tighter band because first paint moved 2.9 s earlier, so more of it lands
inside the measured window. Absolute time-to-interactive improved. The
biggest single task — filtering 87 records and building the six preview cards
— now waits for the first idle moment, since every pixel of it is below the
hero.


### v53 — the landing page, the hero and the phone

A production-polishing pass over the first screen, the service carousel and
the consultation room. Everything below was measured against
bentleymotors.com before it was written, and the measurements are quoted
where they decided something.

#### The word

`Concierge` was the one piece of copy on a Bulgarian site that never spoke
Bulgarian. The dictionary in `i18n.js` keys on the Bulgarian, so what is in
the markup **is** the Bulgarian — writing "Concierge" there meant the page
named after a person sitting down with you was permanently in English. The
pages now say **Консиерж** and the table carries it back the other way, on
all four pages, in the nav, the menu, the `<title>`, the host's plate, the
aria-labels and the legal text.

#### The hero

- **The copy is gone.** All three frames carried a paragraph under the
  headline; so did the collection heading below them. The reference carries
  almost none over its own hero for the obvious reason — a 1344×702
  photograph of the building is the argument and a sentence laid over it is
  a second one competing with the first. What is left is a name, a way in
  and a way to ask.
- **"Целият каталог" opens the catalogue.** It was `href="#avtomobili"`,
  i.e. a jump to the heading the reader was already looking at. It carries
  `[data-catalog]` now, like every other doorway into the layer, and keeps
  the real `href` for middle-clicks and no-JS. The two hero CTAs that say
  "collection" got the same treatment.
- **The transition was too quick, and the duration was not the reason.**
  The reference crossfades over 1 s on a plain `ease-out`; this ran 1 s on
  `--e-mass`, which is front-loaded — 85 % of the movement inside the first
  third of the time. So a nominally equal duration did most of its visible
  work in ~300 ms and read as a cut with a soft edge. `--slide-dur` is now
  **1.6 s**, which puts that same 85 % at ~480 ms, where the reference's
  1 s `ease-out` has its own 80 %. The curve is unchanged: it is what makes
  the frame land rather than drift, which is the failure mode a plain
  `ease-out` has on a photograph this size. The 10 s dwell is untouched —
  it is the reference's own `autoslide-duration`, measured.

#### The hero, on a phone

- **It takes the finger now.** The model is the reference's own
  (`handlePaginationChange`): a fractional `position`, and per slide
  `o = clamp(-1, position - n, 1)`, `opacity = 1 - |o|`,
  `scale = 1 - 0.2·o`. One formula for the drag and for the settle, which
  is what made it possible at all — three CSS classes cannot describe a
  drag, because a drag has a DIRECTION. Dragged backwards, the frame you
  are leaving has to grow to 1.2 and the one you are returning to has to
  come up from 0.8, which is the exact opposite of what `.is-past` says.
  Verified with synthetic touches: at half a frame both frames sit at 0.5
  opacity and 0.9/1.1 scale; at 34 % of the viewport width the swap is
  exactly complete, forwards and backwards.
- **One axis, locked once.** The reference re-decides the axis on every
  `touchmove`, which lets a lazy diagonal flip mid-gesture between scrolling
  the page and turning the carousel. This picks after 8 px and holds it. A
  vertical drag leaves the carousel untouched — measured, byte-identical
  state before and after.
- **The counter was clipping its own total.** `margin-inline-end:-10px`
  against the row's `gap:8px` is a net 2 px overlap, and the scrubber's
  scrim painted over the right-hand 2 px of the "3" (counter right edge
  62.9, scrubber left edge 60.9 at 375). The margin is `-8px` now — it
  cancels the gap exactly, so the two grounds meet with no seam and no
  overlap — and the counter carries 14 px of trailing padding. Measured
  after: overlap 0, glyph 14 px clear.
- **And it was set like a slideshow counter.** "1 / 3", one size, one
  weight, on a flat grey rectangle. It is a hierarchy now: the frame you
  are on in the display face at 18/300, the total as an 11 px tracked label
  at 55 %, and between them a hairline leaning on **the house angle** —
  the same 24.7° as the brand plate and the language wipe, `skewX(atan(.46))`,
  the smallest place on the site it appears. The grounds are glass rather
  than tint, with the flat fill kept for the low-power path.
- **The mark had lost its presence.** 104 px wide beside two 13 px/1.3 px
  tracked labels — the same weight the 1440 bar uses — with 18 px of
  clearance on one side and none on the other. The labels drop to the
  mobile label scale the reference uses on a phone (11/20 on 1.1 px) and
  the mark takes the room that releases: **124 px, with 24 and 45 px of
  clearance**. One wide soft shadow, because it sits on a photograph whose
  luminance changes every ten seconds.

#### The service carousel

- **Four new cards**: AutoSpa, Сервиз, Лизинг и застраховане, Кафе бар —
  rooms in the building rather than propositions. `#care` and `#lizing`
  keep their anchors, so every header and footer link still lands on an
  open card. "Внос по поръчка" and "Изкупуване и бартер" are still offered
  and still reachable (the hero and the concierge's intent step ask for
  exactly those two things); neither is a place you can walk into, which is
  what this band is now for.
- **The leasing card is explicitly provisional.** The owner has not
  supplied final terms, so every unconfirmed figure carries `[data-tbd]`
  and one rule gives it its dotted-underline treatment — replacing the text
  and deleting the attribute is the whole of "make it real". The
  calculator's three constants moved out of `main.js` and onto the `.lz`
  element as `data-rate` / `data-deposit` / `data-term`, so the numbers live
  beside the figures they belong to and there is no script to edit.
- **The expand keeps the reference's structure and loses its clock.**
  `.3s linear` is right for the reference — its card is 304 wide and its
  panel is white on a white page, so the growth is paper unfolding over
  paper. Ours opens 318 → 888 over a dark rail and at 300 ms linear that is
  570 px starting and stopping dead, twice. The structure is verbatim (one
  duration and one curve for the grid tracks, the ratio, the rail's leading
  room and the scroll; the panel and headline landing inside it on the
  reference's own offsets) and the numbers are this site's:
  `--wall-dur:.52s` on `--e-move`, panel at 260 ms, everything over by
  700 ms. The measured geometry is unchanged — 318×459 → 432×587 at 1440,
  item 318 → 888, tracks 432/432.
- **The entry moves three things instead of one.** The sheet rises 72 px
  over `--t-epic` staggered 90 ms left to right; the photograph settles
  1.06 → 1 over `--t-mass`, 120 ms behind its own card; the copy follows at
  220 ms. ~1.4 s for the first card and ~1.9 s for the last, against the
  1.0 s near-unison it replaces and the reference's own 4.1 s.
- **The photographic treatment.** No filter is set on any image on the
  reference — its photography arrives graded. Ours arrives as it came off a
  phone at the showroom: four sources, four white balances, four exposures,
  side by side in one rail. So the grade is applied here — contrast +7 %,
  saturation +4 %, exposure −4 % — under a cool/warm wash raked at 114.7°
  (the perpendicular of the house angle, the same rake the concierge room
  is lit on, carrying the brand gold at 9 %) and an edge vignette biased to
  the middle so it never fights the scrim, whose foot already runs to 75 %
  black. The eased double gradient itself is the reference's, verbatim.

#### The scrubber under the rail, which was lying

Two separate faults, and the visible one was not the interesting one.

- **It had a transition.** `transform .42s, width .42s` on the mark. A
  scroll indicator with a clock of its own cannot report a position: every
  scroll event restarted a 420 ms tween from wherever the last one had got
  to, so under a finger the mark ran permanently ~400 ms behind and, on a
  fast swipe, a whole card. It has none now. `main.js` writes it on the
  scroll event **and** on every animation frame for as long as the rail
  keeps moving — both, because the loop alone is worse anywhere
  `requestAnimationFrame` does not run and the event alone is what was
  wrong to begin with.
- **It was measuring the wrong thing.** With four 76vw cards at 375 the
  pitch is 293 and the rail has 822 of travel, so the last card cannot
  reach its own snap point — it stops 57 px short. A straight
  `scrollLeft / max` therefore put the mark at 0, 78.2, 156.3, 219.2 of a
  219.2 px travel: **three swipes, the last of which moved the mark 20 %
  less than the other two.** Below the snap it now walks the cards' real
  rest positions — and those are not `k × pitch` either, because a snap
  position is the item's snap area (border box + `scroll-margin`) brought
  to the scrollport's start edge (inset by `scroll-padding`), which lands
  12 px short of every multiple. Measured rests: 0, 281, 574, 821. After:
  **73.0, 73.2, 72.9 px per step, and the last card flush at the end of the
  track.** Mid-swipe it interpolates (109.7 against a predicted 109.6).

#### The consultation room, lit

The concierge page was #050505 ground, a photograph at 66 % under gradients
reaching 97 % black at the rail, and every piece of type a percentage of
white. Consistent, and read end to end also unrelieved — the only light in
the building came from a photograph turned down until it was texture.

It is paper now, and paper is not the same thing as white. Four surfaces:
`--r-paper` (#f4f2ee, warm, deliberately not #fff, which is what lets the
sheets on it read as sheets), `--r-paper-2` where it settles, `--r-sheet`
for things genuinely lifted off it, and the photograph — which stays, and
is now the light **source** rather than the wallpaper.

- **The rake inverts, the geometry does not.** The dark room raked shadow
  at 114.7° and sat the conversation in the least-lit part; this rakes
  light, brightest at the top-left where the host rail stands. Same angle,
  same three stops, opposite sign, plus a very low radial of brand gold
  above the rail — 4 % at its strongest, and the difference between "white
  page" and "a room with the sun on one side".
- **Grain.** One 140×140 tile of monochrome noise at 3.5 %. On a dark page
  you never need it; on paper a 96 %-to-52 % white ramp across 1400 px is
  exactly where an 8-bit channel shows its steps, and a large field of flat
  #f4f2ee reads as unprinted rather than as paper. 2 KB, composited once,
  dropped on the low-power path.
- **The gold is not `--primary`.** #c9a25a is mixed for near-black and
  lands at 2.1:1 on paper. The room uses #8a6a24 — the same hue at the
  value the catalogue already uses on its pale bands — which clears 4.5:1.
- **The wedge stays black,** and does more work than it did: it is the only
  near-black object above the fold, which makes it the anchor the light
  room hangs off. It is the reason this reads as AutoHaus on paper rather
  than as a white form.
- **Verified, not eyeballed:** every text node in the room, the desk, the
  header, the plate and the menu panel, measured against its own painted
  background — **zero below WCAG AA**.

#### Three defects found by measuring rather than by looking

1. **A stray `*` `/` in the stylesheet.** An edit left the tail of a
   comment outside the comment. The CSS parser discards that and the rules
   after it, silently — the page still loads and a handful of declarations
   have simply stopped applying. Found by reading computed styles in a
   browser and noticing `.desk .btn--secondary` had a white border it had
   been told not to have. `build.js` now refuses to write when a comment
   marker survives stripping, which can only happen if the source had an
   unbalanced one; the guard is self-tested against a deliberately broken
   copy.
2. **`.js .fade-img` beat the card entry.** Every card photograph also
   carries `.fade-img` (the image dissolve), whose rule is two classes —
   0-2-0 — against a plain `.wcard-photo img` at 0-1-1. Its `transition`
   shorthand names only `opacity`, and a shorthand does not merge, so
   `transform` was dropped from the transition list and the photograph
   snapped out of 1.06 in one frame. Nothing errored; the rule was plainly
   there. `.wcard-photo img.fade-img` is 0-2-1 and takes it back.
3. **`.cgr .body-s{color:inherit}` collapsed the room to one ink.**
   `.cg-help`, `.opt-d` and `.cgs__lede` all carry `body-s` as a second
   class, so a 0-2-0 selector beat every one of their own 0-1-0 colours.
   `.body-s` sets no colour — there was nothing to correct.

A fourth, in the same family, is worth recording because it is the joke
version of the first: the build guard's own comment originally contained a
literal comment terminator, and closed itself.


### v54 — contact, footer and the legal section

#### Контакт stopped being a page

It was a link to the bottom of the landing page. From any other page that is
a navigation — leave what you are doing, load index.html, land in its
footer — to read a phone number. It is a **panel** now, and deliberately the
menu's sibling rather than a new idea: same scrim with the same real blur,
same rake-that-settles reveal, same material, same scroll pin, same close.
Somebody who has opened the menu once already knows how this behaves.

What differs is which corner it belongs to, and that is the house angle
doing its job. The menu is the plate with a body — anchored **left**, cut on
its **right**. This is anchored **right**, cut on its **left**. One rule,
mirrored; and because the cut faces inward on both, the page between them is
never the thing being cut into. Measured: 46 % of a 1440 screen and 94 % of
a 375 one, with the page visibly still there beside it.

The contents are the six departments published on autohaus.bg/контакти —
Офис, Продажби, Застраховане, Сервиз, AutoSpa, Кафе бар — each with its own
lines and its own hours, plus the address, the company numbers and a map.
The labels are the same words the service carousel uses, so somebody who has
just read a card knows which line to call.

**The map is not loaded until the panel is opened**, and that is not an
optimisation — it is the only reason there can be a map here at all. An
embedded Google map is a third-party frame with third-party cookies, on a
site whose cookie policy says, truthfully, that it sets none. In the markup
it carries `data-src`; `main.js` promotes it once, on first open. So the
frame exists only for a visitor who has asked for it, the landing page's
byte count is unchanged, and the policy stays true for everyone who does
not. The Cookie Policy now documents the exception in its own section, and
the Privacy Policy's "data outside the EU" section stopped being a
placeholder and became a fact.

`[data-contact]` opens it, exactly as `[data-catalog]` opens the collection,
and every trigger keeps a real `href="#kontakt"` so a middle-click, a
crawler and a JS-off render all still work — landing in the footer, which
still prints the address and the office line for that reason.

#### One description of "a panel over the page"

The menu's open/close was ~80 lines of scroll pin, inert, focus trap, focus
return and Escape. Written out a second time for the contact panel it would
have drifted the first time either was touched, and the half that drifts is
always the accessibility half — the parts nobody notices are broken. It is
one `makePanel()` now, and it also does the thing neither could do alone:
**closes its sibling**, so two scrim blurs and two scroll pins can never
stack and the second close can never restore a scroll position captured by
the first.

#### The footer, subtracted

It carried five blocks. Gone: two loose link pairs flanking the wordmark
(Новини was a `mailto` with a subject line and no newsletter behind it;
Калкулатор and Намерете ни were third and second copies of links already in
the columns; Запази оглед was a fourth way into the concierge on a page that
had three), and the two inventory columns — "Автомобили", which listed one
car by name and so dated the moment it sold, and "Вашият AutoHaus", which
listed five services the carousel three screens above already opens in full.
A footer that repeats the page is not a footer.

What is left is what a footer is for: **Контакт**, **Последвайте ни** and
**Правни**. The Follow-us column is a link list like the two beside it —
Facebook and Instagram as words with their marks, not a row of bare glyphs,
because a column of icons among columns of words reads as a different kind
of object and the footer's job is to be one object.

The financing footnote went with them. "Обявените цени са крайни. Лизинг от
6.9 % …" is a sales term, not a site-wide legal notice; it now lives in the
Terms, where somebody looking for it will actually look.

#### The legal section, rewritten

Four documents, and not the same four.

- **"Вашите права по GDPR" was never a document.** Rights are not a separate
  policy — they arise from the privacy policy and are exercised against the
  same controller. They are section 6 of the Privacy Policy now, where the
  reader has just found out what is being processed.
- **In its place, the document that was actually missing: Фирмени данни.**
  Every marque site carries one. It also stops the same eight facts from
  being retyped in a footer, a privacy policy and a set of terms and
  drifting apart.
- **The Terms gained the disclaimer they needed.** Availability, prices,
  specifications and photographs may change without notice; what is
  published is true at the moment of publishing and is not an offer; confirm
  with us before purchase, and only a written confirmation binds. Financing
  now says plainly that **approval depends entirely on the leasing
  institution, not on AutoHaus** — it sets the rate, the payment, the term
  and the answer.
- **The register changed.** Closer to how Bentley, Porsche and Ferrari write
  a policy than to a contract: short sentences, second person, headings that
  say what the section is about ("Този сайт не Ви проследява", "Едно
  изключение: картата"), and the article numbers tucked at the end of
  sentences rather than opening them.

**Placeholders.** The old text marked unknowns by typing `[• …]` into the
copy, which reads as a broken document rather than as a pending decision,
cannot be found by a selector, and has to be deleted by hand somewhere a
stray bracket changes a sentence. Every real company fact is now filled in —
name, legal form, ЕИК, VAT number, registered address, all six departments'
numbers and addresses — and the ten that genuinely need a decision carry
`[data-tbd]`, the same marker the leasing card already uses, so one grep
finds every one of them before publication. They are eight decisions: the
DPO, the retention period for unconverted enquiries, the named processors,
the leasing terms, the reservation period, the manager's name, registration
as an insurance intermediary, and — only if they are ever added — the cookie
table.

#### Two defects, both found by measuring

1. **The panel was 24px tall.** It was called `.ctc` only after it was
   called `.cnt`, which is the hero's frame counter —
   `display:inline-flex; height:1lh; overflow:clip`. A full-screen
   `position:fixed` layer that also matches that rule is 24px tall and
   clipped, and nothing errors: the panel opened, the scrim appeared, and
   everything inside it was invisible. Two three-letter class names in one
   stylesheet is a real cost.
2. **The footer wordmark became a 1344px click target.** With the two link
   pairs beside it gone, the anchor was the only child of a full-width row
   and a stretched flex box made the whole band a silent "back to top".
   `width:max-content` with an auto margin; the target is the wordmark
   again, at 80 × 45.

#### Still Bulgarian

The four legal documents remain Bulgarian-only in the body, which is what
they have always been — the dictionary never carried their headings either.
The panel, the footer and every label around them do translate. Putting the
policies into English is a copywriting job with a lawyer attached to both
versions, not a dictionary entry, and it is not pretended here.


### v55 — the dossier, told only what AutoHaus says

#### What was on the page that nobody had said

The vehicle page was generating editorial. Removed, all of it:

- **A four-step standard, asserted for all 87 cars.** "Преминал е през същия
  път като всеки автомобил в колекцията: проверка на произход и сервизна
  история, механична подготовка в собствен сервиз, пълен Auto Spa детайлинг
  и лично одобрение от … , преди да бъде показан."
- **A promise about paperwork** — provenance report, service books and
  invoices available at the viewing.
- **"Гаранции и оглед", four commitments**: viewings every weekday 09:00 to
  18:00 without an appointment, a test drive by arrangement, a 48-hour hold
  after a deposit, a firm part-exchange offer the same day.
- **"Защо този"**, up to four editorial verdicts per car, generated from the
  record: "Мощност, която оправдава подготовката", "Възраст, в която
  състоянието е единственото, което тежи", "Рядкост в този клас". A dealer
  may write that about a car. A template may not write it about eighty-seven.
- **"Пълна сервизна история" as a filler** whenever fewer than three of those
  verdicts fired. It is true of 60 of the 83 published listings, and it is
  printed now for exactly those 60 — because it is one of their own notes.
- **A monthly leasing figure per car**, on the price rail and again in the
  prose, computed from a rate nobody has confirmed. The listings say
  "Възможен лизинг!" and nothing more.
- **An answer "до 24 часа в работни дни"**, and an expert who "одобри лично
  този автомобил". Both also removed from the concierge, where the same two
  claims appeared in the meta description, the rail and two confirmations.
- **"реф. AH-018"** on the identity line. That reference is this site's, made
  when the inventory was scraped; no AutoHaus listing prints it. It still
  travels with an enquiry — labelled as the enquiry's reference, which is
  what it is.
- **"Всеки автомобил минава оттук, преди да бъде показан"** on the AutoSpa
  card and its twin on the Сервиз card. autohaus.bg's five service pages
  (Застраховки, Лизинг, Сервиз, Автомивка, Кафе бар) each hold a heading and
  nothing else — there is no published account of how any department works,
  so a department may be named and its real phone, address and hours given,
  and what it does to a car before that car is shown may not be asserted.

#### The price

AutoHaus publishes a euro figure and, on **25 of the 83** listings, the line
**"Цена без начислен 20% ДДС!"** — the price does not include 20% VAT. The
page printed "Крайна цена" and "Обявената цена е крайна" on every car, which
is wrong twice: wrong for those 25 because the tax is still to come, and
wrong for the other 58 because it asserts something their listing never said.

The note is carried per car now, in the listing's own words, sitting directly
under the figure in both places the figure appears. No car gets a claim about
its price that its own listing does not make.

#### The duplication

Year, mileage, power, engine, transmission and colour appeared **three times
each**: a scrolling strip of six values, a ten-row "Детайли" table
immediately under it, and the opening sentence of the prose restating all six
a third time. Two of those existed because the reference site has both a
strip and a table; ours had nothing else to put in either.

There is one specification block now, holding exactly the eight rows the
listing holds — марка и модел, регистрация, тип двигател, мощност,
трансмисия, пробег, цвят, цена. It is set as a ledger rather than a grid:
hairline-separated rows, label left in the micro-label voice, value right in
tabular figures. A reader is looking at one car, not comparing ten.

#### What the page never had

**The equipment list.** Every AutoHaus listing carries one — 17 lines at the
shortest, 155 at the longest, a median of 45 — and none of it was on this
site. All 87 listings were re-fetched, 83 of them still published, and their
equipment is now data/eq/&lt;id&gt;.js, verbatim, in the listing's own order.

Most lines carry the manufacturer's option code — "501", "PIP7", "LCF" — and
setting that code in its own quiet monospaced column is what turns a wall of
155 sentences into something scannable: the eye runs down the codes and stops
at the words. Sub-points (a line opening with "-" on the listing) are indented
under their option rather than promoted, because the source nests them and the
nesting means something: they are what the package contains.

**83 files, not one table.** Together they are 357KB of text and a reader
wants one car's 4KB. vehicle.js injects the one it needs after the render,
into a section below the fold at every width, so the weight is paid by the
person looking at that car. A car whose file is missing renders without the
section; four have been sold since the inventory was scraped and their
listings now 404.

The **Read More / Show Less** is the interaction that stayed — it just has
something worth opening now. It used to clamp a paragraph of generated prose.

#### Verification, and four corrections it produced

All 87 listings were re-fetched and compared field by field. **Every make,
model, registration month and year, engine, power, transmission, mileage and
colour on the 83 still-published cars agreed** with data/vehicles.js. Four
differences, all the same kind: cars held here as "по запитване" that now
carry a public price — m550d-xdrive €30 000, caddy-maxi €22 000,
rr-sport-p525-autobio €56 000, escalade-600-premium €130 000. Corrected.

#### Two other things

**"Услуги" is gone.** One photograph, the word Услуги, one sentence listing
five things and a button reading "Разгледай" — a signpost to a band three
screens above it. The four service cards *are* the services and they open in
full; every "Услуги" link now lands on that band instead of on a teaser for
it.

**"За AutoHaus" is an account now, not an invitation.** It was two sentences
and two buttons, "Разгледай" and "Запази оглед" — a section about the company
that said almost nothing about the company and then asked for something
twice. It names everything AutoHaus does, once, in the order somebody meets
it: the cars in stock, the ones sourced and imported to order, finance and
insurance (with the approval left where it belongs — with the institution),
the workshop, AutoSpa, part-exchange, the cafe bar. Nothing in it asks the
reader to act; the two links go to the collection and to the departments,
which is where somebody who wants to do something is already heading.

#### One thing found on the live site, which is not ours to fix

**autohaus.bg has been injected with SEO spam.** The homepage and the five
service pages carry several hundred words of French casino text — "Pour les
joueurs expérimentés, choisir le bon casino en ligne…" — with outbound links
to gambling sites, sitting in the page body where the service copy should be.
It is invisible to a casual reader because those pages have no visible copy
of their own, and it is the reason those five pages parse as empty here. It
looks like a compromised WordPress install. None of it was used as source
material. It wants a look from whoever maintains that site.


### v56 — the mark, the frame budget, and a lighter foot

#### The mobile header, measured rather than adjusted

Two passes were spent making the wordmark bigger and it kept reading as the
third item in a row of three. Measuring the reference finally explained why,
and the answer was never a size — it is a **ratio**.

Bentley's mobile bar at 375, measured: the nav is a three-column grid,
`127.6px 88px 127.6px`, mark in the middle cell at 88 × 44. **The left cell
is empty.** There is one label in the whole bar — "Menu", 11/20 on 1.1px,
37.6 × 20 — and the mark's painted area is 3872px² against that label's
752px². The mark is **five times** the largest piece of type in the bar and
more than twice the height of anything else on the line.

Ours, measured the same way: mark 124 × 23 = 2850px², and beside it
"АВТОМОБИЛИ" in a 44px hit box, 85.7 × 44 = 3771px². **A ratio of 0.76** —
the wordmark was the smallest painted thing in its own header. No amount of
growing it fixes that while a second label stands next to it.

- **"Автомобили" left the bar.** The reference has nothing on that side, and
  the link is already the first row of the menu.
- **The mark went to 148px**, i.e. 27.4 tall on our 356:66 wordmark —
  4055px² against the menu label's 772px², a ratio of **5.25** against the
  reference's 5.1. It is 39% of the viewport where theirs is 23.5%, and that
  is right rather than greedy: a wordmark carries presence in WIDTH where a
  winged badge carries it in height. Same mass, different axis.
- **The mark moved to the top line.** The reference puts the logo on row one
  and its actions on row two; ours had it the other way round, so the first
  thing on the page was a button.
- The rule-icon came to 13px with it (theirs is 12).

#### Performance

**The parallax fallback was the Windows 7 path, and it was the expensive
one.** `animation-timeline: view()` is Chrome 115; Windows 7 tops out at
Chrome 109. So on exactly the machines with the least to spare, the CSS does
nothing and the JS fallback runs — and it was calling
`getBoundingClientRect()` on every parallax element and writing a transform
straight after each read. Read, write, read, write: the textbook way to force
layout once per element per frame, sixty times a second.

A rect only answers "where is this relative to the viewport", which is
`documentTop − scrollY`, and documentTop does not change while scrolling. It
is measured once now, re-measured only on a resize, a late image or a font
swap, and **the frame does no layout read at all** — verified by inspecting
the emitted function body. An observer keeps the working set to what is on
screen, and `will-change` is granted on the way in and taken back on the way
out rather than standing on five elements for the session.

**Three fixed surfaces were blurring the page on every scrolled frame.** A
`backdrop-filter` on a `position:fixed` element is the worst kind of
expensive: the compositor re-samples and re-blurs whatever is behind it every
frame, forever, whether or not anything changed. `.plate__in` is exactly that
— fixed, full width, on screen for the whole of every page below the hero —
and it had no low-power fallback at all. Nor did the two panel scrims, nor
`.dbar`/`.dmini`, the two bars a phone keeps fixed on the vehicle page.
`catalog.css` had no low-power path whatsoever; it has one now. The plate's
own radius came 16 → 12px: behind a fill that runs 86–94% opaque the last
four pixels do no visible work, and blur cost climbs with radius.

**A filter across the whole document.** Opening the collection transitions
`filter: brightness(.45) saturate(.8)` on `.shw-behind` — every band, every
photograph, the footer — for 950ms. A filter cannot be composited from a
cached texture the way a transform or an opacity can: the entire page is
re-rasterised, then again for every frame. Where the device has said it is
short of cores or memory the dim is done with opacity instead, which IS
composited from the cached texture: one raster instead of sixty, same scale,
same timing, same curve.

**Two per-frame rect reads became observers.** The dossier's phone bars were
doing three expensive things per scrolled tick — a rect for the gallery, a
rect for the footer, and a `getComputedStyle()` on `<body>` to re-read a
padding that only changes at a breakpoint. All three answered questions an
IntersectionObserver answers off the main thread; the scroll handler is gone
with them. The homepage's sticky CTA lost its footer rect the same way.

**The card expand keeps its geometry and loses time on slow machines.** It
animates grid tracks, flex-basis and the card ratio deliberately — growing
the box keeps the photograph and the type pin-sharp where a `scale()` would
soften both — and that trade stays. What it costs is a layout pass per frame,
so on low-power the honest lever is the window, not the mechanism:
`--wall-dur` drops to the source's own .32s, 200ms less layout per open.
`main.js` now READS that token instead of repeating the number, because a
second copy would silently disagree with the override and leave the rail
travelling 200ms after the card stopped growing.

**One dead component removed.** The drifting photo wall (`.pcol-*`) — two
rails on 72s and 96s infinite animations, with a permanent `will-change` on
both tracks. Nothing has referenced it in any HTML or JS for some time. A
retained compositor layer and an infinite recomposite, for markup that is
never built.

**Images needed nothing.** 16 of 18 lazy, `decoding="async"` throughout,
`fetchpriority="high"` on the hero pair only, and not one image oversized for
its box at DPR 2 — the blurred backdrop deliberately loads the 320px
rendition because it is blurred 16px and resolution cannot show.

#### The footer

Contact is gone — it is a panel now, reachable from every header and every
menu, and printing the address again at the bottom of every page was the last
thing keeping the footer at the size of a page. **The column grid went with
it**: two columns holding four and two links is a layout that exists to hold
columns. What is left is a mark, two social marks and four documents, and
that is a line rather than a grid. 336px on a phone, 276 on a desktop.

The no-JS fallback for `[data-contact]` moved from `#kontakt` — which now
lands on nothing in particular — to `legal.html#imprint`, which is the page
that actually holds the address, the phone and the email.

#### A sweep that was reverted, and why it is worth recording

22KB of the stylesheet matches nothing in any page or script — mostly the
legacy dossier components (`.vd-hero`, `.vd-aside`, `.vd-specs`, `.vd-lede`,
`.vd-table`, `.vg-thumbs`) left behind when the dossier was rebuilt. An
automated pass removed 163 rules of it, and the computed-style comparison ran
afterwards caught what happened next: `.hd-links{display:none}` went with
them. That class IS in index.html — the tokeniser in the stripper was wrong,
not the rule — and the result was a header 278px tall with a 0-width menu
icon.

It was reverted whole. The measurable prize was ~10% of the rule count; the
risk was a class of silent breakage across 121 removed selectors that one
verification pass had already found one instance of. Only `.pcol` was
removed, by hand, because it was checked by hand. **The remaining ~19KB is
still there and still dead** — worth doing, worth doing carefully, and not
worth doing at the end of a session on a stylesheet whose comments are the
most valuable thing in the repository.

#### The bug the quality pass found

The console carried a TypeError from `i18n.js` — *Failed to execute 'observe'
on 'MutationObserver': parameter 1 is not of type 'Node'*. It had been there
for a while, it was intermittent, and it is the most consequential thing in
this pass.

Three pages start their scripts through a loader in `<head>` that waits for
the render-blocking stylesheet and then injects them with
`script.async = false`. A comment there described that as "the exact
equivalent of defer". **It is not.** `async = false` guarantees ORDER between
dynamically inserted scripts and nothing more: each one runs the moment it
has been fetched. On a warm cache `css.sheet` is already truthy on the
loader's very first line, so `boot()` ran synchronously — inside `<head>`,
with no `<body>` in existence yet.

Downstream of that: i18n's MutationObserver threw outright, so nothing
rendered by a script afterwards was ever translated; and `main.js`'s
`querySelectorAll` calls matched an empty document, so the hero, the rail and
the reveals bound to nothing at all. On a **cold** cache the stylesheet's load
event happens to fire after `</body>` and none of it shows — which is exactly
why it survived this long. The failure only appears on a second visit, and a
hard reload hides it again.

`readyState` is the gate that was missing. The ordering, the 3s floor and
staying off `window.load` are all unchanged. Verified by loading the same URL
three times in a row against a warm cache: zero errors, hero bound, i18n
alive on every one.

#### The quality pass

Every page at 375 and at 1440: no horizontal overflow anywhere
(`scrollWidth === innerWidth` on all four, both widths), no collapsed icons
outside `display:none` ancestors, header 129px on mobile and 127 on desktop,
no console errors. Every low-power override verified to fire by forcing the
class and re-reading the computed values: `--wall-dur` .52 → .32s, the plate
blur to none, both scrims to none, the page recede from
`transform, filter, opacity` to `transform, opacity`.

---

### v57 — the phone's hero, and an instrument that condenses

#### The header was one row short

v56 got the ratio right — the mark at 5.25× the largest label, against the
reference's 5.1 — and the mark still did not read as the focal point. The
ratio was being measured against the wrong thing. Directly under the mark sat
a 259px Concierge button and an 84px language switch: **a second row whose
combined painted area was larger than the mark itself**, touching it, and
arriving first on the way down the screen.

The reference's mobile bar is three columns with the mark in the middle and
nothing else in the row but a Menu trigger. That is the composition, and it is
the composition because a brand mark cannot be the focus of a screen it is
sharing.

So the second row is gone. The language switch — the one control with nowhere
else to live — moved up to flank the mark on the left, the menu flanks it on
the right, and the mark sits between them with nothing above or below.
Measured at 390: nav 69px tall, switch 54px at x16, mark **148px centred at
195 in a 390 viewport** (dead centre), menu label 62px ending at 374. All
three sit on one optical axis — mid-heights 32.5 / 32.5 / 33. Symmetric 16px
insets both sides.

**The Concierge button left the bar entirely.** It is not lost: it is the
second row of the menu the trigger opens, and on the landing page it is the
hero's own action. What it was doing in the header was competing with the mark
for the top of the screen and winning.

#### The controls read as a website component because they were one

Three grey chips — a plate for the number, a plate for the scrubber, a plate
for each arrow — floating over a photograph at slightly different lengths,
none aligned to anything else on screen. Chips are how you give type a ground
when the image underneath has none. Ours already has one: `.grad--t` lays a
black-to-transparent ramp over the top quarter of every frame, and three
rectangles were doing that job worse on top of it.

The plates go. What is left aligns to the one edge that matters — the
picture's. Measured: frame `x:16 → r:374`, progress row `x:16 → r:374`.
**The progress line is exactly the width of the photograph**, 358px, not a bar
of arbitrary length sitting near it.

**And the scrubber became segments.** A continuous track with a sliding thumb
is a slider — machinery you are invited to operate. Three hairlines read as
three chapters. The reference uses a track because it has eight frames and
segments would be confetti; at three, segments are both more legible and more
still. The active one fills over the ten seconds the frame is held, so the bar
is also the clock. One composited `scaleX` on a 1px box, 44px touch targets
cancelled out of layout with `margin-block:-21px` so the row stays 1px tall,
paused whenever the carousel pauses, solid where motion is reduced or the
device reported itself short of cores.

The `<input type=range>` stays in the DOM, visually hidden, for the keyboard.

Verified: segments track `ON · ·` → `past past ON`; swipe engages
`is-swiping`, left 1→2, right 2→0 (a 210px drag over a 133px span is 1.6
frames and rounds to 2 — proportional by design), a 3px drag is ignored, and a
vertical drag hands the gesture to the page with the axis locked once at 8px.

#### The catalogue lost two controls and gained a movement

The count said "87 автомобила в наличност" directly under a heading that says
Колекцията and above a grid of them — the third time the page makes the same
statement. The sort offered six orderings of six preview cards, where the
ordering only means anything across all eighty-seven. Both are gone from the
landing section and from the popup; every JS reference is guarded rather than
deleted, and the filter button's own badge is the count now.

**The condensed bar was the real defect.** It kept two rows: the field on one,
the Филтри button on the next — which is the arrangement it has at rest, only
tighter. The bar shrank and nothing appeared to move except a gap.

The phone has one thing the desktop does not: a filter row that is a *single
button*. It does not need a row of its own. So the field gives up the width
the button needs and the button rides up beside it. Measured at 390:

| | at rest | condensed |
|---|---|---|
| bar height | 142px | **55px** |
| search field | 353px wide | 240px wide |
| Филтри button | x:19, y:140 | x:269, y:66 |

87px saved, a 10px gap, and the button's right edge lands flush with where the
field's was. Desktop: 146 → 58, field 520 → 260. The FLIP in `AH.morph` plays
the difference over 340ms on `cubic-bezier(.32,.72,0,1)` — three animations
per toggle (root height, field width + translate, wrapper translate) — so the
button travels rather than teleporting between two grids. The grid still
snaps; nobody sees it snap. Round-trip verified byte-identical at both widths.

#### Two things caught on the way through

**The vehicle page still had the old footer.** The other three were subtracted
a pass ago; this one kept `.foot` and so kept both things the subtraction was
for — it printed the full postal address, phone and mailbox a second time, on
the one page that already carries a phone bar, and it was the only footer on
the site with no Последвайте ни. It is now the same footer as everywhere else.

**`watch()` observed a body it never checked for.** The warm-cache boot bug
from v56 was fixed at the three call sites that existed by gating on
`readyState`. The assumption itself lived in `i18n.js`, which called
`.observe(D.body, …)` unguarded — so a fourth page could reintroduce it. Both
`watch()` and `reapply()` now defer to `DOMContentLoaded` when there is no
body yet, which also means the `<head>` still gets translated on an early
call. Fixed where the assumption lives, not where it happened to surface.

#### Measurement note

Every number here was read from computed styles and live geometry. The
preview pane's animation clock does not advance, which made the first four
attempts at measuring the condensed bar report nonsense — a button at
`x:-203`, heights that never changed — because Web Animations were frozen
mid-flight and `style.transform = ""` does not clear them. `getAnimations()
.forEach(a => a.cancel())` on the container **and** its children before every
read is what made the geometry legible. Worth knowing before trusting a
measurement taken during a morph.

---

### v58 — the phone's hero, put back on the instrument

**This pass exists because v57 was wrong about one thing**, and the owner
caught it: *"the swipe to the next image also looks incredible with animation
on the line and the numbers — i want them fully the same."*

#### What v57 got wrong

v57 argued that a track with a sliding mark "reads as machinery" and replaced
it, on the phone, with three hairline segments. Opening the reference's actual
phone homepage — not its desktop, which is what every earlier pass had
measured — showed the argument was backwards. **The instrument is the best
thing on their hero**, and every piece of it already existed in this
stylesheet, on the desktop, built from the same measurements two passes
earlier. The phone was the only surface that had thrown it away.

So v58 is mostly a **deletion**. The mobile override goes; the desktop
instrument comes back and lands at the phone's own scale because it was
always written in relative units.

#### The reference, measured on a phone this time (375, 360 effective)

| | |
|---|---|
| pagination row | `padding:132px 20px 0`, flex, `gap:8px` — **inside** the picture, 4px below its top edge |
| counter plate | 41 × 24, `rgba(4,4,4,.4)`, `padding-left:12px`, 14/24/400, reads `3 / 8` |
| digit reel | eleven digits **`0 9 8 7 6 5 4 3 2 1 0`**, 1lh apart, `translateY(-(10 − D) lh)` |
| track | real `<input type=range>`, `--visible-fraction: .125` → the bright mark is **1/n** of the track and slides |
| the live bit | `--pagination-scale`, `transition .1s ease-out` |

The reel descends, so advancing a frame translates it **down** and the next
number arrives **from above**. Verified against the a11y text at three
positions: D=5 → −120px, D=8 → −48px, D=1 → −216px.

`--pagination-scale` was measured through a real drag rather than guessed:
**1 → 1.041 at ~110px of travel → 1.180 on release → back to 1 once landed.**
The line swells under a finger. The range *value* only moves on settle, so the
mark steps while the scale is live.

#### Ours, now

Everything above, at our numbers, measured at 375: the row sits at y:132
against a frame top of y:128 — **the reference's 4px, exactly** — and the
track's right edge lands on 359, flush with the picture. `--visible-fraction`
is 0.25 because there are four frames.

**The swell took two attempts.** The first did it the obvious way, `scaleY` on
the whole input, and was wrong twice in one frame: the input is not a line, it
is a 24px box carrying the glass plate, so scaling it grew the *plate* — at
1.7 the 24px box became 41px, which put 8px of it above the top of the
photograph it is supposed to be printed inside, and left it standing a head
taller than the counter plate 8px to its left. A composited transform was the
right instinct on the wrong element. The swell now moves the only thing that
should move: the two gradient stops that draw the hairline. `--hair` is its
half-thickness, 1px at rest and 1.7px under a finger. Verified across a real
drag — the plate stays at y:132 h:24 throughout, both plates stay equal, and
only `--hair` changes.

#### The header, and the four rooms

The language switch has left the bar. v57 put it on the mark's left for
symmetry — switch | mark | menu — and it was balanced and still wrong, because
a mark flanked on both sides is a mark in a row of controls. The reference
survives on one label beside its logo, and so does this.

The mark took the width back: `min(184px, 46vw)`, because the constraint is
the *menu*, not the viewport. Measured: 320 → 147px with 16px of clearance,
360 → 166/19, 375 → 173/24, 414 → 184/38. Centred at every one, no overflow at
any.

The frames were three arguments — "Един стандарт, 87 пъти", "Достъп, а не
обяви" — headlines telling a visitor what to think about a photograph they had
not finished looking at. They are now **four places, named**: Базата (the
building, with the sign lit), Приемната (the Welcome wall), Ателието
(AutoSpa), Работилницата (Сервиз). Nobody needs persuading that a building
exists, which is why it now reads as arrival rather than as a pitch.

And **no buttons on the phone** — the owner's call, and the right one. They
are still in the markup and still on the desktop; only the phone hides them.
An earlier cut of this pass deleted the elements outright and took them off
the desktop too, which is the one thing the brief said not to touch.

#### Crops

Three of the four sources are wider than the 5/6 frame, so `object-position`
is per slide and was tuned by arithmetic, not by eye: for `cover`, the window's
left edge is `X% × (scaledWidth − boxWidth)`, not `X%` of the image.
- **Базата** 12% — at 25% the window opened at 17.2% of the source and cut the
  AutoHaus sign, which sits at 12.9–22.7%.
- **Приемната** 71% — puts the window at 37.6–84.4% against the word
  "AutoHaus" at 38–84%. It fits to within half a percent, which is why it
  reads edge to edge.

#### One thing that is not solved

**There is no photograph of the workshop.** Слайд 4 borrows a vehicle shot
(`img/v/2026-07_1-16-*`) exactly as the Сервиз card already does. It is not a
false claim — AutoHaus has its own service, with its own line and ГТП — but it
is a car in a showroom standing in for a workshop, and one real photograph of
the bay would make that frame the strongest of the four.

#### Verified

Four slides, segments gone, CTA groups hidden on the phone and present on the
desktop, `--visible-fraction` 0.25, counter reading `1 / 4`, a11y line "Кадър 1
от 4" → "Frame 1 of 4". Swipe: index 0 → 1, `is-swiping` on and off, `--hair`
1px → 1.7px → 1px, range value follows to "2". No horizontal overflow at 320,
360, 375, 390 or 414. Desktop untouched at 1280: both plates still
`rgba(6,6,6,.34)`, arrows `flex`, counter 18px, logo 136px, media 1.73, four
CTA groups. Zero console errors, zero untranslated strings in English.

---

### v59 — why their swipe feels like an object and ours felt like a slider

v58 matched the reference's *positions*. The owner's note was that matching
positions had not bought the feeling, and they were right. This pass sampled
the reference's phone **one animation frame at a time** through a real drag,
which is the only way the answer was ever going to show up.

#### The finding: `--pagination-scale` is not a swell, it is a pulse

| moment | value |
|---|---|
| rest | 1 |
| 45px of drag | 1 |
| 85px | 1.031 |
| 165px | 1.112 |
| release | 1.238 |
| **+105ms** | **1.997** ← the peak, on the exact frame the range value steps |
| +200ms | 1 |

The line tightens under the finger in proportion to how far you have pulled,
and then, at the instant the frame commits, it **snaps** — a hard ~100ms rise
to double weight and a slower ~200ms fall. The digit has already changed by
then; it flips crisply during the gesture rather than rolling.

So the grammar is: **the number tells you where you are going while you are
still dragging, and the line tells you it is done when you let go.** The
gesture feels satisfying because the release is *rewarded*, not merely obeyed.
That is the whole thing, and no amount of matching a 24px plate to a 24px
plate was ever going to produce it.

Ours now has both halves. `--drag` is written on every `touchmove` as the
distance to the *nearest* frame — 0 at a resting point, 1 halfway between two
— so the hairline is heaviest exactly when the outcome is least decided.
Measured through a real drag: `--hair` 1 → 1.330 → **1.697** → 1.346 → 1.006px,
then the pulse on commit. `.is-pulse` is fired in `go()` rather than in the
touch handler, so the instrument breathes on autoplay and on the arrows too.

`--hair` had to be **registered** with `@property` or none of it interpolates:
an unknown custom property is a token, and a token cannot be animated.
Chrome 85, comfortably inside the Chrome 109 floor Windows 7 sets.

#### The other finding: 152px of undifferentiated black

The "empty and unbalanced" complaint had a number behind it.

| | Bentley | ours (v58) | ours now |
|---|---|---|---|
| top edge → logo | 27px | **16px** | 34px |
| header bottom → image | **10px** | **60px** | 13px |
| headline → stage end | ~0 | **92px** | 34px |

The bar was simultaneously *cramped against the glass* and *marooned from
everything it belongs to*. Their logo row sits 74px down the page and its
bottom is 10px above the photograph; ours started 16px from the edge and then
left a sixty-pixel void. Closing both gaps is most of what changed.

The 92px at the bottom was `.stage-text{margin-bottom:32px}` plus
`.h3{margin-bottom:16px}` — 48px that used to hold a paragraph and two buttons
apart, holding nothing apart since v58, plus 44px of item padding.

Also: the frame went 5/6 → **4/5**, and the transition 1.6s → **1.05s**.
1.6s was measured off their *desktop*; on a phone the gesture ends in the hand,
and a frame still travelling a second and a half after the finger has let go
stops being caused by it. Their media boxes are ~74% home at 500ms.

**Two specificity traps cost a measurement each.** `.js .stage{--slide-dur:1.6s}`
at (0,2,0) beat a bare `.stage` override, so the frame kept travelling for 1.6s
while the stylesheet said 1.05. And v58's `.stage.is-swiping .pag-range{--hair:1.7px}`
outranked the calc that replaced it, pinning the line at maximum for the whole
drag instead of tracking it. Both are recorded in the CSS next to the fix.

#### The header the owner asked for

Menu on the left, mark centred and dominant, language on the right. v58 had
removed the switch entirely, which took away a control people use rather than
moving it. Two small flanks of near-equal weight with the mark between them is
the symmetrical reading, and the mark was re-sized against *two* constraints
now rather than one: `min(184px, 45vw)`. At 320 — the tightest case — menu
16..72, mark 88..232 centred, switch 252..304, gaps of 16 and 20.

#### Rich without busy — three details, no new words

The brief asked for depth rather than copy. A flat photograph on flat black
has no material to it.

1. **The photograph is graded and vignetted** — the same treatment the card
   wall already uses, so hero and cards are lit by the same hand. The corners
   going down is what brings the middle forward.
2. **The frame is mounted** — a 1px inset hairline at 7% white. It ends the
   photograph deliberately instead of letting it dissolve into the background.
3. **The house angle signs it** — a 1px gold tick above the kicker on the same
   24.7°, verified in the computed transform as `matrix(1,0,-0.46,1,0,0)`. The
   one element here not derived from the reference.

All three are mobile-only and all three drop out under `.lo-fx`.

#### Verified

`--drag` and `--hair` tracked live through a drag (values above), pulse on
commit, index 1 → 2. Logo centred with no overflow at 320, 360, 375, 390, 414.
Desktop at 1280 untouched: 134px pad, 1.6s, 1.73 ratio, absolute media, 4 CTA
groups, 5 nav links, arrows, the 18/11px counter hierarchy, and
`imgFilter: none` / `vignette: none` / `kickerTick: none` — none of the mobile
treatment leaks. Zero console errors.

---

### v60 — new photographs, the language switch back on its rails, and a swipe that follows the finger

Four things the owner asked for, and each one had a real defect behind it.

#### The swipe now behaves like the reference, not like a slider

Two faults, both found by sampling our own drag frame by frame the way the
reference was sampled:

- **The bright block never moved during the drag.** `range.value` was written
  only on settle, so the line jumped instead of sliding. It now tracks the
  fractional position on every `touchmove` — the block slides *right* as you
  pull to the next frame and *left* as you pull back, the directional feedback
  the owner named. Fractional positions need `step="any"`, switched on when the
  axis locks to the carousel and restored to `"1"` on release so the keyboard
  keeps stepping one frame at a time. Measured live: value 3.00 → 3.24 → 3.63 →
  4.00, block 213 → 284px.
- **The number "rolled too much."** `roll()` walked the whole path between two
  numbers, so a swipe that jumped two frames — or a wrap like 1→4 that is one
  step but numerically far — rolled through every number in between and read as
  a bug. It now builds a **two-digit strip** and rolls exactly one step, in the
  direction of travel: forward the new number drops from the top
  (`.is-rolling`), backward it rises from the bottom (`.is-rolling-rev`, the
  same keyframe played in reverse). Direction is the shortest cyclic step, so a
  3→0 autoplay wrap rolls forward and a swipe back rolls backward. Verified:
  forward roll 2 digits, backward roll 2 digits with `rollingRev`, never more.

And the line is **stronger and lasts longer**, per the ask: the drag-time
thickening climbs to ~2.4px at the undecided midpoint (was 1.7), and the commit
pulse is a hard ~105ms rise to 2.7px with a slower 440ms fall (was 305ms to
2px). All of it — the pulse and the drag calc — was **scoped to `≤767px`**;
v58 had left it global, so the desktop scrubber was quietly gaining a thickness
animation on every frame change. Confirmed gone: `pulseAnimationOnDesktop:
"none"`.

#### The language switch was genuinely broken on mobile

The desktop control is two words on a hairline with a 2px gold rule sliding
under the active one. The mobile override had squeezed it to 10px **and** — the
actual bug — given `.lang::before` both `top:5px` and `bottom:5px`, which turned
the bottom hairline the gold rule rides on into a stretched vertical smear. The
override is deleted; the phone now wears the exact desktop mechanism at a
slightly smaller size (30px options vs 36). Verified: clicking EN slides the
gold indicator 299→329px via `translateX(30px)`, the desktop transform.

The header is now the composition the owner drew: **menu left · mark centred
and dominant · BG/EN right**. The mark came down a touch to `min(170px, 43vw)` —
138px at 320, 170px capped at 414 — centred at every width with no overflow.

#### The photographs

Three hero frames and one wall card swapped, with responsive jpg+webp
derivatives generated by `sharp` (installed locally, not committed):
`outside_autohaus` (the building by day, sign on the fascia — now also the LCP
preload and the catalog wedge texture, both of which still pointed at a
`autohaus_outside` set that **no longer exists** and was 404ing), `indoor_cars`
(the showroom, golden hour), `outside-flags` (the three AutoHaus banners), and
`three-cars` on the leasing card. The two frames whose copy no longer fit their
new picture were re-titled: slide 2 Шоурумът / Отблизо, slide 4 Локацията /
Заповядайте with its action changed from "to the workshop" to "get in touch".

#### Консиерж → Обслужване

The concierge service is renamed to plain Bulgarian everywhere it shows — nav,
hero CTA, footers, the concierge page's own title, tag and host role — while
the page keeps its warm identity (the "Седнете за момент." heading, Иван's
name). English follows as "Personal service". Verified: zero untranslated
Cyrillic in EN, the label reads Обслужване / Personal service on all three
surfaces.

**One thing worth flagging:** "Обслужване" now sits alongside "Сервиз" (the
workshop), and both are a kind of "service" — in English they read as "Personal
service" vs "Service", which is clear, but in Bulgarian the two words are
close. If that overlap ever grates, "Съдействие" (assistance) or "Заявка"
(request) would separate them cleanly. Left as asked for now.

#### Verified

All four hero images load and resolve (Performance API: 31 resources, 0
failed — the earlier 404s were a stale `autohaus_outside` preload and catalog
texture, both repointed). Swipe: thumb follows the finger both directions,
one-step roll forward and reverse, pulse on commit, hair to ~2px. Header
centred with no overflow at 320/360/390/414. Language switch matches desktop,
gold rule slides on EN. Desktop at 1280 untouched — pad 134px, 1.6s, 1.73,
4 CTAs, 5 nav links, 36px lang options, 18/11px counter, and the pulse
animation `none`. Concierge page renamed and intact.

---

### v61 — the card sheet, the popup filter, and the dossier masthead

A round of bug-fixes, each root-caused by measurement rather than guessed.

#### The mobile card jumped to its neighbour on close

Opening a service card below 1024 makes it a `position:fixed` full-screen
sheet — which pulls it OUT of the horizontal rail's flow, so the rail slides
its neighbours across behind the sheet. On close the sheet was torn down in
one frame with nothing to correct the rail, so `scrollLeft` was left at ~289
(one card over) and the neighbour flashed in from the left: the "it goes to
the next card" bug, measured `0 -> 289` on close. Now the rail position is
saved on open and restored in the SAME frame the sheet is removed — verified
`railScrollLeft` holds at 0 through the whole close.

And the open/close is no longer instant. The sheet's WHITE is still instant
(so the rail behind is covered from frame one and never flashes through), but
the photo and panel now `cw-rise` into it (opacity + 24px) and `cw-sink` back
out over 200ms before teardown. The `cw-rise` animation is confirmed present
and resolving to opacity 1 / transform none.

#### The popup filter is beside the search from the start

It used to ride up beside the field only once you scrolled. The owner asked
for it always there — so the one-row `search pills` layout the condensed
state used is now the RESTING layout of the layer's bar (`.cat__tools .ftools`
on mobile), and because rest and condensed are the same arrangement the scroll
morph measures zero and plays nothing. Verified: at rest, no scroll, the
filter sits beside the field, 56px tall, `sameRow: true`.

#### The dossier masthead showed only the car's model + price

The `.dmini` title strip is anchored at `top:var(--nav-h)` and was hidden with
`translateY(-110%)` — which lifts it by only its OWN height (~43px), leaving
it at y:21..60 ON the nav (its z:70 over the nav's z:50). So at the top of a
vehicle page the model and price covered the logo and the header read as gone.
It now travels its height PLUS the nav's — `translateY(calc(-100% - var(--nav-h)))`
— so hidden is genuinely above the viewport (measured y:-39, bottom 0), and the
clean masthead shows at rest.

The phone icon leaves that masthead on a phone (the ask already lives in the
`.dbar` call button that rises with the strip), and the language switch and
the two social marks are resized to the home header's own mobile scale so the
two mastheads read as one family.

#### And the mark came down ~15%

`min(184px,45vw) -> min(145px,37vw)`: 139px at 375, still centred, no overflow.

#### Verified, and what still needs the owner's eyes

Measured clean: no horizontal overflow at 375 / 768 / 900, the rail round-trip,
the dmini hidden/again, the popup filter at rest, 0 failed resources. The
browser-preview pane stopped compositing partway through this pass, so the
purely-visual notes — the card wall's entrance "feel", the reported ambient
"blink", and the tablet/laptop look between breakpoints — could not be watched
frame by frame; the structure measures sound (2/3/4-col collection grid, fixed
card rail, no overflow) but the subjective polish there wants a live look.
