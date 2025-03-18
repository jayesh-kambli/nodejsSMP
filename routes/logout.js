const express = require("express");
const mysql = require("mysql2");
const session = require("express-session");

const router = express.Router();

// ✅ MySQL Connection
const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "", // Change if needed
    database: "user_data",
});

// ✅ Setup Express Sessions
router.use(
    session({
        secret: "sigma_secret",
        resave: false,
        saveUninitialized: true,
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
