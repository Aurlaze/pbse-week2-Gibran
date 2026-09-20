// Brings up the real service against a real database, with a test-only
// signing key standing in for the authorisation server.
//
// Everything below the token is genuine: the same app.js, the same
// middleware chain, the same SQL. Only the issuer is replaced, because a
// test that also had to wait for Keycloak would be testing the container
// orchestration rather than this service's authorisation.

// Loaded here as well as in app.js, because the database check below runs
// before app.js has been required — and it has to, since app.js exits the
// process when the configuration is incomplete.
require("dotenv").config();

const { once } = require("node:events");
const { startJwksServer, tokenFor } = require("./tokens");

const ISSUER = "https://test.local/";
const AUDIENCE = "badminton-api";

// A court of its own, so the fixtures do not depend on seed.sql having been
// run and cannot collide with rows a demonstration left behind.
const TEST_COURT_ID = "crt_authzTest";

function randomId(prefix) {
  return `${prefix}${Math.random().toString(36).slice(2, 10)}`;
}

async function startTestService() {
  if (!process.env.DATABASE_URL && !process.env.DB_HOST) {
    throw new Error(
      "these tests need a database: set DATABASE_URL to a throwaway Postgres, " +
        "never to the shared one"
    );
  }

  // The JWKS server has to exist before app.js is loaded, because verify.js
  // builds its JWKSet once at module level — which is the right thing for it
  // to do, and the reason this ordering matters here.
  const jwks = await startJwksServer(0);

  process.env.OIDC_ISSUER = ISSUER;
  process.env.OIDC_AUDIENCE = AUDIENCE;
  process.env.OIDC_JWKS_URI = jwks.url;
  process.env.LOG_LEVEL = process.env.LOG_LEVEL || "silent";

  const app = require("../../src/app");
  const pool = require("../../src/store/db");

  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}`;

  const createdBookings = [];

  await pool.query(
    `INSERT INTO courts (id, name, location, court_type, is_available, status)
     VALUES ($1, 'Authz Test Court', 'Test Hall', 'indoor', true, 'active')
     ON CONFLICT (id) DO NOTHING`,
    [TEST_COURT_ID]
  );

  // Inserted straight into the table rather than through POST /v1/bookings,
  // so that a test about reading somebody else's booking does not depend on
  // the create path also being correct.
  async function givenBookingOwnedBy(subject, { status = "confirmed" } = {}) {
    const id = randomId("bkg_");
    const start = new Date(Date.now() + 86_400_000);
    const end = new Date(start.getTime() + 3_600_000);

    const { rows } = await pool.query(
      `INSERT INTO bookings
         (id, court_id, start_time, end_time, status, booked_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [id, TEST_COURT_ID, start, end, status, subject]
    );

    createdBookings.push(id);
    return rows[0];
  }

  // Reads the row straight out of the table. A test over a write operation
  // checks two things — the status, and that the data did not move — and the
  // second one cannot be asked through the API, because the API is the thing
  // under test.
  async function readBookingRow(id) {
    const { rows } = await pool.query("SELECT * FROM bookings WHERE id = $1", [id]);
    return rows[0] || null;
  }

  async function request(method, path, { token, body, headers = {} } = {}) {
    const response = await fetch(base + path, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...headers
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {})
    });

    const text = await response.text();
    let parsed = null;

    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = null;
    }

    return {
      status: response.status,
      headers: response.headers,
      text,
      body: parsed
    };
  }

  // Best-effort cleanup of this file's own rows. A failing assertion must
  // not also leave fixtures behind, because the next run would then be
  // testing against a table that grows every time somebody runs the suite.
  //
  // The court is deliberately NOT removed here. Test files run in parallel
  // processes, so deleting a fixture another file is still using turns a
  // passing suite into a foreign-key failure. It is one row, it is created
  // with ON CONFLICT DO NOTHING, and it costs nothing to leave in place.
  async function stop() {
    try {
      if (createdBookings.length > 0) {
        await pool.query("DELETE FROM bookings WHERE id = ANY($1)", [createdBookings]);
      }
    } catch (err) {
      console.error("fixture cleanup failed:", err.message);
    }

    server.close();
    await jwks.close();
    await pool.end();
  }

  return {
    base,
    request,
    givenBookingOwnedBy,
    readBookingRow,
    stop,
    courtId: TEST_COURT_ID
  };
}

// The scopes each actor's client is allowed to request, from the table in
// service/README.md. A test that handed a student bookings:fulfil would be
// proving something about a token the authorisation server would never issue.
const SCOPES = {
  student: ["courts:read", "bookings:read", "bookings:write"],
  admin: ["courts:read", "courts:write", "bookings:read", "bookings:write", "bookings:fulfil"],
  job: ["bookings:read", "bookings:fulfil"]
};

// Stands in for signing in as one of the Step 3g test users.
function signInAs(subject, scopes) {
  return tokenFor(subject, scopes);
}

module.exports = {
  ISSUER,
  AUDIENCE,
  SCOPES,
  startTestService,
  signInAs
};
