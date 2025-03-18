const express = require("express");
const mysql = require("mysql2");
const crypto = require("crypto");

const router = express.Router();

require("dotenv").config();
// ✅ MySQL Connection
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
});

// ✅ User Registration API
router.post("/register", async (req, res) => {
    const { name, password, ip } = req.body;

    if (!name || !password) {
        return res.status(400).json({ success: false, message: "Missing name or password." });
    }

    if (password.length < 8) {
        return res.status(400).json({ success: false, message: "Password must be at least 8 characters long." });
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
