/* שרת קטן שמחליף את ורסל: מגיש את האתר הסטטי ומריץ את פונקציות ה-API שבתיקיית api כמו שהן
   (אותו req.query / req.body / res.status().send() של ורסל). בלי תלויות חיצוניות. */
const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const ROOT = path.resolve(__dirname, "..");
const PORT = Number(process.env.PORT || 3000);
const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".jpg": "image/jpeg", ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json", ".json": "application/json; charset=utf-8", ".txt": "text/plain; charset=utf-8",
};
// מה שלא מוגש כקובץ סטטי (כמו בוורסל אין קבצי מקור של השרת ברשת)
const BLOCKED = /^\/(deploy|supabase|\.git|\.github|node_modules|api)(\/|$)/;

function handlerFor(pathname) {
  const m = /^\/api\/(.+?)\/?$/.exec(pathname);
  if (!m) return null;
  const parts = m[1].split("/");
  if (parts.some((p) => !p || p === "." || p === ".." || /[\\\0]/.test(p))) return null;
  const direct = path.join(ROOT, "api", ...parts) + ".js";
  if (fs.existsSync(direct)) return { file: direct, params: {} };
  if (parts.length === 2) { // api/<תיקייה>/[param].js
    const dyn = path.join(ROOT, "api", parts[0], "[secret].js");
    if (fs.existsSync(dyn)) return { file: dyn, params: { secret: decodeURIComponent(parts[1]) } };
  }
  return null;
}

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = []; let size = 0;
    req.on("data", (c) => { size += c.length; if (size < 1e6) chunks.push(c); });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", () => resolve(""));
  });
}

async function runApi(h, req, res, url) {
  const query = Object.assign({}, h.params);
  for (const [k, v] of url.searchParams) if (!(k in query)) query[k] = v;
  req.query = query;
  const raw = req.method === "GET" || req.method === "HEAD" ? "" : await readBody(req);
  let body = raw;
  if (/json/i.test(req.headers["content-type"] || "")) { try { body = JSON.parse(raw); } catch (e) { body = {}; } }
  req.body = body;
  res.status = (c) => { res.statusCode = c; return res; };
  res.send = (b) => { res.end(typeof b === "string" || Buffer.isBuffer(b) ? b : JSON.stringify(b)); return res; };
  res.json = (o) => { if (!res.getHeader("Content-Type")) res.setHeader("Content-Type", "application/json; charset=utf-8"); res.end(JSON.stringify(o)); return res; };
  try {
    delete require.cache[require.resolve(h.file)];
    await require(h.file)(req, res);
  } catch (e) {
    console.error("api error", url.pathname, e && e.message);
    if (!res.headersSent) { res.statusCode = 500; res.setHeader("Content-Type", "application/json; charset=utf-8"); }
    if (!res.writableEnded) res.end(JSON.stringify({ ok: false, error: "server error" }));
  }
}

function serveStatic(req, res, pathname) {
  let rel;
  try { rel = decodeURIComponent(pathname); } catch (e) { res.statusCode = 400; return res.end("bad request"); }
  if (rel.endsWith("/")) rel += "index.html";
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT + path.sep) || BLOCKED.test(rel)) { res.statusCode = 404; return res.end("not found"); }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.statusCode = 404; res.setHeader("Content-Type", "text/plain; charset=utf-8"); return res.end("not found"); }
    const ext = path.extname(file).toLowerCase();
    res.setHeader("Content-Type", TYPES[ext] || "application/octet-stream");
    // כמו בוורסל: תמיד לאמת מול השרת, כדי שגרסה חדשה תגיע מיד
    res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
    if (req.method === "HEAD") return res.end();
    fs.createReadStream(file).pipe(res);
  });
}

http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname === "/healthz") { res.setHeader("Content-Type", "text/plain"); return res.end("ok"); }
  const h = handlerFor(url.pathname);
  if (h) return void runApi(h, req, res, url);
  if (req.method !== "GET" && req.method !== "HEAD") { res.statusCode = 405; return res.end("method not allowed"); }
  serveStatic(req, res, url.pathname);
}).listen(PORT, "0.0.0.0", () => console.log("meron-booking listening on " + PORT));
