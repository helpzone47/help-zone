require("dotenv").config();
const express = require("express");
const session = require("express-session");
const SQLiteStore = require("connect-sqlite3")(session);
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcryptjs");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === "production";
const dataDir = path.join(__dirname, "data");
fs.mkdirSync(dataDir, { recursive: true });

if (!process.env.SESSION_SECRET || !process.env.ADMIN_SETUP_KEY) {
  console.error("Missing SESSION_SECRET or ADMIN_SETUP_KEY. Copy .env.example to .env and set both.");
  process.exit(1);
}
if (isProduction && (!process.env.APP_ORIGIN || process.env.APP_ORIGIN.includes("localhost"))) {
  console.error("Set APP_ORIGIN to your deployed HTTPS website URL in production.");
  process.exit(1);
}

const db = new sqlite3.Database(path.join(dataDir, "help-zone.sqlite"));
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    contact TEXT NOT NULL,
    topic TEXT NOT NULL,
    body TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'new',
    admin_reply TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    replied_at TEXT
  )`);
});

const run = (sql, params = []) => new Promise((resolve, reject) =>
  db.run(sql, params, function (err) { if (err) reject(err); else resolve(this); }));
const get = (sql, params = []) => new Promise((resolve, reject) =>
  db.get(sql, params, (err, row) => err ? reject(err) : resolve(row)));
const all = (sql, params = []) => new Promise((resolve, reject) =>
  db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows)));

app.disable("x-powered-by");
app.use(helmet({ contentSecurityPolicy: {
  directives: {
    defaultSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'"],
    scriptSrc: ["'self'"], imgSrc: ["'self'", "data:"],
    connectSrc: ["'self'"], objectSrc: ["'none'"], upgradeInsecureRequests: isProduction ? [] : null
  }
}}));
app.use(express.json({ limit: "12kb" }));
app.use(express.urlencoded({ extended: false, limit: "12kb" }));
app.use(session({
  store: new SQLiteStore({ db: "sessions.sqlite", dir: dataDir }),
  secret: process.env.SESSION_SECRET,
  resave: false, saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: "strict", secure: isProduction, maxAge: 8 * 60 * 60 * 1000 }
}));
app.use(express.static(path.join(__dirname, "public")));

const messageLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 8, standardHeaders: "draft-7", legacyHeaders: false });
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 8, standardHeaders: "draft-7", legacyHeaders: false });

// Same-origin check for state-changing browser requests.
app.use((req, res, next) => {
  if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    const origin = req.get("origin");
    if (origin && process.env.APP_ORIGIN && origin !== process.env.APP_ORIGIN) {
      return res.status(403).json({ error: "Request origin not allowed." });
    }
  }
  next();
});

function requireAdmin(req, res, next) {
  if (!req.session.admin) return res.status(401).json({ error: "Please sign in." });
  next();
}

app.get("/api/setup-status", async (_req, res) => {
  const admin = await get("SELECT id FROM admins WHERE id = 1");
  res.json({ setupComplete: !!admin });
});

app.post("/api/setup", loginLimiter, async (req, res) => {
  const { setupKey, password } = req.body || {};
  if (setupKey !== process.env.ADMIN_SETUP_KEY) return res.status(403).json({ error: "Invalid setup key." });
  if (typeof password !== "string" || password.length < 12 || password.length > 200) {
    return res.status(400).json({ error: "Password must be at least 12 characters." });
  }
  const existing = await get("SELECT id FROM admins WHERE id = 1");
  if (existing) return res.status(409).json({ error: "Admin setup is already complete." });
  const hash = await bcrypt.hash(password, 12);
  await run("INSERT INTO admins (id, password_hash) VALUES (1, ?)", [hash]);
  res.json({ ok: true });
});

app.post("/api/login", loginLimiter, async (req, res) => {
  const { password } = req.body || {};
  const admin = await get("SELECT password_hash FROM admins WHERE id = 1");
  if (!admin || typeof password !== "string" || !(await bcrypt.compare(password, admin.password_hash))) {
    return res.status(401).json({ error: "Incorrect password." });
  }
  req.session.admin = true;
  res.json({ ok: true });
});

app.post("/api/logout", requireAdmin, (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get("/api/me", (req, res) => res.json({ admin: !!req.session.admin }));

app.post("/api/messages", messageLimiter, async (req, res) => {
  const { name, contact, topic, body } = req.body || {};
  const clean = (v, max) => typeof v === "string" ? v.trim().slice(0, max) : "";
  const n = clean(name, 80), c = clean(contact, 80), t = clean(topic, 60), b = clean(body, 2000);
  if (!n || !c || !b) return res.status(400).json({ error: "Name, contact and message are required." });
  if (n.length < 2 || c.length < 5 || b.length < 5) return res.status(400).json({ error: "Please enter valid details." });
  await run("INSERT INTO messages (name, contact, topic, body) VALUES (?, ?, ?, ?)", [n, c, t || "General question", b]);
  res.json({ ok: true, message: "Your message has been sent." });
});

app.get("/api/messages", requireAdmin, async (_req, res) => {
  const rows = await all("SELECT * FROM messages ORDER BY id DESC LIMIT 500");
  res.json({ messages: rows });
});

app.post("/api/messages/:id/reply", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const reply = typeof req.body.reply === "string" ? req.body.reply.trim().slice(0, 2000) : "";
  if (!Number.isInteger(id) || id < 1 || reply.length < 1) return res.status(400).json({ error: "Enter a reply." });
  const result = await run("UPDATE messages SET admin_reply = ?, status = 'replied', replied_at = CURRENT_TIMESTAMP WHERE id = ?", [reply, id]);
  if (!result.changes) return res.status(404).json({ error: "Message not found." });
  res.json({ ok: true });
});

app.delete("/api/messages/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: "Invalid message." });
  await run("DELETE FROM messages WHERE id = ?", [id]);
  res.json({ ok: true });
});

app.listen(PORT, () => console.log(`Help Zone running on http://localhost:${PORT}`));
