/* Vercel serverless function: sends AutoHaus enquiries via Resend.
   Required Vercel env vars:
     RESEND_API_KEY
     RESEND_FROM_EMAIL  (a sender on a domain verified in Resend)
   No provider secret is ever exposed to the browser. */

const DESTINATION = "autohousesell@gmail.com";
const MAX_BODY_BYTES = 24 * 1024;
const MAX_MESSAGE = 4000;
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 6;
const buckets = globalThis.__autoHouseInquiryRate || (globalThis.__autoHouseInquiryRate = new Map());

function json(res, status, body) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
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
  return clean((req.headers["x-forwarded-for"] || "unknown").split(",")[0], 80) || "unknown";
}

function rateLimited(req) {
  const now = Date.now();
  const ip = clientIp(req);
  let item = buckets.get(ip);
  if (!item || now - item.started > WINDOW_MS) item = { started: now, count: 0 };
  item.count += 1;
  buckets.set(ip, item);
  if (buckets.size > 500) {
    for (const [key, value] of buckets) if (now - value.started > WINDOW_MS) buckets.delete(key);
  }
  return item.count > MAX_PER_WINDOW;
}

function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    return new URL(origin).host === req.headers.host;
  } catch (_) {
    return false;
  }
}

function buildVehicle(body) {
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
    if (candidate.protocol === "https:" || candidate.protocol === "http:") page = candidate.href;
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

  return { subject, text: lines.join("\n"), html, replyTo: email || undefined };
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
    replyTo: email || undefined
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { ok: false, error: "Method not allowed" });
  }
  if (!sameOrigin(req)) return json(res, 403, { ok: false, error: "Origin not allowed" });

  const length = Number(req.headers["content-length"] || 0);
  if (length > MAX_BODY_BYTES) return json(res, 413, { ok: false, error: "Request too large" });
  if (rateLimited(req)) return json(res, 429, { ok: false, error: "Too many requests. Please try again later." });

  const body = req.body && typeof req.body === "object" ? req.body : {};
  if (Buffer.byteLength(JSON.stringify(body), "utf8") > MAX_BODY_BYTES) return json(res, 413, { ok: false, error: "Request too large" });
  if (clean(body.website, 200)) return json(res, 200, { ok: true });

  const built = body.kind === "vehicle" ? buildVehicle(body) : buildConcierge(body);
  if (built.error) return json(res, 400, { ok: false, error: built.error });

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
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error("Inquiry provider rejected request", response.status);
      return json(res, 502, { ok: false, error: "Email provider rejected the request" });
    }

    return json(res, 200, { ok: true });
  } catch (err) {
    console.error("Inquiry delivery failed", err);
    return json(res, 502, { ok: false, error: "Email delivery failed" });
  }
};
