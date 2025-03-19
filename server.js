require("dotenv").config();
const express = require("express");
const path = require("path");
const fs = require("fs");
const https = require("https");
const http = require("http");
const helmet = require("helmet");
const csurf = require("csurf");
const cookieParser = require("cookie-parser");

const app = express();

// Hide "X-Powered-By" to prevent attackers from identifying the framework
app.disable("x-powered-by");

// ✅ Use Helmet with default settings
app.use(
    helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: [
                    "'self'",
                    "https://cdn.jsdelivr.net",
                    "'unsafe-inline'",
                    "blob:",
                    "https://unpkg.com", // Allow Ionicons
                ],
                connectSrc: [
                    "'self'",
                    "https://www.google-analytics.com",
                    "https://api.ipify.org" // Allow IP fetch
                ]
            }
        }
    })
);

const rateLimit = require("express-rate-limit");


if (process.env.NODE_ENV === "production") {
    const limiter = rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 40, // Limit each IP to 100 requests per 15 mins
        message: "Too many requests, please try again later.",
    });
    app.use(limiter);

    // Middleware to log blocked requests
    app.use((req, res, next) => {
        const ip = req.ip || req.connection.remoteAddress;

        // Check if the request was blocked by the rate limiter
        if (req.rateLimit && req.rateLimit.remaining === 0) {
            console.log(`Rate limit reached for IP: ${ip}`);
        }

        next();
    });
}
app.use(express.static("public", { index: false })); // No automatic `index.html`

const HTTP_PORT = 80;
const HTTPS_PORT = 443;

// ✅ Load SSL Certificates
const sslOptions = {
    key: fs.readFileSync(path.normalize(process.env.SSL_KEY_PATH)),
    cert: fs.readFileSync(path.normalize(process.env.SSL_CERT_PATH)),
    ca: fs.readFileSync(path.normalize(process.env.SSL_CA_PATH)),
};

// ✅ Middleware to parse JSON & Cookies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser()); // Needed for CSRF protection

// ✅ Force HTTPS by rejecting HTTP requests
app.use((req, res, next) => {
    if (!req.secure) {
        return res.status(403).json({ error: "HTTPS required. Please use HTTPS instead of HTTP." });
    }
    next();
});

// ✅ CSRF Middleware (Before Routes)
// ✅ API to Get CSRF Token (Frontend should request this)
const csrfProtection = csurf({ cookie: true });
app.use(csrfProtection);
app.get("/csrf-token", (req, res) => {
    res.cookie("XSRF-TOKEN", req.csrfToken(), { httpOnly: false, secure: true, sameSite: "strict" });
    res.json({ csrfToken: req.csrfToken() });
});

// ✅ Serve Static Files (Frontend)
app.use(express.static(path.join(__dirname, "public")));

// ✅ Serve index.html as the Homepage
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ✅ Secure Session Cookies
const session = require("express-session");
const MySQLStore = require("express-mysql-session")(session);
const mysql = require("mysql2");

const isProduction = process.env.NODE_ENV === "production";

const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
});

const sessionStore = new MySQLStore({}, db);
app.use(
    session({
        secret: process.env.SESSION_SECRET || require("crypto").randomBytes(32).toString("hex"),
        resave: false,
        saveUninitialized: false,
        store: sessionStore,
        cookie: {
            httpOnly: true,
            secure: isProduction, // ✅ Secure only in production
            sameSite: "strict",
            maxAge: 24 * 60 * 60 * 1000,
            domain: isProduction ? process.env.DOMAIN : undefined // ✅ No domain restriction for local testing
        },
    })
);

// ✅ Serve ZeroSSL Verification File
app.use("/.well-known/pki-validation", express.static(path.join(__dirname, "zerossl")));

// ✅ Load API Routes
const registerRoute = require("./routes/register");
const loginRoute = require("./routes/login");
const dashboardRoute = require("./routes/dashboard");
const logoutRoute = require("./routes/logout");

// ✅ Apply Routes (CSRF already applied globally)
app.use(registerRoute);
app.use(loginRoute);
app.use(dashboardRoute);
app.use(logoutRoute);

// ✅ Start HTTP Server (Redirect to HTTPS)
http.createServer((req, res) => {
    res.writeHead(301, { "Location": `https://${req.headers.host}${req.url}` });
    res.end();
}).listen(HTTP_PORT, () => {
    console.log(`🚀 HTTP Server running at http://localhost:${HTTP_PORT} (Redirecting to HTTPS)`);
});

// ✅ Start HTTPS Server
https.createServer(sslOptions, app).listen(HTTPS_PORT, () => {
    console.log(`🔒 HTTPS Server running at https://localhost:${HTTPS_PORT}`);
});
