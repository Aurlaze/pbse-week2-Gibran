require("dotenv").config();

const { Pool } = require("pg");

// Managed providers hand out one connection string; local development uses
// the discrete variables in .env.example.
const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      // Hosted Postgres requires TLS, and its certificate is usually issued by
      // a private CA the container does not trust.
      ssl: process.env.DATABASE_URL.includes("localhost")
        ? false
        : { rejectUnauthorized: false },
      // Each serverless instance keeps its own pool, so keep them small and
      // let Neon's pooler endpoint do the multiplexing.
      max: process.env.VERCEL ? 1 : 10
    })
  : new Pool({
      user: process.env.DB_USER,
      host: process.env.DB_HOST,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT,
      password: process.env.DB_PASSWORD
    });

module.exports = pool;
