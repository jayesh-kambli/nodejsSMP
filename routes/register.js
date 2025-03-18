const express = require("express");
const mysql = require("mysql2");
const crypto = require("crypto");
const expressSanitizer = require("express-sanitizer");
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

// ✅ User Registration API
const csurf = require("csurf");
const csrfProtection = csurf({ cookie: true });

router.post("/register", csrfProtection, (req, res) => {
    // const { name, password, ip } = req.body;

    const name = validator.trim(req.sanitize(req.body.name));
    const password = req.sanitize(req.body.password);
    const ip = req.sanitize(req.body.ip);

    if (!name || !password) {
        return res.status(400).json({ success: false, message: "Missing name or password." });
    }

    if (password.length < 8) {
        return res.status(400).json({ success: false, message: "Password must be at least 8 characters long." });
    }

    // ✅ Validate username (Only letters, numbers, and underscores, min 3 chars)
    if (!validator.isAlphanumeric(name, "en-US", { ignore: "_" }) || name.length < 3) {
        return res.status(400).json({ error: "Invalid username. Use only letters, numbers, and underscores." });
    }

    // ✅ Hash the password using SHA-256
    const hashedPassword = crypto.createHash("sha256").update(password).digest("hex");
    const whitelist = 1; // Auto-whitelist new users
    const safeIp = ip || "127.0.0.1";

    // ✅ Check if username already exists
    db.query("SELECT id FROM users WHERE name = ?", [name], (err, results) => {
        if (err) return res.status(500).json({ success: false, message: "Database error", details: err });

        if (results.length > 0) {
            return res.status(400).json({ success: false, message: "Username already taken." });
        }

        // ✅ Insert user into database
        db.query(
            "INSERT INTO users (name, password, ip, whitelist) VALUES (?, ?, ?, ?)",
            [name, hashedPassword, safeIp, whitelist],
            (err) => {
                if (err) {
                    return res.status(500).json({ success: false, message: "Registration failed", details: err });
                }
                res.json({ success: true, message: "Registration successful!" });
            }
        );
    });
});

module.exports = router;
