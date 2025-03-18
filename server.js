const express = require("express");
const path = require("path");
const fs = require("fs");
const https = require("https");
const http = require("http");

const app = express();
const HTTP_PORT = 80;
const HTTPS_PORT = 443;

// ✅ Load SSL Certificates
const sslOptions = {
    key: fs.readFileSync(path.join(__dirname, "ssl", "private.key")),
    cert: fs.readFileSync(path.join(__dirname, "ssl", "certificate.crt")),
    ca: fs.readFileSync(path.join(__dirname, "ssl", "ca_bundle.crt")),
};

// ✅ Middleware to parse JSON
app.use(express.json());

// ✅ Middleware to parse URL-encoded data (useful for form submissions)
app.use(express.urlencoded({ extended: true }));

// ✅ Serve Static Files (Frontend)
app.use(express.static(path.join(__dirname, "public")));

// ✅ Serve index.html as the Homepage
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ✅ Serve ZeroSSL Verification File
app.use("/.well-known/pki-validation", express.static(path.join(__dirname, "zerossl")));

// ✅ Load API Routes
const registerRoute = require("./routes/register");
const loginRoute = require("./routes/login");
const dashboardRoute = require("./routes/dashboard");
const logoutRoute = require("./routes/logout");

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


