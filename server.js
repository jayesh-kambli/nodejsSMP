require("dotenv").config();
const express = require("express");
const path = require("path");
const fs = require("fs");
const https = require("https");
const http = require("http");
const helmet = require("helmet");
const csurf = require("csurf");
const cookieParser = require("cookie-parser");
const mysql = require("mysql2");
const session = require("express-session");
const MySQLStore = require("express-mysql-session")(session);

const app = express();

// ========================
// 1. Database Configuration
// ========================
let db;

async function initializeDatabase() {
    return new Promise((resolve, reject) => {
        db = mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME
        });

        // Handle connection errors
        db.on('error', (err) => {
            if (err.code === 'PROTOCOL_CONNECTION_LOST') {
                console.error('❌ Database connection was lost');
            } else {
                console.error('❌ Database error:', err.message);
            }
            if (err.fatal) reject(err);
        });

        db.connect((err) => {
            if (err) {
                console.error("❌ Initial database connection failed:", err.message);
                return reject(err);
            }
            console.log("✅ Connected to MySQL Database");
            resolve(db);
        });
    });
}

// ========================
// 2. Server Initialization
// ========================
async function startServers() {
    // HTTP Server for redirects
    http.createServer((req, res) => {
        res.writeHead(301, { "Location": `https://${req.headers.host}${req.url}` });
        res.end();
    }).listen(HTTP_PORT, () => {
        console.log(`🚀 HTTP Server running on ${HTTP_PORT}`);
    });

    // HTTPS Server
    https.createServer(sslOptions, app).listen(HTTPS_PORT, () => {
        console.log(`🔒 HTTPS Server running on ${HTTPS_PORT}`);
    });
}

// ========================
// 3. Application Bootstrap
// ========================
const HTTP_PORT = 8000;
const HTTPS_PORT = 8444;

// SSL Configuration
const sslOptions = {
    key: fs.readFileSync(path.normalize(process.env.SSL_KEY_PATH)),
    cert: fs.readFileSync(path.normalize(process.env.SSL_CERT_PATH)),
    ca: fs.readFileSync(path.normalize(process.env.SSL_CA_PATH))
};

(async () => {
    try {
        // 1. First connect to database
        await initializeDatabase();

        // 2. Configure express middleware
        configureExpress();

        // 3. Start servers
        await startServers();

    } catch (err) {
        console.log("🛑 Server will shut down in 3 seconds...");
        setTimeout(() => process.exit(1), 3000);
    }
})();

function configureExpress() {
    // ========================
    // Security Middleware
    // ========================
    app.disable("x-powered-by");

    app.use(helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: [
                    "'self'",
                    "https://cdn.jsdelivr.net",
                    "'unsafe-inline'",
                    "blob:",
                    "https://unpkg.com"
                ],
                connectSrc: [
                    "'self'",
                    "https://www.google-analytics.com",
                    "https://api.ipify.org"
                ]
            }
        }
    }));

    if (process.env.NODE_ENV === "production") {
        const limiter = rateLimit({
            windowMs: 15 * 60 * 1000,
            max: 40,
            message: "Too many requests, please try again later."
        });
        app.use(limiter);
    }

    // ========================
    // Application Middleware
    // ========================
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use(cookieParser());

    // Force HTTPS
    app.use((req, res, next) => {
        if (!req.secure) {
            return res.status(403).json({ error: "HTTPS required" });
        }
        next();
    });

    // CSRF Protection
    const csrfProtection = csurf({ cookie: true });
    app.use(csrfProtection);
    app.get("/csrf-token", (req, res) => {
        res.cookie("XSRF-TOKEN", req.csrfToken(), {
            httpOnly: false,
            secure: true,
            sameSite: "strict"
        });
        res.json({ csrfToken: req.csrfToken() });
    });

    // Session Configuration
    const sessionStore = new MySQLStore({}, db);
    app.use(session({
        secret: process.env.SESSION_SECRET || require("crypto").randomBytes(32).toString("hex"),
        resave: false,
        saveUninitialized: false,
        store: sessionStore,
        cookie: {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            maxAge: 24 * 60 * 60 * 1000,
            domain: process.env.NODE_ENV === "production" ? process.env.DOMAIN : undefined
        }
    }));

    // ========================
    // Routes & Static Assets
    // ========================
    app.use(express.static("public", { index: false }));
    app.use("/.well-known/pki-validation", express.static(path.join(__dirname, "zerossl")));

    // Serve index.html for root path
    app.get("/", (req, res) => {
        res.sendFile(path.join(__dirname, "public", "index.html"));
    });

    // API Routes
    app.use(require("./routes/register"));
    app.use(require("./routes/login"));
    app.use(require("./routes/dashboard"));
    app.use(require("./routes/logout"));

    // Error Handling
    app.use((req, res) => res.status(404).json({ error: "Not Found" }));
    app.use((err, req, res, next) => {
        console.error("❌ Error:", err.message);
        res.status(err.status || 500).json({ error: err.message || "Internal Error" });
    });
}

// ========================
// Process Error Handling
// ========================
process.on("uncaughtException", (err) => {
    console.error("❌ Uncaught Exception:", err);
    setTimeout(() => process.exit(1), 3000);
});

process.on("unhandledRejection", (reason) => {
    console.error("⚠️ Unhandled Rejection:", reason);
    setTimeout(() => process.exit(1), 3000);
});