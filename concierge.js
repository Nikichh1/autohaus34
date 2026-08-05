/* ============================================================
   AUTOHAUS — Concierge

   This page exists to change what arrives in the owner's day.

   Before: "Здравейте, тази БМВ налична ли е?" — a question that costs a
   phone call to answer and tells him nothing about whether the person on
   the other end is buying.

   After: a brief with a car, a budget, a timeline, a trade-in and a name,
   already formatted, already scored, already routed.

   Four mechanisms do the work:
     · SHAPE   — one question per screen, phrased as a conversation, and
                 every question landing on the SAME line of the screen so
                 nothing about the page jumps between them. A grid of
                 twenty inputs reads as bureaucracy and gets abandoned; a
                 sequence reads as service and gets finished.
     · PRESENCE— Иван is on the page the whole way: named, in a plate, with
                 a line that changes with the question. The room also keeps
                 a running record of what he has HEARD, and every line in it
                 is a way back to the question it came from. That record is
                 the difference between a form asking and a person
                 listening, and it is why the review step is a confirmation
                 rather than the first chance to correct anything.
     · REWARD  — after the budget question the page shows how many cars in
                 the real collection match. Answering pays out immediately,
                 and a good share of users find their car here and never
                 need a human at all.
     · TRIAGE  — casual questions are given a visible, dignified exit
                 (answers + WhatsApp) so they never enter this queue, and
                 every brief carries a completeness flag the owner's inbox
                 can sort on.

   The room it all sits in is CSS — see "v41 — THE CONSULTATION ROOM" at the
   bottom of style.css. This file only decides what is said and when.
   ============================================================ */
(function () {
  "use strict";
  var D = document, AH = window.AH, V = AH.all, CFG = AH.cfg;
  var KEY = "ah-concierge-v1";
  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---- state ---- */
  var S = {
    intent: "", vehicle: "", make: "", model: "", body: "",
    must: [], cond: "", fuel: "",
    band: "", pay: [], when: "",
    tradeCar: "", tradeYear: "", tradeKm: "", tradeLease: "", tradeNote: "",
    name: "", phone: "", email: "", reach: "Обаждане", note: ""
  };

  try {
    var saved = JSON.parse(localStorage.getItem(KEY) || "null");
    if (saved) Object.keys(S).forEach(function (k) { if (saved[k] != null) S[k] = saved[k]; });
  } catch (e) { /* private mode — the form just will not remember */ }

  function persist() {
    try {
      localStorage.setItem(KEY, JSON.stringify(S));
      var el = D.getElementById("cg-saved");
      if (el) el.textContent = "Запазено";
    } catch (e) {}
  }

  /* ---- prefill from wherever the user came from ---- */
  var cameWithPrefill = false;
  (function prefill() {
    var q = new URLSearchParams(location.search);
    cameWithPrefill = ["v", "intent", "make", "band", "fuel", "chapter", "visit", "q"]
      .some(function (k) { return q.get(k); });
    var vid = q.get("v");
    if (vid) {
      var v = AH.byId(vid);
      if (v) { S.vehicle = v.id; S.intent = "stock"; S.make = v.make; S.model = v.model; }
    }
    if (q.get("intent")) S.intent = q.get("intent");
    /* "Запази тест драйв" is the same brief with the ask already written in,
       so a viewing never costs anyone a phone call either */
    if (q.get("visit") && !/тест драйв/i.test(S.note)) {
      S.note = ("Искам оглед и тест драйв. " + S.note).trim();
    }
    /* a search that found nothing is the single most useful thing they
       could have told us — it enters the brief verbatim rather than
       being thrown away at the empty state */
    if (q.get("q")) S.note = (S.note + " Търсих: " + q.get("q") + ".").trim();
    if (q.get("make")) S.make = q.get("make");
    if (q.get("band")) S.band = q.get("band");
    if (q.get("fuel")) S.fuel = q.get("fuel");
    /* a chapter carries an intent of its own — someone who filtered to the
       armoured cars and found nothing wants an armoured car */
    if (q.get("chapter") === "guard" && S.must.indexOf("Брониран") < 0) S.must.push("Брониран");
  })();

  /* ============================================================
     FLOW — which steps this person actually sees
     ============================================================ */
  function steps() {
    var i = S.intent;
    if (!i) return ["intent"];
    if (i === "other") return ["intent", "contact", "review"];
    if (i === "trade") return ["intent", "trade", "when", "contact", "review"];
    var list = ["intent", "car", "spec", "budget", "when"];
    if (S.pay.indexOf("С бартер") > -1) list.push("trade");
    return list.concat(["contact", "review"]);
  }
  var OPTIONAL = { spec: 1, trade: 1, car: 1 };
  /* answering IS the answer on a single-choice question with nothing else
     on the screen — an extra "Продължи" click there reads as friction for
     nothing. Only these two qualify; every other step has a second ask
     under the first and must not run away from it. */
  var AUTO = { intent: 180, when: 380 };

  var at = 0;                                   /* index into steps() */
  var sections = {};
  Array.prototype.forEach.call(D.querySelectorAll(".cg-step"), function (s) {
    sections[s.getAttribute("data-step")] = s;
  });

  var elSpine = D.getElementById("cg-spine"),
      elSay = D.getElementById("cg-say"),
      elNo = D.getElementById("cg-stepno"),
      elBack = D.getElementById("cg-back"),
      elNext = D.getElementById("cg-next"),
      elSkip = D.getElementById("cg-skip"),
      elNav = D.getElementById("cg-nav"),
      elRoom = D.getElementById("cg"),
      elSteps = D.getElementById("cg-steps"),
      elHatch = D.getElementById("hatch");

  function label(btn, text) {
    var l = btn.querySelector(".btn__label");
    if (l) l.textContent = text; else btn.textContent = text;
  }
  function current() { return steps()[at]; }
  function stepName(k) { return (sections[k] && sections[k].getAttribute("data-name")) || ""; }

  /* ============================================================
     THE HOST
     ============================================================ */
  var sayNow = null;
  var DONE_SAY = "Заявката е при мен. Ще се чуем.";
  function renderSay(name) {
    if (!elSay) return;
    var txt = name === "done" ? DONE_SAY
      : (sections[name] && sections[name].getAttribute("data-say")) || "";
    if (txt === sayNow) return;
    sayNow = txt;
    elSay.classList.remove("is-new");
    void elSay.offsetWidth;                      /* restart the animation */
    elSay.textContent = txt;
    if (!reduce) elSay.classList.add("is-new");
  }

  /* ============================================================
     THE SPINE — the shape of the conversation AND the record of it

     These started as two things: a progress bar, and a list of what had
     been said. They are the same thing. A step that has been answered
     shows its answer under its own name, so the column reads as a
     transcript that happens to know how much is left — which is what
     turns a form into somebody listening, and it costs less height than
     the two separate lists did.

     The total is unknown until the intent is chosen (it is what decides
     which steps exist), so on the first screen there is one mark and no
     promise. Every step already visited is a button back to itself.
     ============================================================ */
  function answerFor(k) {
    var v = S.vehicle ? AH.byId(S.vehicle) : null;
    if (k === "intent") return INTENT_NAME[S.intent] || "";
    if (k === "car") return v ? v.full : [S.make, S.model, S.body].filter(Boolean).join(" · ");
    if (k === "spec") return [S.must.join(", "), S.cond, FUEL_NAME[S.fuel]].filter(Boolean).join(" · ");
    if (k === "budget") return [BAND_NAME[S.band], S.pay.join(", ")].filter(Boolean).join(" · ");
    if (k === "when") return S.when || "";
    if (k === "trade") return [S.tradeCar, S.tradeYear, S.tradeKm ? S.tradeKm + " км" : ""]
      .filter(Boolean).join(" · ");
    if (k === "contact") return [S.name, S.phone || S.email].filter(Boolean).join(" · ");
    return "";
  }

  function renderSpine() {
    var rows = steps().map(function (k, n) {
      return { key: k, n: n, name: stepName(k), value: answerFor(k),
               state: n < at ? "is-done" : n === at ? "is-now" : "" };
    });

    if (elSpine) {
      elSpine.innerHTML = rows.map(function (r) {
        var open = r.n <= at;
        var inner = '<i aria-hidden="true"></i><span class="cgs__nm">' + AH.esc(r.name) + "</span>" +
          (r.value ? '<b class="cgs__val">' + AH.esc(r.value) + "</b>" : "");
        return '<li class="' + r.state + '"' + (r.n === at ? ' aria-current="step"' : "") + ">" +
          (open ? '<button type="button" data-goto="' + r.key + '">' + inner + "</button>"
                : "<span>" + inner + "</span>") + "</li>";
      }).join("");
    }

    /* the same rows, as the phone's one-line receipt */
    var said = rows.filter(function (r) { return r.value; });
    heard.hidden = said.length === 0;
    heardL.innerHTML = said.map(function (r) {
      var fresh = !heardSeen[r.key] && !reduce;
      return '<li><button type="button" class="heard__i' + (fresh ? " is-new" : "") +
        '" data-goto="' + r.key + '"><b>' + AH.esc(r.name) + "</b><span>" +
        AH.esc(r.value) + "</span></button></li>";
    }).join("");
    heardSeen = {};
    said.forEach(function (r) { heardSeen[r.key] = 1; });
  }

  var heard = D.getElementById("cg-heard"),
      heardK = D.getElementById("cg-heard-k"),
      heardL = D.getElementById("cg-heard-l"),
      heardSeen = {};

  heardK.addEventListener("click", function () {
    var on = heard.classList.toggle("is-open");
    heardK.setAttribute("aria-expanded", on ? "true" : "false");
  });

  function jumpFrom(e) {
    var b = e.target.closest ? e.target.closest("[data-goto]") : null;
    if (!b) return;
    var n = steps().indexOf(b.getAttribute("data-goto"));
    if (n > -1 && n !== at) go(n);
  }
  heardL.addEventListener("click", jumpFrom);
  if (elSpine) elSpine.addEventListener("click", jumpFrom);

  /* ============================================================
     THE STEP CHANGE
     Arrivals and departures are different movements — a thing that leaves
     on the arrival curve hangs about at the end of its own exit. The
     outgoing step is lifted out of the flow for the length of its
     departure so the incoming one never has to wait for it.
     ============================================================ */
  var LEAVE = 170;
  var curName = null, swapT = 0;

  function clearSwap() {
    if (swapT) { clearTimeout(swapT); swapT = 0; }
    Array.prototype.forEach.call(D.querySelectorAll(".cg-step.is-off"), function (s) {
      s.classList.remove("is-off");
      s.removeAttribute("inert");
    });
  }

  function paint(name) {
    Object.keys(sections).forEach(function (k) {
      sections[k].classList.remove("is-off");
      sections[k].classList.toggle("is-on", k === name);
    });
    curName = name;

    var list = steps();
    renderSpine();
    renderSay(name);
    /* the greeting recedes once the conversation starts — the rail needs
       that room for the record, and pleasantries that stay on screen for
       eight questions stop being pleasantries */
    elRoom.classList.toggle("is-live", at > 0 || name === "done");

    elNo.textContent = name === "done" ? ""
      : "Въпрос " + (at + 1) + (list.length > 1 ? " от " + list.length : "");

    elBack.hidden = at === 0;
    elSkip.hidden = !OPTIONAL[name];
    /* the button carries its label in a span — replacing innerHTML would
       destroy it, and with it the uppercase tracking the whole UI uses */
    label(elNext, name === "review" ? "Изпрати заявката" : "Продължи");

    elRoom.classList.toggle("is-done", name === "done");
    if (name === "done") { elHatch.hidden = true; }
    if (name === "review") renderBrief();
    if (name === "budget") renderMatch();
    if (name === "car") renderPicked();

    /* move the reading position, not the whole page: the question always
       lands on the same line of the conversation, so the only scroll worth
       making is the one that brings that line back under the plate — and
       only ever upward. Jumping to the top of the document on every step
       would put the masthead back in front of the reader on a phone. */
    var top = elSteps.getBoundingClientRect().top + window.pageYOffset -
      (parseFloat(getComputedStyle(D.documentElement).getPropertyValue("--plate-h")) || 56) - 20;
    if (window.pageYOffset > top + 4) window.scrollTo(0, Math.max(0, top));

    var h = sections[name].querySelector(".cg-q, .cg-done__h");
    if (h) { h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true }); }
  }

  function show(name, instant) {
    if (curName === name) { paint(name); return; }
    clearSwap();
    if (instant || reduce || curName === null) { paint(name); return; }
    var out = sections[curName];
    out.classList.remove("is-on");
    out.classList.add("is-off");
    /* it is on screen for 170ms and it is no longer the question being
       asked, so nothing in it should be tabbable while it leaves */
    out.setAttribute("inert", "");
    swapT = setTimeout(function () {
      swapT = 0;
      out.classList.remove("is-off");
      out.removeAttribute("inert");
      paint(name);
    }, LEAVE);
  }

  function go(n, instant) {
    var list = steps();
    at = Math.max(0, Math.min(n, list.length - 1));
    show(list[at], instant);
  }

  /* ============================================================
     BINDING — options and chips write straight into S
     ============================================================ */
  function paintGroup(g) {
    var f = g.getAttribute("data-field");
    var single = g.hasAttribute("data-single");
    Array.prototype.forEach.call(g.querySelectorAll("[data-value]"), function (b) {
      var on = single ? S[f] === b.getAttribute("data-value")
                      : (S[f] || []).indexOf(b.getAttribute("data-value")) > -1;
      b.classList.toggle("is-on", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  Array.prototype.forEach.call(D.querySelectorAll("[data-field]"), function (g) {
    var f = g.getAttribute("data-field");
    var single = g.hasAttribute("data-single");
    Array.prototype.forEach.call(g.querySelectorAll("[data-value]"), function (b) {
      b.addEventListener("click", function () {
        var val = b.getAttribute("data-value");
        if (single) {
          S[f] = S[f] === val ? "" : val;
        } else {
          var i = S[f].indexOf(val);
          if (i > -1) S[f].splice(i, 1); else S[f].push(val);
        }
        paintGroup(g); persist(); renderSpine();
        if (f === "band" || f === "pay" || f === "make") renderMatch();
        if (AUTO[f] && S[f]) setTimeout(function () {
          if (current() === f) go(at + 1);
        }, AUTO[f]);
      });
    });
    paintGroup(g);
  });

  /* text + select fields */
  var FIELD_IDS = {
    "cg-model": "model", "cg-body": "body", "cg-cond": "cond", "cg-fuel": "fuel",
    "cg-tmake": "tradeCar", "cg-tyear": "tradeYear", "cg-tkm": "tradeKm",
    "cg-tlease": "tradeLease", "cg-tnote": "tradeNote",
    "cg-name": "name", "cg-phone": "phone", "cg-email": "email",
    "cg-reach": "reach", "cg-note": "note"
  };
  Object.keys(FIELD_IDS).forEach(function (id) {
    var el = D.getElementById(id); if (!el) return;
    var key = FIELD_IDS[id];
    if (S[key]) el.value = S[key];
    el.addEventListener("input", function () {
      S[key] = el.value; persist();
      if (key === "fuel") renderMatch();
      el.closest(".field").classList.remove("is-bad");
    });
    el.addEventListener("change", function () {
      S[key] = el.value; persist(); renderSpine();
      if (key === "fuel") renderMatch();
    });
    /* a text field writes into the record when the sentence is finished,
       not on every keystroke — a line that re-renders per character reads
       as a machine transcribing rather than as somebody listening */
    el.addEventListener("blur", renderSpine);
  });

  /* make chips, built from the makes AutoHaus actually deals in */
  (function buildMakes() {
    var wrap = D.getElementById("cg-makes");
    var tally = {};
    V.forEach(function (v) { tally[v.make] = (tally[v.make] || 0) + 1; });
    var makes = Object.keys(tally).sort(function (a, b) { return tally[b] - tally[a]; });
    if (S.make && makes.indexOf(S.make) < 0) makes.unshift(S.make);
    makes.push("Друга марка");
    wrap.innerHTML = makes.map(function (m) {
      return '<button type="button" class="chip" data-value="' + AH.esc(m) + '">' + AH.esc(m) + "</button>";
    }).join("");
    Array.prototype.forEach.call(wrap.querySelectorAll("[data-value]"), function (b) {
      b.addEventListener("click", function () {
        var val = b.getAttribute("data-value");
        S.make = S.make === val ? "" : val;
        paintGroup(wrap); persist(); renderMatch(); renderSpine();
      });
    });
    paintGroup(wrap);
  })();

  /* the specific car, when they arrived from one */
  function renderPicked() {
    var box = D.getElementById("cg-picked");
    var v = S.vehicle ? AH.byId(S.vehicle) : null;
    if (!v) { box.hidden = true; return; }
    box.hidden = false;
    box.innerHTML =
      '<div class="cg-picked">' +
        '<span class="cg-picked-photo">' +
          /* width/height are not cosmetic here: without them the browser has
             no ratio to reserve and the photograph's box is zero-height until
             the bytes land, which drops the whole card on the reader. The CSS
             still decides the rendered size (cover fill); these only supply
             the placeholder. */
          AH.picture(v.shots[0], { alt: v.full, src: 400, sizes: "160px",
                                   width: 160, height: 100 }) +
        "</span>" +
        '<span class="cg-picked-body">' +
          '<span class="cg-sub">' + v.ref + " · избран автомобил</span>" +
          '<span class="cg-picked-h">' + AH.esc(v.model) + "</span>" +
          '<span class="body-s cg-picked-make">' + AH.esc(v.make) + "</span>" +
          '<span class="body-s cg-picked-spec">' + AH.yr(v) + " · " + AH.km(v.km) + " · " + v.hp + " к.с. · " +
            (v.price == null ? "цена при запитване" : AH.price(v.price)) + "</span>" +
          '<button type="button" class="btn btn--s btn--tertiary cg-unpick" id="cg-unpick">' +
            '<span class="btn__label">Търся друг автомобил</span></button>' +
        "</span>" +
      "</div>";
    D.getElementById("cg-unpick").addEventListener("click", function () {
      S.vehicle = ""; persist(); renderPicked(); renderSpine(); renderMatch();
    });
  }

  /* ============================================================
     MATCH — the payout for answering
     ============================================================ */
  var BANDS = {
    "0-30": [0, 30000], "30-60": [30000, 60000], "60-100": [60000, 100000],
    "100-200": [100000, 200000], "200+": [200000, Infinity]
  };
  function matches() {
    return V.filter(function (v) {
      if (S.make && S.make !== "Друга марка" && v.make !== S.make) return false;
      if (S.fuel && v.fuel !== S.fuel) return false;
      if (S.must.indexOf("Брониран") > -1 && v.tags.indexOf("guard") < 0) return false;
      if (S.band) {
        var b = BANDS[S.band];
        /* a privately priced car is never excluded by a budget — that is
           exactly the conversation the owner wants to have */
        if (v.price != null && (v.price < b[0] || v.price >= b[1])) return false;
      }
      return true;
    });
  }
  function renderMatch() {
    var box = D.getElementById("cg-match");
    if (!box) return;
    if (!S.band && !S.make) { box.hidden = true; return; }
    var m = matches();
    box.hidden = false;
    box.classList.toggle("is-none", m.length === 0);

    var n = D.getElementById("cg-match-n");
    if (n.textContent !== String(m.length)) {
      n.textContent = m.length;
      if (!reduce) { n.classList.remove("is-roll"); void n.offsetWidth; n.classList.add("is-roll"); }
    }
    D.getElementById("cg-match-t").textContent = m.length === 0
      ? "автомобила в наличност отговарят. Точно за това съществува тази заявка — ще го намерим."
      : (m.length === 1 ? "автомобил в колекцията отговаря на описаното дотук."
                        : "автомобила в колекцията отговарят на описаното дотук.");
    var cta = D.getElementById("cg-match-cta");
    cta.hidden = m.length === 0;
    cta.href = "index.html?" + new URLSearchParams(
      Object.assign({}, S.make && S.make !== "Друга марка" ? { make: S.make } : {},
        S.band ? { band: S.band } : {}, S.fuel ? { fuel: S.fuel } : {})).toString() + "#avtomobili";
  }

  /* ============================================================
     VALIDATION
     ============================================================ */
  function bad(id, on) {
    var el = D.getElementById(id);
    if (el) el.closest(".field").classList.toggle("is-bad", !!on);
  }
  function validate(name) {
    if (name !== "contact") return true;
    var ok = true;
    if (!S.name.trim()) { bad("cg-name", 1); ok = false; } else bad("cg-name", 0);
    var hasPhone = S.phone.replace(/\D/g, "").length >= 8;
    var hasMail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(S.email.trim());
    if (!hasPhone && !hasMail) { bad("cg-phone", 1); ok = false; } else bad("cg-phone", 0);
    if (S.email.trim() && !hasMail) { bad("cg-email", 1); ok = false; } else bad("cg-email", 0);
    if (!ok) {
      var first = D.querySelector(".field.is-bad input");
      if (first) first.focus();
    }
    return ok;
  }

  /* ============================================================
     THE BRIEF
     ============================================================ */
  function ref() {
    if (!S._ref) {
      S._ref = "AH-R-" + String(Date.now()).slice(-5);
      persist();
    }
    return S._ref;
  }
  var INTENT_NAME = {
    stock: "Автомобил от колекцията", source: "Търсене по поръчка",
    trade: "Продажба или замяна", other: "Друго запитване"
  };
  var BAND_NAME = {
    "0-30": "до 30 000 €", "30-60": "30 000 – 60 000 €", "60-100": "60 000 – 100 000 €",
    "100-200": "100 000 – 200 000 €", "200+": "над 200 000 €"
  };
  var FUEL_NAME = { petrol: "Бензин", diesel: "Дизел", hybrid: "Хибрид", phev: "Plug-in хибрид", ev: "Електрически" };

  /* the rows, once — rendered to HTML for the customer and to text for the
     owner, so the two can never disagree */
  function rows() {
    var r = [], v = S.vehicle ? AH.byId(S.vehicle) : null;
    r.push(["Тип заявка", INTENT_NAME[S.intent] || "—"]);
    if (v) r.push(["Автомобил", v.full + " · " + v.ref + " · " +
      (v.price == null ? "цена при запитване" : AH.price(v.price))]);
    if (!v && (S.make || S.model)) r.push(["Търси", [S.make, S.model].filter(Boolean).join(" ")]);
    if (S.body) r.push(["Каросерия", S.body]);
    if (S.cond) r.push(["Състояние", S.cond]);
    if (S.fuel) r.push(["Двигател", FUEL_NAME[S.fuel] || S.fuel]);
    if (S.must.length) r.push(["Задължително", S.must.join(", ")]);
    if (S.band) r.push(["Бюджет", BAND_NAME[S.band]]);
    if (S.pay.length) r.push(["Плащане", S.pay.join(", ")]);
    if (S.when) r.push(["Срок", S.when]);
    if (S.tradeCar) {
      r.push(["За замяна", [S.tradeCar, S.tradeYear, S.tradeKm ? S.tradeKm + " км" : ""]
        .filter(Boolean).join(" · ")]);
      if (S.tradeLease) r.push(["Лизинг по замяната", S.tradeLease]);
      if (S.tradeNote) r.push(["Забележки", S.tradeNote]);
    }
    r.push(["Контакт", [S.name, S.phone, S.email].filter(Boolean).join(" · ")]);
    r.push(["Предпочита", S.reach]);
    if (S.note) r.push(["Бележка", S.note]);
    if (S.intent === "stock" || S.intent === "source")
      r.push(["Съвпадения в наличност", String(matches().length)]);
    return r;
  }

  /* Completeness, for the owner's routing rules — never shown to the
     customer. "Complete" has to mean something different per intent: a
     trade-in enquiry is never asked for a budget, so scoring it on the
     buying scale would file every one of them as junk. */
  function reachable() { return S.phone.replace(/\D/g, "").length >= 8; }
  function quality() {
    var pts = 0;
    if (S.intent === "trade") {
      if (S.tradeCar) pts += 2;
      if (S.tradeYear || S.tradeKm) pts++;
      if (reachable()) pts++;
      if (S.when) pts++;
    } else if (S.intent === "other") {
      if (S.note.trim().length > 15) pts += 2;
      if (reachable()) pts++;
      if (S.name.trim()) pts++;
    } else {
      if (S.make || S.model || S.vehicle) pts++;
      if (S.band) pts++;
      if (S.when && S.when !== "Проучвам") pts++;
      if (reachable()) pts++;
      if (S.must.length || S.cond || S.body) pts++;
    }
    return pts >= 4 ? "full" : pts >= 2 ? "partial" : "light";
  }

  /* What is actually missing, so the nudge only ever names a question this
     path asked. Telling someone to add a budget on a path that never
     offered one reads as a broken form. */
  function missing() {
    var m = [];
    if (S.intent === "trade") {
      if (!S.tradeCar) m.push("марка и модел");
      if (!S.tradeYear && !S.tradeKm) m.push("година и пробег");
    } else if (S.intent === "other") {
      if (S.note.trim().length <= 15) m.push("описание на въпроса");
    } else {
      if (!S.make && !S.model && !S.vehicle) m.push("автомобил");
      if (!S.band) m.push("бюджет");
      if (!S.when) m.push("срок");
    }
    if (!reachable()) m.push("телефон");
    return m;
  }

  function briefText() {
    var lines = ["ЗАЯВКА AUTOHAUS · " + ref(), ""];
    rows().forEach(function (r) { lines.push(r[0] + ": " + r[1]); });
    lines.push("", "Подадена през autohaus.bg/concierge");
    return lines.join("\n");
  }

  function subject() {
    var v = S.vehicle ? AH.byId(S.vehicle) : null;
    var what = v ? v.full : [S.make, S.model].filter(Boolean).join(" ");
    return "Заявка " + ref() + (what ? " · " + what : "") +
      (S.band ? " · " + BAND_NAME[S.band] : "") + (S.when ? " · " + S.when : "");
  }

  function renderBrief() {
    var box = D.getElementById("cg-brief");
    box.innerHTML =
      '<div class="brief-head">' +
        "<span><b>" + ref() + "</b></span>" +
        "<span>За " + AH.esc(CFG.expert) + "</span>" +
      "</div><dl>" +
      rows().map(function (r) {
        return "<div><dt>" + AH.esc(r[0]) + "</dt><dd>" + AH.esc(r[1]) + "</dd></div>";
      }).join("") +
      "</dl>" +
      '<p class="brief-note body-s">' +
        (quality() === "full"
          ? "Заявката е пълна и стига до екипа на AutoHaus."
          : "Може да я изпратите и така. Ако добавите " + missing().join(" и ") +
            ", отговорът идва по-бързо и по-точно.") +
      "</p>";
  }

  /* ============================================================
     SUBMIT
     ============================================================ */
  function payload() {
    var v = S.vehicle ? AH.byId(S.vehicle) : null;
    return {
      ref: ref(), sentAt: new Date().toISOString(), quality: quality(),
      intent: S.intent, intentLabel: INTENT_NAME[S.intent] || "",
      vehicle: v ? { id: v.id, ref: v.ref, name: v.full, price: v.price } : null,
      wanted: { make: S.make, model: S.model, body: S.body, cond: S.cond, fuel: S.fuel, must: S.must },
      budget: { band: S.band, bandLabel: BAND_NAME[S.band] || "", pay: S.pay },
      timing: S.when,
      trade: S.tradeCar ? { car: S.tradeCar, year: S.tradeYear, km: S.tradeKm, lease: S.tradeLease, note: S.tradeNote } : null,
      contact: { name: S.name, phone: S.phone, email: S.email, reach: S.reach, note: S.note },
      matchesInStock: matches().length,
      subject: subject(), text: briefText()
    };
  }

  function done(sent) {
    at = steps().length;                          /* past the end — terminal */
    clearSwap();
    curName = "done";
    Object.keys(sections).forEach(function (k) {
      sections[k].classList.remove("is-off");
      sections[k].classList.toggle("is-on", k === "done");
    });
    elRoom.classList.add("is-done");
    elRoom.classList.add("is-live");
    elHatch.hidden = true;
    renderSay("done");
    heard.hidden = true;                  /* the record has served its purpose */

    var p = D.getElementById("cg-done-p"), acts = D.getElementById("cg-done-act");
    D.getElementById("cg-done-h").textContent = sent
      ? "Благодарим. Заявката е при нас."
      : "Готово — остава да я изпратите.";

    if (sent) {
      p.innerHTML = "Номер на заявката: <strong class=\"t-num\">" + ref() + "</strong>. " +
        (quality() === "full"
          ? "Заявката стига до екипа на AutoHaus в Пловдив."
          : "Ще се свържем с вас в рамките на един работен ден.");
      acts.innerHTML =
        '<a class="btn btn--s btn--primary" href="index.html#avtomobili"><span class="btn__label">Обратно към колекцията</span></a>' +
        '<button type="button" class="btn btn--s btn--secondary" id="cg-copy"><span class="btn__label">Копирай заявката</span></button>';
    } else {
      /* No backend configured: hand the finished brief over by whatever the
         device can actually do. The brief itself is identical either way. */
      p.innerHTML = "Заявката е готова и е с номер <strong class=\"t-num\">" + ref() +
        "</strong>. Изберете как да стигне до нас — текстът вече е попълнен.";
      var body = encodeURIComponent(briefText());
      acts.innerHTML =
        '<a class="btn btn--s btn--primary" href="mailto:' + CFG.email + "?subject=" +
          encodeURIComponent(subject()) + "&body=" + body + '"><span class="btn__label">Изпрати по имейл</span></a>' +
        '<a class="btn btn--s btn--secondary" target="_blank" rel="noopener" href="https://wa.me/' +
          CFG.whatsapp + "?text=" + body + '"><span class="btn__label">Изпрати в WhatsApp</span></a>' +
        '<button type="button" class="btn btn--s btn--tertiary" id="cg-copy"><span class="btn__label">Копирай заявката</span></button>';
    }

    var copy = D.getElementById("cg-copy");
    if (copy) copy.addEventListener("click", function () {
      var t = briefText();
      var ok = function () { copy.querySelector(".btn__label").textContent = "Копирано"; };
      if (navigator.clipboard) navigator.clipboard.writeText(t).then(ok, fallback);
      else fallback();
      function fallback() {
        var ta = D.createElement("textarea");
        ta.value = t; ta.style.position = "fixed"; ta.style.opacity = "0";
        D.body.appendChild(ta); ta.select();
        try { D.execCommand("copy"); ok(); } catch (e) {}
        D.body.removeChild(ta);
      }
    });

    try { localStorage.removeItem(KEY); } catch (e) {}
    var h = D.getElementById("cg-done-h");
    h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function submit() {
    if (!validate("contact")) { go(steps().indexOf("contact")); return; }
    if (!CFG.endpoint) { done(false); return; }

    elNext.disabled = true;
    label(elNext, "Изпращане…");
    fetch(CFG.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload())
    }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      done(true);
    }).catch(function () {
      /* A failed POST must never eat a finished brief. Fall through to the
         hand-off screen with everything intact. */
      done(false);
    }).then(function () {
      elNext.disabled = false;
      label(elNext, "Изпрати заявката");
    });
  }

  /* ============================================================
     NAV
     ============================================================ */
  elNext.addEventListener("click", function () {
    var name = current();
    if (name === "review") { submit(); return; }
    if (!validate(name)) return;
    if (name === "intent" && !S.intent) {
      sections.intent.querySelector(".opt").focus();
      return;
    }
    persist();
    go(at + 1);
  });
  elBack.addEventListener("click", function () { go(at - 1); });
  elSkip.addEventListener("click", function () { go(at + 1); });

  /* Enter advances from a text field, the way a conversation would */
  D.getElementById("cg-form").addEventListener("keydown", function (e) {
    if (e.key !== "Enter") return;
    if (e.target.tagName === "TEXTAREA") return;
    if (e.target.tagName === "BUTTON") return;      /* the button does its own job */
    e.preventDefault();
    elNext.click();
  });

  D.getElementById("hatch-wa").href = "https://wa.me/" + CFG.whatsapp;

  /* Resume where they left off — but only for someone genuinely returning to
     a half-finished brief. Arriving from a car page also lands with fields
     filled, and skipping ahead on that basis would jump straight past the
     screen that shows WHICH car was chosen. That screen is the whole point
     of arriving from a car: it is the confirmation, not a formality. */
  var list0 = steps();
  if (cameWithPrefill) {
    at = Math.min(1, list0.length - 1);
  } else if (S.intent) {
    var last = list0.length - 2;
    for (var n0 = 1; n0 < list0.length - 1; n0++) {
      var k0 = list0[n0];
      var filled =
        (k0 === "car" && (S.make || S.model)) ||
        (k0 === "spec" && (S.must.length || S.cond || S.fuel)) ||
        (k0 === "budget" && S.band) ||
        (k0 === "when" && S.when) ||
        (k0 === "trade" && S.tradeCar) ||
        (k0 === "contact" && S.name);
      if (!filled) { last = n0; break; }
    }
    at = Math.min(last, list0.length - 1);
  }
  show(current(), true);
  renderMatch();
})();
