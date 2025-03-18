const express = require("express");
const bcrypt = require("bcrypt");
// const bcrypt = require("bcryptjs");
const mysql = require("mysql2");
const session = require("express-session");
const crypto = require("crypto");

const router = express.Router();

// MySQL Connection
const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "", // Change if needed
    database: "user_data",
});

// ✅ Setup Express Sessions
router.use(
    session({
        secret: "sigma_secret", // Change this to a strong secret
        resave: false,
        saveUninitialized: true,
    })
);

// ✅ User Login API
router.post("/login", (req, res) => {
    const { name, password } = req.body;

    if (!name || !password) {
        return res.status(400).json({ error: "Missing name or password." });
    }

    db.query("SELECT * FROM users WHERE name = ?", [name], async (err, results) => {
        if (err || results.length === 0) {
            return res.status(401).json({ error: "Invalid credentials. (Not Found)" });
        }

        const user = results[0];
        // const passwordMatch = await bcrypt.compare(password, user.password);

        const enteredHash = crypto.createHash("sha256").update(password).digest("hex");

        // console.log("Entered Hash (SHA-256):", enteredHash);
        // console.log("Stored Hash:", user.password);

        if (enteredHash !== user.password) {
            return res.status(401).json({ error: "Invalid credentials (Password Miss Match)" });
        }

        // ✅ Store user session
        req.session.user = user;
        res.json({ success: true, uuid: user.uuid });
    });
});

module.exports = router;
