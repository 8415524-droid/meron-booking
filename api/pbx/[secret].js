/* מרכזיית כשר מירון, Module API של טכנוליין. המרכזייה קוראת לכתובת הזו (GET) בכל שלב בשיחה,
   והפונקציה מחזירה JSON שמורה לה מה לעשות. אין מצב בשרת: כל מצב עובר בפרמטרים של השיחה.
   כתובת להזנה בטכנוליין: https://<הדומיין>/api/pbx/<הסוד שבמסך "מרכזיה">
   חשוב: תשובה לא תקינה מחזירה את המתקשר לתפריט הקודם, ולכן תמיד מחזירים JSON תקין. */
const SB_URL = "https://nasqvwzvgwvchfjjrygq.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5hc3F2d3p2Z3d2Y2hmampyeWdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM1NjI0NjAsImV4cCI6MjEwOTEzODQ2MH0.1zSQ_sM5cDUw38BcnxanYrfsak1UdEBDaayaDs2Hw2I";
const FALLBACK_SERVICE = "0548415524";

function say(text) { return { type: "simpleMessage", files: [{ text }] }; }
function route(name, phone, display) {
  return { type: "simpleRouting", name, dialPhone: String(phone).replace(/\D/g, ""), displayNumber: display || "", routingMusic: "yes", ringSec: 30 };
}
function normPhone(p) {
  let d = String(p || "").replace(/\D/g, "");
  if (d.startsWith("972")) d = "0" + d.slice(3);
  return d;
}
function dayMonth(s) { const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(s || ""); return m ? Number(m[2]) + " ב" + ["", "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"][Number(m[1])] : ""; }

async function lookup(secret, phone) {
  const r = await fetch(SB_URL + "/rest/v1/rpc/pbx_lookup", {
    method: "POST",
    headers: { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ p_secret: secret, p_phone: phone }),
  });
  if (!r.ok) throw new Error("lookup " + r.status);
  return r.json();
}

function placeName(m) { return (m.house || "") + (m.unit ? " " + m.unit : ""); }

/* מי הם הנכסים שמציעים ללקוח: הזמנות פעילות (כניסה עתידית או שוהים עכשיו). אם אין, ההזמנה האחרונה. */
function candidates(matches) {
  const active = matches.filter((m) => m.active);
  const pool = active.length ? active : matches.slice(0, 1);
  const seen = new Set(), out = [];
  for (const m of pool) { const k = m.house + "|" + m.unit; if (!seen.has(k)) { seen.add(k); out.push(m); } }
  return out;
}

function toHost(m, service) {
  const phone = normPhone(m.host_phone);
  if (phone.length < 9) return [say("לא נמצא מספר מארח להזמנה שלך. מעביר אותך לשירות לקוחות."), route("route2", service)];
  return [say("מחבר אותך למארח של " + placeName(m) + ". אנא המתן."), route("route2", phone)];
}

module.exports = async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  const q = req.query || {};
  const send = (o) => res.status(200).send(JSON.stringify(o));
  try {
    // סיום שיחה או חזרה מניתוב: מנתקים
    if (q.PBXcallStatus === "HANGUP" || q.route1 !== undefined || q.route2 !== undefined) return send({ type: "hangup" });

    const caller = normPhone(q.PBXphone);
    if (q.main === undefined || q.main === "ERROR") {
      return send({
        type: "simpleMenu", name: "main", times: 2, timeout: 6, enabledKeys: "12",
        files: [{ text: "ברוכים הבאים לכשר מירון. להזמנות ולשירות לקוחות הקישו 1. ללקוח קיים, לשיחה ישירה עם המארח שלכם, הקישו 2." }],
      });
    }

    let data = null;
    if (q.main === "1" || q.main === "2") {
      try { data = await lookup(String(q.secret || ""), caller); } catch (e) { data = null; }
    }
    if (q.main === "1") {
      const service = normPhone(data && data.service) || FALLBACK_SERVICE;
      return send([say("מעביר אותך להזמנות ולשירות לקוחות. אנא המתן."), route("route1", service)]);
    }
    if (q.main === "2") {
      const service = normPhone(data && data.service) || FALLBACK_SERVICE;
      if (!data) return send([say("אירעה תקלה בזיהוי. מעביר אותך לשירות לקוחות."), route("route1", service)]);
      const list = candidates(data.matches || []);
      if (!list.length) return send([say("לא נמצאה הזמנה על מספר הטלפון שממנו התקשרת. מעביר אותך לשירות לקוחות."), route("route1", service)]);
      if (list.length === 1) return send(toHost(list[0], service));
      if (q.pick === undefined || q.pick === "ERROR") {
        const lines = list.slice(0, 9).map((m, i) => "ל" + placeName(m) + (m.in_d ? ", כניסה ב" + dayMonth(m.in_d) : "") + " הקישו " + (i + 1)).join(". ");
        return send({ type: "simpleMenu", name: "pick", times: 2, timeout: 7, enabledKeys: list.slice(0, 9).map((_, i) => i + 1).join(""), files: [{ text: "נמצאו מספר הזמנות. " + lines }] });
      }
      const idx = Number(q.pick) - 1;
      const chosen = list[idx];
      if (!chosen) return send([say("הבחירה לא תקינה. מעביר אותך לשירות לקוחות."), route("route1", service)]);
      return send(toHost(chosen, service));
    }
    return send({ type: "hangup" });
  } catch (e) {
    return send([say("אירעה תקלה. מעביר אותך לשירות לקוחות."), route("route1", FALLBACK_SERVICE)]);
  }
};
