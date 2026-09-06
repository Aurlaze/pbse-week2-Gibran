// Load configuration before anything reads process.env (A.10).
require("dotenv").config();

const { randomUUID } = require("node:crypto");
const express = require("express");

const courtsRouter = require("./routes/courts");
const bookingsRouter = require("./routes/bookings");
const { notFoundHandler, globalErrorHandler } = require("./middleware/error");

// ---------------------------------------------------------------------------
// Configuration check (A.10.3)
//
// Refuse to start when a required value is missing. A clear failure in the
// first second is far cheaper to diagnose than a confusing 500 an hour later.
// DB_PASSWORD is absent from this list on purpose: an empty password is
// legitimate for a local trust-auth database.
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Request identifier (A.6.3)
//
// One id per request, echoed into every Problem Details instance member and
// into every log line, so a user's report can be matched to the server log.
// ---------------------------------------------------------------------------
app.use((req, res, next) => {
  req.id = req.get("X-Request-Id") || randomUUID();
  res.set("X-Request-Id", req.id);
  next();
});

app.use(express.json());

// ---------------------------------------------------------------------------
// Liveness (A.10.4)
//
// Checks nothing external, on purpose. If this queried the database, one brief
// outage would make every instance report failure at once and the platform
// would restart all of them, turning a short outage into a long one.
// ---------------------------------------------------------------------------
app.get("/health", (req, res) => res.status(200).json({ status: "ok" }));

// ---------------------------------------------------------------------------
// Routes
//
// ---------------------------------------------------------------------------
app.use(courtsRouter);
app.use(bookingsRouter);

// ---------------------------------------------------------------------------
// Failures, registered last, after every route.
// ---------------------------------------------------------------------------
app.use(notFoundHandler);
app.use(globalErrorHandler);

module.exports = app;
