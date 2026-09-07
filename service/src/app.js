require("dotenv").config();

const { randomUUID } = require("node:crypto");
const express = require("express");

const courtsRouter = require("./routes/courts");
const bookingsRouter = require("./routes/bookings");
const { notFoundHandler, globalErrorHandler } = require("./middleware/error");

// Refuse to start when a required value is missing. DB_PASSWORD is excluded
// because an empty password is valid locally.
const REQUIRED_ENV = ["DB_USER", "DB_HOST", "DB_NAME", "DB_PORT"];

const missing = REQUIRED_ENV.filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.error(
    `Refusing to start. Missing required environment variables: ${missing.join(", ")}
` +
      "See service/.env.example for the full list."
  );
  process.exit(1);
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
app.get("/health", (req, res) => res.status(200).json({ status: "ok" }));

// Mounted under /v1 to match the server URLs in openapi.yaml.
app.use("/v1", courtsRouter);
app.use("/v1", bookingsRouter);

// Registered last, after every route.
app.use(notFoundHandler);
app.use(globalErrorHandler);

module.exports = app;
