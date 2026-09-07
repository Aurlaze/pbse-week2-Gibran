// Load configuration before anything reads process.env (A.10).
require("dotenv").config();

const { randomUUID } = require("node:crypto");
const express = require("express");

const courtsRouter = require("./routes/courts");
const bookingsRouter = require("./routes/bookings");
const { notFoundHandler, globalErrorHandler } = require("./middleware/error");


// Configuration check (A.10.3)

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


// Request identifier (A.6.3)
app.use((req, res, next) => {
  req.id = req.get("X-Request-Id") || randomUUID();
  res.set("X-Request-Id", req.id);
  next();
});

app.use(express.json());


// Liveness (A.10.4)
app.get("/health", (req, res) => res.status(200).json({ status: "ok" }));


// Routes
app.use("/v1", courtsRouter);
app.use("/v1", bookingsRouter);


// Failures, registered last, after every route.
app.use(notFoundHandler);
app.use(globalErrorHandler);

module.exports = app;
