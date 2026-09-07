# Badminton Court Booking — service

Implements the contract at [`../openapi.yaml`](../openapi.yaml). The contract is
the reference; this service follows it.

## Running it

```bash
cp .env.example .env        # then fill in the values
psql "$DATABASE_URL" -f db/schema.sql
psql "$DATABASE_URL" -f db/seed.sql
npm install
npm start
```

The service refuses to start if `DB_USER`, `DB_HOST`, `DB_NAME` or `DB_PORT` is
missing, and names the ones it could not find. `DB_PASSWORD` is not on that list
because an empty password is legitimate for a local trust-auth database.

`GET /health` returns `200` without touching the database, on purpose. A check
that queried Postgres would make one brief outage look like a total failure on
every instance at once, and the platform would restart all of them.

## Operations

| Operation | Served by | Remaining work |
|---|---|---|
| `GET /v1/courts` | service | — |
| `GET /v1/courts/{courtId}` | service | — |
| `POST /v1/bookings` | service | concurrent-overlap race not handled; see below |
| `POST /v1/courts/{courtId}/retirement` | **mock** | everything — no route exists yet |

`POST /v1/courts/{courtId}/retirement` has no handler. `store/` has no retirement
query and `courts` has no `retired_at` or `reason` column, so the `Retirement`
response in the contract cannot currently be produced by this service.

### Known gaps

- **Concurrent overlap on `POST /v1/bookings`.** The overlap check and the
  insert are two separate statements, so two simultaneous requests for the same
  slot can both pass the check. A unique index cannot express "overlapping
  range"; the fix is a `btree_gist` `EXCLUDE` constraint, which adds a Postgres
  extension dependency and has not been taken yet.
- **`idempotency_keys.created_at` is `TIMESTAMP`, not `TIMESTAMPTZ`.** The
  24-hour retention window compares it against `now()`. Correct as long as the
  database session timezone is stable, but not robust to a server in another
  zone.

## Failure catalogue

One function produces every failure response: `problem(res, status, slug, options)`
in [`src/problem.js`](src/problem.js). It owns the `application/problem+json`
media type, the `type` URI prefix, the title registry and the `instance`
identifier. The handler owns only the status, the slug and any extension members.

Every row below is documented in `openapi.yaml` on the operation that can
produce it.

| Cause in the handler | Status | `type` URI | Extension members |
|---|---:|---|---|
| Invalid `cursor` value | 400 | `…/problems/malformed-request` | — |
| Invalid `limit` value | 400 | `…/problems/malformed-request` | — |
| Invalid `status` filter value | 400 | `…/problems/malformed-request` | — |
| `courtId` fails its documented pattern | 400 | `…/problems/malformed-request` | — |
| `Idempotency-Key` missing or not a v4 UUID | 400 | `…/problems/malformed-request` | — |
| Request body is not valid JSON | 400 | `…/problems/malformed-request` | — |
| Body fails the `NewBooking` schema | 400 | `…/problems/malformed-request` | `invalidFields` |
| No route matches the request | 404 | `…/problems/not-found` | — |
| Court named by the URL does not exist | 404 | `…/problems/not-found` | — |
| `endTime` is not after `startTime` | 422 | `…/problems/validation-failed` | `invalidFields` |
| `courtId` in the body references no court | 422 | `…/problems/validation-failed` | `invalidFields` |
| Court is retired or unavailable | 409 | `…/problems/court-slot-unavailable` | `courtId`, `status` |
| Court already booked for an overlapping slot | 409 | `…/problems/court-slot-unavailable` | `courtId`, `conflictingBookingId` |
| Same idempotency key, different body | 409 | `…/problems/idempotency-key-reuse` | — |
| Anything unplanned | 500 | `…/problems/internal-error` | — |

`…` stands for `https://api.example.com`. Every `type` is stable: the same cause
keeps the same URI across handlers and releases, and clients branch on `type`,
never on the wording of `title` or `detail`.

`500` is reserved for a genuine server failure. A `400`, `404`, `409` or `422`
condition never reaches it — each has its own branch in the handler. The global
handler in [`src/middleware/error.js`](src/middleware/error.js) logs the full
error with a `requestId` and returns a body containing no stack trace, no SQL,
no hostname and no connection string. The `instance` member in the response is
`urn:request:<id>`, and the same `<id>` appears in the log line, so a user's
report can be matched to the server's record of it.

### Why 400, 422 and 409 are different answers

| Status | The server's claim |
|---:|---|
| 400 | The request could not be read as the contract promised. |
| 422 | Every field is individually valid, but the request as a whole cannot be used. |
| 409 | The request is understood; the current state of the domain refuses it. |

`endTime` before `startTime` is a **422**, not a 400: both timestamps are
individually valid RFC 3339 values, so nothing about the request is unreadable —
it is the pair that cannot be used.

## Idempotency

`POST /v1/bookings` requires an `Idempotency-Key` header holding a version-4
UUID. Keys live in the `idempotency_keys` table, not in process memory: a retry
arrives exactly when something has already gone wrong, which is when the process
is most likely to have just restarted.

| Condition | Server action | Response |
|---|---|---|
| Header missing or malformed | Reject before doing any work | `400` |
| Key never seen before | Record key + body hash, do the work, store the response | `201` |
| Key seen, identical body | Do not reprocess; resend the stored response | `201`, same booking id |
| Key seen, different body | Reject — the key is being used for another purpose | `409 idempotency-key-reuse` |

The body hash is a SHA-256 over the canonicalised body, so key order in the
client's JSON does not change the comparison. Keys are retained 24 hours, as the
contract states; a key reused after that window is treated as new.

Verify it:

```bash
KEY=$(uuidgen)
for i in 1 2; do
  curl -s -o /tmp/r$i.json -w "%{http_code}\n" \
    -X POST "$BASE/v1/bookings" \
    -H "Idempotency-Key: $KEY" -H 'Content-Type: application/json' \
    -d '{"courtId":"crt_51Fa93cD","startTime":"2026-08-29T19:00:00+07:00","endTime":"2026-08-29T20:00:00+07:00"}'
done
diff /tmp/r1.json /tmp/r2.json && echo "identical responses"
```

Correct result: two `201`s, identical bodies, and exactly one new row in
`bookings`. Two rows means the key was never checked. A `409` on the second call
means the implementation is wrong — `409` is reserved for a *different* body
under the same key.

## Layout

| Directory | Responsibility |
|---|---|
| `src/routes/` | One file per resource. Binds method and path, then runs the five parts of the operation in order. |
| `src/schemas/` | Validation rules copied from `parameters` and `requestBody` in the contract. |
| `src/store/` | The only layer that runs SQL. |
| `src/representations/` | The only layer that decides which fields the caller sees. |
| `src/problem.js` | One failure shape for the whole API. |
| `src/middleware/error.js` | Catches what nobody planned for; details to the log, never to the body. |
| `db/schema.sql` | Every `CREATE TABLE`, runnable from an empty database. |

Column names are internal; response field names are the contract's. The
representation function connects the two — `bookings.created_at` exists in the
table and deliberately never appears in a response.
