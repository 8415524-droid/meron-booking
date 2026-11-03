/* יומן iCal של יחידה אחת: https://.../api/ical-feed?s=<סוד>&id=<יחידה>  (ללא פרטי לקוח) */
const SB_URL = "https://nasqvwzvgwvchfjjrygq.supabase.co";
const SB_KEY = require("fs").readFileSync(require("path").join(__dirname, "pbx-callback.js"), "utf8").match(/SB_KEY = "([^"]+)"/)[1];
const d8 = (s) => String(s || "").replace(/-/g, "");
module.exports = async (req, res) => {
  const q = req.query || {};
  const r = await fetch(SB_URL + "/rest/v1/rpc/ical_feed", {
    method: "POST", headers: { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ p_secret: String(q.s || ""), p_id: String(q.id || "") }),
  });
  const rows = r.ok ? await r.json() : null;
  if (!Array.isArray(rows)) { res.status(404).send("not found"); return; }
  const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  const ev = rows.filter((b) => b.in && b.out).map((b) => [
    "BEGIN:VEVENT", "UID:" + b.id + "@meron-booking", "DTSTAMP:" + stamp,
    "DTSTART;VALUE=DATE:" + d8(b.in), "DTEND;VALUE=DATE:" + d8(b.out), "SUMMARY:תפוס", "TRANSP:OPAQUE", "END:VEVENT",
  ].join("\r\n"));
  res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300");
  res.status(200).send(["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//meron-booking//he", "CALSCALE:GREGORIAN", "X-WR-CALNAME:כשר מירון", ...ev, "END:VCALENDAR"].join("\r\n"));
};
