/* Vercel serverless function: sends AutoHaus enquiries via Resend.
   Public forms use an invisible short-lived HMAC challenge. There is no
   CAPTCHA or extra normal-user step, but direct bot POSTs cannot trigger the
   mail provider without first completing the same-origin browser flow. */

const crypto = require("crypto");

const DESTINATION = "autohaussale@gmail.com";
const MAX_BODY_BYTES = 24 * 1024;
const MAX_MESSAGE = 4000;
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 6;
const CHALLENGE_MAX_PER_WINDOW = 36;
const CHALLENGE_MAX_AGE = 15 * 60 * 1000;
const CHALLENGE_MIN_AGE = 350;
const DUPLICATE_WINDOW = 90 * 1000;
const buckets = globalThis.__autoHouseInquiryRate || (globalThis.__autoHouseInquiryRate = new Map());
const challengeBuckets = globalThis.__autoHouseInquiryChallengeRate || (globalThis.__autoHouseInquiryChallengeRate = new Map());
const duplicates = globalThis.__autoHouseInquiryDuplicates || (globalThis.__autoHouseInquiryDuplicates = new Map());

function json(res, status, body) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
  return res.status(status).json(body);
}

function clean(value, max) {
  return String(value == null ? "" : value)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim().slice(0, max || 500);
}

function cleanSubject(value) {
  return clean(value, 180).replace(/[\r\n]+/g, " ");
}

function validEmail(value) {
  return !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function escapeHtml(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function clientIp(req) {
  return clean((req.headers["x-forwarded-for"] || req.headers["x-real-ip"] || "unknown").split(",")[0], 80) || "unknown";
}

function expectedOrigin(req) {
  const proto = String(req.headers["x-forwarded-proto"] || "https").split(",")[0].trim() || "https";
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0].trim();
  return host ? proto + "://" + host : "";
}

function sameOrigin(req) {
  const fetchSite = String(req.headers["sec-fetch-site"] || "").toLowerCase();
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") return false;
  const expected = expectedOrigin(req);
  if (!expected) return false;
  const source = String(req.headers.origin || req.headers.referer || "");
  if (!source) return fetchSite === "same-origin";
  try { return new URL(source).origin === expected; }
  catch (_) { return false; }
}

function windowLimited(map, req, max) {
  const now = Date.now();
  const ip = clientIp(req);
  let item = map.get(ip);
  if (!item || now - item.started > WINDOW_MS) item = { started: now, count: 0 };
  item.count += 1;
  map.set(ip, item);
  if (map.size > 750) {
    for (const [key, value] of map) if (now - value.started > WINDOW_MS) map.delete(key);
  }
  return item.count > max;
}

function rateLimited(req) {
  return windowLimited(buckets, req, MAX_PER_WINDOW);
}

function challengeLimited(req) {
  return windowLimited(challengeBuckets, req, CHALLENGE_MAX_PER_WINDOW);
}

function challengeSecret() {
  return String(process.env.INQUIRY_CHALLENGE_SECRET || process.env.RESEND_API_KEY || "").trim();
}

function uaDigest(req) {
  return crypto.createHash("sha256").update(clean(req.headers["user-agent"] || "", 500)).digest("base64url").slice(0, 18);
}

function signChallengePart(part, secret) {
  return crypto.createHmac("sha256", secret).update(part).digest("base64url");
}

function issueChallenge(req) {
  const secret = challengeSecret();
  if (!secret) return "";
  const payload = Buffer.from(JSON.stringify({
    t: Date.now(),
    n: crypto.randomBytes(12).toString("base64url"),
    u: uaDigest(req),
    h: crypto.createHash("sha256").update(expectedOrigin(req)).digest("base64url").slice(0, 12)
  }), "utf8").toString("base64url");
  return payload + "." + signChallengePart(payload, secret);
}

function validChallenge(req, token) {
  const secret = challengeSecret();
  const value = clean(token, 2000);
  if (!secret || !value) return false;
  const dot = value.lastIndexOf(".");
  if (dot < 1) return false;
  const part = value.slice(0, dot);
  const supplied = value.slice(dot + 1);
  const expected = signChallengePart(part, secret);
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  try {
    const data = JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
    const age = Date.now() - Number(data.t || 0);
    const hostDigest = crypto.createHash("sha256").update(expectedOrigin(req)).digest("base64url").slice(0, 12);
    return age >= CHALLENGE_MIN_AGE && age <= CHALLENGE_MAX_AGE &&
      data.u === uaDigest(req) && data.h === hostDigest && typeof data.n === "string" && data.n.length >= 8;
  } catch (_) { return false; }
}

function contentTypeIsJson(req) {
  return /^application\/json(?:\s*;|$)/i.test(String(req.headers["content-type"] || ""));
}

function buildVehicle(body, req) {
  const vehicle = body.vehicle || {};
  const contact = body.contact || {};
  const name = clean(contact.name, 120);
  const phone = clean(contact.phone, 60);
  const email = clean(contact.email, 180);
  const message = clean(body.message, MAX_MESSAGE);
  const vehicleName = clean(vehicle.name, 220) || "Автомобил";
  const vehicleId = clean(vehicle.id, 120);
  const ref = clean(vehicle.ref, 80);
  let page = "";
  try {
    const candidate = new URL(clean(body.page, 500));
    if ((candidate.protocol === "https:" || candidate.protocol === "http:") && candidate.origin === expectedOrigin(req)) page = candidate.href;
  } catch (_) {}

  if (!name || !message || (!phone && !email)) {
    return { error: "Name, message and a phone number or email are required." };
  }
  if (!validEmail(email)) return { error: "Invalid email address." };

  const subject = cleanSubject("Запитване · " + vehicleName + (ref ? " · " + ref : ""));
  const lines = [
    "Ново запитване от страницата на автомобил",
    "",
    "Автомобил: " + vehicleName,
    ref ? "Референция: " + ref : "",
    vehicleId ? "ID: " + vehicleId : "",
    "",
    "Име: " + name,
    phone ? "Телефон: " + phone : "",
    email ? "Имейл: " + email : "",
    "",
    "Запитване:",
    message,
    page ? "\nСтраница: " + page : ""
  ].filter(Boolean);

  const html =
    "<h2>Ново запитване за автомобил</h2>" +
    "<p><strong>Автомобил:</strong> " + escapeHtml(vehicleName) + "</p>" +
    (ref ? "<p><strong>Референция:</strong> " + escapeHtml(ref) + "</p>" : "") +
    "<p><strong>Име:</strong> " + escapeHtml(name) + "<br>" +
    (phone ? "<strong>Телефон:</strong> " + escapeHtml(phone) + "<br>" : "") +
    (email ? "<strong>Имейл:</strong> " + escapeHtml(email) : "") + "</p>" +
    "<p><strong>Запитване:</strong></p><p>" + escapeHtml(message).replace(/\n/g, "<br>") + "</p>" +
    (page ? '<p><a href="' + escapeHtml(page) + '">Отвори страницата на автомобила</a></p>' : "");

  return { subject, text: lines.join("\n"), html, replyTo: email || undefined, fingerprint: [vehicleId, name, phone, email, message].join("|") };
}

function buildConcierge(body) {
  const contact = body.contact || {};
  const email = clean(contact.email, 180);
  if (!validEmail(email)) return { error: "Invalid email address." };
  const rawText = clean(body.text, 12000);
  if (!rawText) return { error: "Empty enquiry." };
  const subject = cleanSubject(body.subject || "AutoHaus — запитване");
  return {
    subject,
    text: rawText,
    html: "<pre style=\"white-space:pre-wrap;font:14px/1.5 Arial,sans-serif\">" + escapeHtml(rawText) + "</pre>",
    replyTo: email || undefined,
    fingerprint: [email, subject, rawText].join("|")
  };
}

function duplicateRequest(req, fingerprint) {
  const now = Date.now();
  const key = crypto.createHash("sha256").update(clientIp(req) + "|" + clean(fingerprint, 14000)).digest("base64url");
  const previous = duplicates.get(key) || 0;
  duplicates.set(key, now);
  if (duplicates.size > 750) for (const [k, timestamp] of duplicates) if (now - timestamp > DUPLICATE_WINDOW) duplicates.delete(k);
  return previous && now - previous < DUPLICATE_WINDOW;
}

module.exports = async function handler(req, res) {
  const wantsChallenge = req.method === "GET" && clean((req.query && req.query.challenge) || "", 8) === "1";
  if (wantsChallenge) {
    if (!sameOrigin(req)) return json(res, 403, { ok: false, error: "Origin not allowed" });
    if (challengeLimited(req)) {
      res.setHeader("Retry-After", "60");
      return json(res, 429, { ok: false, error: "Too many requests" });
    }
    const token = issueChallenge(req);
    if (!token) return json(res, 503, { ok: false, error: "Enquiry protection is unavailable" });
    return json(res, 200, { ok: true, challenge: token, expires_in: Math.floor(CHALLENGE_MAX_AGE / 1000) });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return json(res, 405, { ok: false, error: "Method not allowed" });
  }
  if (!sameOrigin(req)) return json(res, 403, { ok: false, error: "Origin not allowed" });
  if (!contentTypeIsJson(req)) return json(res, 415, { ok: false, error: "JSON request required" });

  const length = Number(req.headers["content-length"] || 0);
  if (!Number.isFinite(length) || length < 0 || length > MAX_BODY_BYTES) return json(res, 413, { ok: false, error: "Request too large" });

  const body = req.body && typeof req.body === "object" ? req.body : {};
  if (Buffer.byteLength(JSON.stringify(body), "utf8") > MAX_BODY_BYTES) return json(res, 413, { ok: false, error: "Request too large" });
  if (clean(body.website, 200)) return json(res, 200, { ok: true });
  if (!validChallenge(req, body.challenge)) return json(res, 403, { ok: false, error: "Please reload the page and try again.", code: "INVALID_CHALLENGE" });

  /* Invalid cross-site/direct bot traffic never consumes the small quota used
     by real enquiries. The user-facing throttle starts only after the signed,
     same-origin challenge has passed. */
  if (rateLimited(req)) {
    res.setHeader("Retry-After", String(Math.ceil(WINDOW_MS / 1000)));
    return json(res, 429, { ok: false, error: "Too many requests. Please try again later." });
  }

  const built = body.kind === "vehicle" ? buildVehicle(body, req) : buildConcierge(body);
  if (built.error) return json(res, 400, { ok: false, error: built.error });
  if (duplicateRequest(req, built.fingerprint || built.text)) return json(res, 200, { ok: true, duplicate: true });

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) {
    console.error("Inquiry email is not configured: RESEND_API_KEY / RESEND_FROM_EMAIL missing");
    return json(res, 503, { ok: false, error: "Email service is not configured" });
  }

  try {
    const payload = {
      from,
      to: [DESTINATION],
      subject: built.subject,
      text: built.text,
      html: built.html
    };
    if (built.replyTo) payload.reply_to = built.replyTo;

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000)
    });

    if (!response.ok) {
      await response.text().catch(() => "");
      console.error("Inquiry provider rejected request", response.status);
      return json(res, 502, { ok: false, error: "Email provider rejected the request" });
    }

    return json(res, 200, { ok: true });
  } catch (err) {
    console.error("Inquiry delivery failed", err && err.name || "error");
    return json(res, 502, { ok: false, error: "Email delivery failed" });
  }
};
