
require("dotenv").config();

const express = require("express");
const session = require("express-session");
const pgSession = require("connect-pg-simple")(session);
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === "production";

if (!process.env.DATABASE_URL || !process.env.SESSION_SECRET || !process.env.ADMIN_SETUP_KEY) {
  console.error("Missing required environment variables.");
  process.exit(1);
}

if (isProduction && process.env.APP_ORIGIN !== "https://help-zone-1.onrender.com") {
  console.error("Invalid APP_ORIGIN.");
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,
  connectionTimeoutMillis: 15000
});

async function initializeDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      contact TEXT NOT NULL,
      topic TEXT NOT NULL,
      body TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'new',
      admin_reply TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      replied_at TIMESTAMPTZ
    )
  `);

  await pool.query(`
    ALTER TABLE messages
    ADD COLUMN IF NOT EXISTS tracking_code TEXT
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS messages_tracking_code_unique
    ON messages (tracking_code)
    WHERE tracking_code IS NOT NULL
  `);
}

app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: isProduction ? [] : null
    }
  }
}));

app.use(express.json({ limit: "12kb" }));
app.use(express.urlencoded({ extended: false, limit: "12kb" }));

app.use(session({
  store: new pgSession({
    pool,
    tableName: "user_sessions",
    createTableIfMissing: true
  }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "strict",
    secure: isProduction,
    maxAge: 8 * 60 * 60 * 1000
  }
}));

app.use(express.static(path.join(__dirname, "public")));

const messageLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: "draft-7",
  legacyHeaders: false
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: "draft-7",
  legacyHeaders: false
});

app.use((req, res, next) => {
  if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    const origin = req.get("origin");
    if (origin && process.env.APP_ORIGIN && origin !== process.env.APP_ORIGIN) {
      return res.status(403).json({ error: "Request origin not allowed." });
    }
  }
  next();
});

function asyncHandler(fn) {
  return (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);
}

function requireAdmin(req, res, next) {
  if (!req.session.admin) {
    return res.status(401).json({ error: "Please sign in." });
  }
  next();
}

app.get("/api/setup-status", asyncHandler(async (_req, res) => {
  const result = await pool.query("SELECT id FROM admins WHERE id = 1");
  res.json({ setupComplete: result.rowCount > 0 });
}));

app.post("/api/setup", loginLimiter, asyncHandler(async (req, res) => {
  const { setupKey, password } = req.body || {};

  if (setupKey !== process.env.ADMIN_SETUP_KEY) {
    return res.status(403).json({ error: "Invalid setup key." });
  }

  if (typeof password !== "string" || password.length < 12 || password.length > 200) {
    return res.status(400).json({ error: "Password must be at least 12 characters." });
  }

  const existing = await pool.query("SELECT id FROM admins WHERE id = 1");
  if (existing.rowCount > 0) {
    return res.status(409).json({ error: "Admin setup is already complete." });
  }

  const hash = await bcrypt.hash(password, 12);
  const inserted = await pool.query(
    "INSERT INTO admins (id, password_hash) VALUES (1, $1) ON CONFLICT (id) DO NOTHING RETURNING id",
    [hash]
  );

  if (inserted.rowCount === 0) {
    return res.status(409).json({ error: "Admin setup is already complete." });
  }

  res.json({ ok: true });
}));

app.post("/api/login", loginLimiter, asyncHandler(async (req, res) => {
  const { password } = req.body || {};
  const result = await pool.query("SELECT password_hash FROM admins WHERE id = 1");
  const admin = result.rows[0];

  if (!admin || typeof password !== "string" ||
      !(await bcrypt.compare(password, admin.password_hash))) {
    return res.status(401).json({ error: "Incorrect password." });
  }

  req.session.admin = true;
  req.session.save((err) => {
    if (err) {
      console.error("Session save error:", err);
      return res.status(500).json({ error: "Session save failed." });
    }
    res.json({ ok: true });
  });
}));

app.post("/api/logout", requireAdmin, (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: "Logout failed." });
    res.clearCookie("connect.sid");
    res.json({ ok: true });
  });
});

app.get("/api/me", (req, res) => {
  res.json({ admin: !!req.session.admin });
});

// Customer sends a message and receives a Tracking Code
app.post("/api/messages", messageLimiter, asyncHandler(async (req, res) => {
  const { name, contact, topic, body } = req.body || {};
  const clean = (v, max) => typeof v === "string" ? v.trim().slice(0, max) : "";

  const n = clean(name, 80);
  const c = clean(contact, 80);
  const t = clean(topic, 60);
  const b = clean(body, 2000);

  if (!n || !c || !b) {
    return res.status(400).json({ error: "Name, contact and message are required." });
  }

  if (n.length < 2 || c.length < 5 || b.length < 5) {
    return res.status(400).json({ error: "Please enter valid details." });
  }

  const trackingCode = crypto.randomBytes(16).toString("hex");

  await pool.query(
    `INSERT INTO messages
     (name, contact, topic, body, tracking_code)
     VALUES ($1, $2, $3, $4, $5)`,
    [n, c, t || "General question", b, trackingCode]
  );

  res.json({
    ok: true,
    message: "Your message has been sent.",
    trackingCode
  });
}));

// Customer checks the admin reply using Tracking Code
app.get("/api/messages/track/:code", asyncHandler(async (req, res) => {
  const code = typeof req.params.code === "string"
    ? req.params.code.trim()
    : "";

  if (!/^[a-f0-9]{32}$/i.test(code)) {
    return res.status(400).json({ error: "Invalid Tracking Code." });
  }

  const result = await pool.query(
    `SELECT admin_reply, status
     FROM messages
     WHERE tracking_code = $1
     LIMIT 1`,
    [code]
  );

  if (result.rowCount === 0) {
    return res.status(404).json({ error: "মেসেজ পাওয়া যায়নি। Tracking Code পরীক্ষা করুন।" });
  }

  res.json({
    ok: true,
    reply: result.rows[0].admin_reply,
    status: result.rows[0].status
  });
}));

app.get("/api/messages", requireAdmin, asyncHandler(async (_req, res) => {
  const result = await pool.query(
    "SELECT * FROM messages ORDER BY id DESC LIMIT 500"
  );
  res.json({ messages: result.rows });
}));

app.post("/api/messages/:id/reply", requireAdmin, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const reply = typeof req.body.reply === "string"
    ? req.body.reply.trim().slice(0, 2000) : "";

  if (!Number.isInteger(id) || id < 1 || !reply) {
    return res.status(400).json({ error: "Enter a reply." });
  }

  const result = await pool.query(
    "UPDATE messages SET admin_reply = $1, status = 'replied', replied_at = CURRENT_TIMESTAMP WHERE id = $2",
    [reply, id]
  );

  if (result.rowCount === 0) {
    return res.status(404).json({ error: "Message not found." });
  }

  res.json({ ok: true });
}));

app.delete("/api/messages/:id", requireAdmin, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ error: "Invalid message." });
  }

  await pool.query("DELETE FROM messages WHERE id = $1", [id]);
  res.json({ ok: true });
}));

app.use((err, req, res, next) => {
  console.error("Request error:", err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: "Internal server error." });
});

async function start() {
  try {
    await pool.query("SELECT 1");
    await initializeDatabase();
    app.listen(PORT, () => console.log("Help Zone server running on port " + PORT));
  } catch (error) {
    console.error("Database startup failed:", error);
    process.exit(1);
  }
}

start();
