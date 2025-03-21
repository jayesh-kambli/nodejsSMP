require("dotenv").config();
const express = require("express");
const mysql = require("mysql2");
const session = require("express-session");
const crypto = require("crypto");

const MySQLStore = require("express-mysql-session")(session);

const router = express.Router();
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


// ✅ User Logout API
router.post("/logout", (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ success: false, message: "No active session" });
    }

    const user_id = req.session.user.id;

    db.query("UPDATE users SET ip = '0.0.0.0' WHERE id = ?", [user_id], (err) => {
        if (err) {
            return res.status(500).json({ success: false, message: "Database error", details: err });
        }

        req.session.destroy((err) => {
            if (err) {
                return res.status(500).json({ success: false, message: "Logout failed." });
            }
            res.json({ success: true, message: "Logged out and IP reset" });
        });
    });
});

module.exports = router;
