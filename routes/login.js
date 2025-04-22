const express = require("express");
const bcrypt = require("bcrypt");
const mysql = require("mysql2");
const session = require("express-session");
const MySQLStore = require("express-mysql-session")(session);
const crypto = require("crypto");
const expressSanitizer = require("express-sanitizer");
const rateLimit = require("express-rate-limit");
const validator = require("validator");

const router = express.Router();
router.use(expressSanitizer());

require("dotenv").config();
// ✅ MySQL Connection
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
});


// ✅ Setup Express Sessions
const sessionStore = new MySQLStore({}, db);
router.use(
    session({
        secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex"), // Use a strong secret
        resave: false,
        saveUninitialized: false, // Prevent storing empty sessions
        store: sessionStore, // Use MySQL session store
        cookie: {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production", // Enable only in production
            sameSite: "strict",
            maxAge: 24 * 60 * 60 * 1000, // 1 day
        },
    })
);


if (process.env.NODE_ENV === "production") {
    const loginLimiter = rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 10, // Limit to 5 login attempts per 15 mins per IP
        message: { error: "Too many login attempts, try again later." }
    });
    router.use(loginLimiter);

    // Middleware to log blocked requests
    router.use((req, res, next) => {
        const ip = req.ip || req.connection.remoteAddress;

        // Check if the request was blocked by the rate limiter
        if (req.rateLimit && req.rateLimit.remaining === 0) {
            console.log(`Login Rate limit reached for IP: ${ip}`);
        }

        next();
    });
}

// ✅ User Login API
const csurf = require("csurf");
const csrfProtection = csurf({ cookie: true });

router.post("/login", csrfProtection, (req, res) => {
    // ✅ Sanitize input
    const name = validator.trim(req.sanitize(req.body.name));
    const password = req.sanitize(req.body.password);

    // ✅ Check if inputs are empty
    if (!name || !password) {
        return res.status(400).json({ error: "Missing name or password." });
    }

    // ✅ Validate username (Only letters, numbers, and underscores, min 3 chars)
    if (!validator.isAlphanumeric(name, "en-US", { ignore: "_" }) || name.length < 3) {
        return res.status(400).json({ error: "Invalid username. Use only letters, numbers, and underscores." });
    }

    db.query("SELECT * FROM users WHERE name = ?", [name], async (err, results) => {
        if (err || results.length === 0) {
            return res.status(401).json({ error: "Invalid credentials. (Not Found)" });
        }

        const user = results[0];

        // ✅ Secure password verification (Still using SHA-256, but bcrypt is recommended)
        const enteredHash = crypto.createHash("sha256").update(password).digest("hex");

        if (enteredHash !== user.password) {
            return res.status(401).json({ error: "Invalid credentials (Password Mismatch)" });
        }

        // ✅ Regenerate session for security
        req.session.regenerate((err) => {
            if (err) return res.status(500).json({ error: "Session error." });

            req.session.user = user;
            res.json({ success: true, uuid: user.uuid });
        });
    });
});


module.exports = router;
