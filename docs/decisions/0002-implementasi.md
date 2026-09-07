# 0002 — Implementing the contract

Status: accepted
Date: 2026-09-06
Supersedes: nothing. Follows 0001, which chose the contract-first approach.

## Context

Session 2 produced `openapi.yaml` and a Prism mock generated from it. The mock
answers every documented request with an example and stores nothing. Session 3
replaces it with a real service, one operation at a time, without any caller
being told which side is answering.

Three decisions had to be made to do that, and each one is cheap to make now
and expensive to reverse later:

1. Where the service runs, so that it is reachable without a group member's
   laptop being open.
2. Where idempotency keys are kept, because `POST /v1/bookings` is a
   consequential operation and a retry must not create a second booking.
3. Whether to follow the directory structure in the assignment exactly.

There is no authentication in this session. Anything deployed is readable by
anyone who knows the URL, so no personal data goes into the database.

## Decision

### 1. Hosting: Render for the service, Neon for Postgres

Both have a free tier that needs no card, and both are driven from the browser,
so any member can reach the running service without another member's laptop
being open.

They were split rather than taken from one provider because Render's free
Postgres instance is deleted after 30 days, which falls before Session 11 when
A2 is due. Neon's free database has no such expiry, so the data outlives the
course deliverable.

`render.yaml` is committed, so the service can be recreated from a clean
checkout without anyone reconstructing dashboard settings by hand. The only
value set by hand is `DATABASE_URL`, which is a secret and is never committed.
The steps are written out in `docs/deployment.md`.

`db/apply.js` builds the database from empty with `npm run db:setup`. It exists
because `psql` is not installed by default on Windows, and A.7.2 asks that any
member can build the database with a single command on a machine never used for
this before.

### 2. Idempotency keys live in a Postgres table

Keys are stored in `idempotency_keys`, alongside the data they protect, with a
SHA-256 hash of the canonicalised request body and the stored response.

The window in which a retry arrives is precisely the window in which something
has already gone wrong, which is when the process is most likely to have just
restarted. Keeping keys in a `Map` would remove the protection mechanism at
exactly the moment it is needed.

The body hash is stored beside the key because without it, a client that reuses
one key for two genuinely different bookings would silently lose the second.
With it, that case is a `409 idempotency-key-reuse`.

Keys are retained 24 hours, as the contract states, and the window is applied
in the lookup query rather than by a cleanup job.

### 3. Two deviations from the A.1 directory structure

**`src/server.js` is separate from `src/app.js`.** `app.js` assembles the
application and exports it; `server.js` is the only file that calls `listen()`.
This lets a test import the app and bind an ephemeral port without starting the
real server, which is how the failure branches were verified before a database
existed.

**`src/middleware/error.js` holds the global error handler**, rather than it
being written inline in `app.js`. Both handlers there — the unmatched-route
handler and the catch-all — are ordinary Express middleware, and `app.js` still
registers them last. Keeping them in one file keeps `app.js` readable as an
assembly file.

Everything else follows A.1: `openapi.yaml` and `CHANGELOG.md` at the
repository root, `routes/`, `schemas/`, `store/` and `representations/` under
`service/src/`, one `problem.js` for the whole API, and `tests/contract/` at
the root.

## Alternatives considered

**Idempotency keys in a `Map`.** Rejected. One process restart loses every key,
and restarts correlate with exactly the network conditions that cause retries.
It would also have been graded PARTIAL at best.

**A unique constraint on `(court_id, start_time, end_time)` instead of an
explicit overlap check.** Rejected: a unique constraint catches only exactly
equal slots, not a booking from 19:00–20:00 overlapping one from 19:30–20:30.
The current implementation queries for an overlap before inserting, which
leaves a small race between the check and the insert. The complete fix is a
`btree_gist` `EXCLUDE` constraint; it is not taken yet because it adds a
Postgres extension dependency that not every managed provider enables by
default. The gap is recorded in `service/README.md`.

**SQLite instead of Postgres.** Rejected. Managed Postgres is available from
every provider in Appendix C, and `TIMESTAMPTZ` handling matters here: the
contract states every timestamp carries an explicit UTC offset, and SQLite has
no native timestamp type.

**Returning `400` for `endTime` before `startTime`.** Rejected in favour of
`422`. Both timestamps are individually valid RFC 3339 values, so nothing about
the request is unreadable — it is the pair that cannot be used, which is the
definition of `422` in the assignment's own category table.

**Leaving `openapi.yaml` in `spec/`.** Rejected. Clients in Sessions 5 to 12
read it from the repository root. The mock scripts now reference
`../openapi.yaml` and are otherwise unchanged.

## Consequences

**Good.**

- Bookings and idempotency keys both survive a restart, so an acknowledged
  `201` never becomes a missing booking.
- Any member can go from a clean checkout to a working database with
  `psql "$DATABASE_URL" -f db/schema.sql`, on a machine never used for this
  before.
- Every failure response has one shape and a stable `type` URI, and the
  `instance` member ties a user's report to a specific server log line.
- Contract tests can run against the mock and the service by changing only the
  base URL, so drift is detectable on every push rather than at Session 7.

**Costs, accepted.**

- Postgres must be running for local development. `docker compose up -d db` or
  a managed instance is now a prerequisite, where the mock needed nothing.
- Two writes hitting the same court for overlapping times at the same instant
  can still both succeed. Documented, not fixed.
- The service is open to anyone with the URL until Session 4 adds
  authentication.

**Deferred.**

- `POST /v1/courts/{courtId}/retirement` still has no handler and is answered
  by the mock. It needs `retired_at` and `reason` columns before the contract's
  `Retirement` response can be produced.
- The `409` example on that operation contradicts itself and cannot be resolved
  until the Worksheet W4 state table is written into `info.description`.
