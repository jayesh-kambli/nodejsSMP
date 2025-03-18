const express = require("express");
const mysql = require("mysql2");
const session = require("express-session");
const fs = require("fs");
const yaml = require("js-yaml");
const MySQLStore = require("express-mysql-session")(session);

const router = express.Router();

// ✅ Define path to `userdata` folder
const DATA_DIR = "C:/Users/Admin/Desktop/New folder/servers/SigmaS8/plugins/Essentials/userdata";

// ✅ MySQL Connection
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
// ✅ Fetch User Dashboard Data
router.post("/dashboard", (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ success: false, message: "User not logged in." });
    }

    const user_id = req.session.user.id;
    const client_ip = req.body.ip || null;
    let ipUpdated = false;

    if (client_ip) {
        db.query("UPDATE users SET ip = ? WHERE id = ?", [client_ip, user_id], (err) => {
            if (!err) ipUpdated = true;
        });
    }

    db.query(
        `SELECT u.name, u.whitelist, u.geyser, uuid.uuid 
         FROM users u 
         LEFT JOIN uuid ON u.name = uuid.name 
         WHERE u.id = ?`,
        [user_id],
        (err, results) => {
            if (err || results.length === 0) {
                return res.status(404).json({ success: false, message: "User not found." });
            }

            const user = results[0];
            res.json({
                success: true,
                name: user.name,
                uuid: user.uuid || 0, // Default to 0 if null
                geyser: user.geyser,
                whitelisted: user.whitelist,
                ip_updated: ipUpdated,
            });
        }
    );
});

// 🛠 API to Update `uuid` Table
router.post("/update-uuid", async (req, res) => {
    try {
        const files = fs.readdirSync(DATA_DIR).filter(file => file.endsWith(".yml"));

        for (const file of files) {
            const filePath = `${DATA_DIR}/${file}`;
            const uuid = file.replace(".yml", "");

            // ✅ Read and parse YAML file
            const ymlData = yaml.load(fs.readFileSync(filePath, "utf8"));

            // ✅ Extract last-account-name
            let name = ymlData["last-account-name"];
            if (!name) {
                console.log(`⚠️ Skipping ${uuid} (no last-account-name found)`);
                continue;
            }

            // ✅ Remove dots from name
            name = name.replace(/\./g, "");

            // ✅ Check if `name` exists in `users` table
            const [userCheck] = await db.promise().query("SELECT 1 FROM users WHERE name = ?", [name]);

            if (userCheck.length === 0) {
                console.log(`⚠️ Skipping ${uuid} (User ${name} not found in users table)`);
                continue; // Skip inserting into `uuid`
            }

            // ✅ Check if UUID exists in `uuid` table
            const [rows] = await db.promise().query("SELECT 1 FROM uuid WHERE uuid = ?", [uuid]);

            if (rows.length === 0) {
                console.log(`🆕 Inserting UUID: ${uuid}, Name: ${name}`);
                await db.promise().query("INSERT INTO uuid (name, uuid) VALUES (?, ?)", [name, uuid]);
            } else {
                console.log(`✅ UUID already exists: ${uuid}, skipping...`);
            }
        }

        res.json({ message: "UUID database updated successfully!" });

    } catch (err) {
        console.error("❌ Error:", err);
        res.status(500).json({ error: "Internal Server Error", details: err.message });
    }
});

// 🛠 API to Get Player Data
router.post("/getData", async (req, res) => {
    const { uuid } = req.body;
    if (!uuid) {
        return res.status(400).json({ error: "Missing required parameter: uuid" });
    }

    const filePath = `${DATA_DIR}/${uuid}.yml`;

    try {
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: "Player data not found" });
        }

        const ymlData = yaml.load(fs.readFileSync(filePath, "utf8"));
        res.json({ message: "Player data retrieved successfully!", data: ymlData });

    } catch (err) {
        console.error("❌ Error reading YAML file:", err);
        res.status(500).json({ error: "Internal Server Error", details: err.message });
    }
});


module.exports = router;
