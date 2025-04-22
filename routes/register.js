const express = require("express");
const mysql = require("mysql2");
const crypto = require("crypto");
const expressSanitizer = require("express-sanitizer");
const session = require("express-session");
const MySQLStore = require("express-mysql-session")(session);
const validator = require("validator");
const rateLimit = require("express-rate-limit");

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

// ✅ User Registration API
const csurf = require("csurf");
const csrfProtection = csurf({ cookie: true });

if (process.env.NODE_ENV === "production") {
    const Registerimiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 10,
        message: { error: "Too many Register attempts, try again later." }
    });
    router.use(Registerimiter);

    router.use((req, res, next) => {
        const ip = req.ip || req.connection.remoteAddress;
        if (req.rateLimit && req.rateLimit.remaining === 0) {
            console.log(`Register Rate limit reached for IP: ${ip}`);
        }
        next();
    });
}

router.post("/register", csrfProtection, (req, res) => {
    const name = validator.trim(req.sanitize(req.body.name));
    const password = req.sanitize(req.body.password);
    const ip = req.sanitize(req.body.ip);

    if (!name || !password) {
        return res.status(400).json({ success: false, message: "Missing name or password." });
    }

    if (password.length < 8) {
        return res.status(400).json({ success: false, message: "Password must be at least 8 characters long." });
    }

    if (!validator.isAlphanumeric(name, "en-US", { ignore: "_" }) || name.length < 3) {
        return res.status(400).json({ error: "Invalid username. Use only letters, numbers, and underscores." });
    }

    const hashedPassword = crypto.createHash("sha256").update(password).digest("hex");
    const whitelist = 1;
    const safeIp = ip || "127.0.0.1";

    db.query("SELECT id FROM users WHERE name = ?", [name], (err, results) => {
        if (err) return res.status(500).json({ success: false, message: "Database error", details: err });

        if (results.length > 0) {
            return res.status(400).json({ success: false, message: "Username already taken." });
        }

        db.query(
            "INSERT INTO users (name, password, ip, whitelist) VALUES (?, ?, ?, ?)",
            [name, hashedPassword, safeIp, whitelist],
            (err) => {
                if (err) {
                    return res.status(500).json({ success: false, message: "Registration failed", details: err });
                }

                // ✅ Fetch new user and set session
                db.query("SELECT * FROM users WHERE name = ?", [name], (err, results) => {
                    if (err || results.length === 0) {
                        return res.status(500).json({ error: "User lookup failed after registration." });
                    }

                    const user = results[0];

                    req.session.regenerate((err) => {
                        if (err) return res.status(500).json({ error: "Session error." });

                        req.session.user = user;
                        res.json({ success: true, message: "Registration successful!" });
                    });
                });
            }
        );
    });
});

module.exports = router;
