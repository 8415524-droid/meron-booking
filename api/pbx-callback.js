/* צינתוק ללקוח אחרי סיום הזמנה ואישור מקדמה. נקרא מהאתר על ידי נציג או מנהל מחוברים.
   ההרשאה נבדקת במסד הנתונים (pbx_callback_info מחזירה כלום למי שאינו נציג או מנהל).
   ⚠️ makeCall של טכנוליין דורש כתובת IP מאושרת אצלם. פונקציה בוורסל יוצאת מכתובות משתנות,
   ולכן עד שתתאשר כתובת קבועה (ממסר) הקריאה תיכשל ב-403, והכשל יירשם בהזמנה. */
const SB_URL = "https://nasqvwzvgwvchfjjrygq.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5hc3F2d3p2Z3d2Y2hmampyeWdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM1NjI0NjAsImV4cCI6MjEwOTEzODQ2MH0.1zSQ_sM5cDUw38BcnxanYrfsak1UdEBDaayaDs2Hw2I";
const MAKECALL = "https://app.ipsales.co.il/ivrFilesApi.php";

function norm(p) { let d = String(p || "").replace(/\D/g, ""); if (d.startsWith("972")) d = "0" + d.slice(3); return d; }
async function rpc(fn, args, token) {
  const r = await fetch(SB_URL + "/rest/v1/rpc/" + fn, {
    method: "POST", headers: { apikey: SB_KEY, Authorization: "Bearer " + token, "Content-Type": "application/json" }, body: JSON.stringify(args),
  });
  const t = await r.text();
  let j = null; try { j = JSON.parse(t); } catch (e) {}
  return { ok: r.ok, status: r.status, data: j };
}
async function makeCall(phone, cid, callerId) {
  const u = new URL(MAKECALL);
  u.searchParams.set("action", "makeCall"); u.searchParams.set("phone", phone); u.searchParams.set("cid", cid);
  if (callerId) u.searchParams.set("callerId", callerId);
  const r = await fetch(u.toString());
  const t = await r.text();
  let j = null; try { j = JSON.parse(t); } catch (e) {}
  return { http: r.status, json: j, text: t.slice(0, 200) };
}

module.exports = async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  const out = (code, o) => res.status(code).send(JSON.stringify(o));
  if (req.method !== "POST") return out(405, { ok: false, error: "POST בלבד" });
  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  let body = req.body; if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  const booking = body && body.booking;
  if (!token || !booking) return out(400, { ok: false, error: "חסר נתון" });
  const info = await rpc("pbx_callback_info", { p_booking: String(booking) }, token);
  if (!info.ok || !info.data) return out(403, { ok: false, error: "אין הרשאה או שההזמנה לא נמצאה" });
  const i = info.data;
  if (!i.enabled) return out(200, { ok: false, skipped: "הצינתוק כבוי בהגדרות המרכזייה" });
  if (i.already) return out(200, { ok: false, skipped: "כבר בוצע צינתוק להזמנה הזו" });
  const phone = norm(i.customer_phone), host = norm(i.host_phone);
  if (phone.length < 9) return out(200, { ok: false, error: "אין טלפון תקין ללקוח" });
  if (host.length < 9) return out(200, { ok: false, error: "אין טלפון למארח בנכס" });
  const cid = host.slice(-4);
  let note = "", resp = await makeCall(phone, cid, host);
  const code = resp.json && String(resp.json.errorCode);
  if (resp.json && String(resp.json.status).toLowerCase() === "ok") note = "צינתוק נשלח עם זיהוי המארח";
  else if (code === "5") {
    resp = await makeCall(phone, cid, "");
    note = resp.json && String(resp.json.status).toLowerCase() === "ok" ? "צינתוק נשלח עם זיהוי כללי, המספר של המארח לא מאושר בטכנוליין" : "";
  }
  const ok = !!note;
  if (!ok) note = "כשל בצינתוק: HTTP " + resp.http + (resp.json && resp.json.note ? " · " + resp.json.note : "");
  if (ok) await rpc("pbx_mark_callback", { p_booking: String(booking), p_note: note }, token);
  return out(200, { ok, note });
};
