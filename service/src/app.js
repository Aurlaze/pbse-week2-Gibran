require("dotenv").config();

require('./config');

const { randomUUID } = require("node:crypto");
const express = require("express");

const courtsRouter = require("./routes/courts");
const bookingsRouter = require("./routes/bookings");
const authenticate = require("./auth/authenticate");
const { notFoundHandler, globalErrorHandler } = require("./middleware/error");

// Refuse to start when configuration is missing. Either DATABASE_URL alone,
// or the discrete variables. DB_PASSWORD is excluded because an empty
// password is valid locally.
const REQUIRED_ENV = ["DB_USER", "DB_HOST", "DB_NAME", "DB_PORT"];

if (!process.env.DATABASE_URL) {
  const missing = REQUIRED_ENV.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.error(
      `Refusing to start. Set DATABASE_URL, or these missing variables: ${missing.join(", ")}
` +
        "See service/.env.example for the full list."
    );
    process.exit(1);
  }
}

const app = express();

// One id per request, echoed into every problem response and log line.
app.use((req, res, next) => {
  req.id = req.get("X-Request-Id") || randomUUID();
  res.set("X-Request-Id", req.id);
  next();
});

app.use(express.json());

// Checks no dependency, so a database outage cannot restart every instance.
//
// Served at both paths on purpose. The hosting platform is configured to call
// /health at the root, while openapi.yaml's servers already carry /v1, so the
// operation the contract documents is /v1/health. Registering both keeps the
// platform working and the document honest.
//
// Both sit above app.use(authenticate), so neither ever sees a token. This is
// the one operation with `security: []` on the contract.
app.get(["/health", "/v1/health"], (req, res) =>
  res.status(200).json({ status: "ok" })
);

// Authentication for protected API routes.
app.use(authenticate);

// Mounted under /v1 to match the server URLs in openapi.yaml.
app.use("/v1", courtsRouter);
app.use("/v1", bookingsRouter);

// Registered last, after every route.
app.use(notFoundHandler);
app.use(globalErrorHandler);

module.exports = app;
