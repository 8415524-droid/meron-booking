/* קורא יומן iCal חיצוני (כתובת https) ומחזיר טווחי תאריכים תפוסים. למשתמש מחובר בלבד. */
const SB_URL = "https://nasqvwzvgwvchfjjrygq.supabase.co";
const SB_KEY = require("fs").readFileSync(require("path").join(__dirname, "pbx-callback.js"), "utf8").match(/SB_KEY = "([^"]+)"/)[1];
const iso = (v) => { const m = String(v).match(/(\d{4})(\d{2})(\d{2})/); return m ? m[1] + "-" + m[2] + "-" + m[3] : null; };
function addDay(s, n) { const d = new Date(s + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
function parse(text) {
  const lines = String(text).replace(/\r/g, "").replace(/\n[ \t]/g, "").split("\n");
  const out = []; let ev = null;
  for (const l of lines) {
    if (l === "BEGIN:VEVENT") ev = {};
    else if (l === "END:VEVENT") {
      if (ev && ev.s && !/CANCELLED/i.test(ev.st || "")) {
        let e = ev.e || addDay(ev.s, 1); if (e <= ev.s) e = addDay(ev.s, 1);
        out.push({ in: ev.s, out: e });
      }
      ev = null;
    } else if (ev) {
      const k = l.split(":")[0].split(";")[0].toUpperCase(), v = l.slice(l.indexOf(":") + 1);
      if (k === "DTSTART") ev.s = iso(v); else if (k === "DTEND") ev.e = iso(v); else if (k === "STATUS") ev.st = v;
    }
  }
  return out;
}
function blocked(host) {
  return /^(localhost|.*\.local|.*\.internal)$/i.test(host) || /^\d+\.\d+\.\d+\.\d+$/.test(host) || host.includes(":") || !host.includes(".");
}
module.exports = async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  const out = (c, o) => res.status(c).send(JSON.stringify(o));
  if (req.method !== "POST") return out(405, { ok: false, error: "POST בלבד" });
  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return out(401, { ok: false, error: "נדרשת התחברות" });
  const who = await fetch(SB_URL + "/auth/v1/user", { headers: { apikey: SB_KEY, Authorization: "Bearer " + token } });
  if (!who.ok) return out(401, { ok: false, error: "נדרשת התחברות" });
  let body = req.body; if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  let url; try { url = new URL(String((body && body.url) || "").replace(/^webcal:/i, "https:")); } catch (e) { return out(400, { ok: false, error: "כתובת לא תקינה" }); }
  if (url.protocol !== "https:" || blocked(url.hostname)) return out(400, { ok: false, error: "מותרות כתובות https של יומנים בלבד" });
  try {
    const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 15000);
    const r = await fetch(url.toString(), { signal: ac.signal, redirect: "follow", headers: { "User-Agent": "meron-booking-ical" } });
    clearTimeout(t);
    const txt = (await r.text()).slice(0, 3000000);
    if (!r.ok || !/BEGIN:VCALENDAR/.test(txt)) return out(200, { ok: false, error: "הכתובת לא החזירה יומן iCal (קוד " + r.status + ")" });
    return out(200, { ok: true, ranges: parse(txt) });
  } catch (e) { return out(200, { ok: false, error: "לא ניתן לקרוא את היומן: " + (e.name === "AbortError" ? "תם הזמן" : e.message) }); }
};
