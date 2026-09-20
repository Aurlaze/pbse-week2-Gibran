# L4 — Authentication & Access Control: status checklist

Audit of the repository at commit `0f1375c` against the Session 4 handout (Steps 0–12).

**Legend:** ✅ done · ⚠️ partial (exists, but the checkpoint would not pass) · ❌ not started

Current standing against the marking criteria: **PASS on every assessed item.** All three
layers are in place, 17 authorisation tests run in CI, no secret is in any public client and
no token reaches a log. What is left is evidence and paperwork (Steps 10 and 12c–e).

---

## Summary

| Step | Result the handout asks for | Status | Blocker |
|---|---|:--:|---|
| 0 | Baseline verified, branch created | ⚠️ | Pipeline fixed locally; not yet observed green on GitHub |
| 1 | Every client classified public/confidential | ✅ | — |
| 2 | Scope vocabulary designed | ✅ | 2 scopes unused |
| 3 | Auth server running; clients and test users registered | ✅ | 6 users, 5 scopes, rotation on |
| 4 | Security declared on the contract | ✅ | Lint valid; 1 accepted warning |
| 5 | Auth file skeleton and configuration | ✅ | — |
| 6 | Layer 1 — authentication working | ✅ | — |
| 7 | Layer 2 — scope checking working | ✅ | — |
| 8 | **Layer 3 — object check in every handler** | ✅ | Verified, including the identical-404 diff |
| 9 | Tokens never appear in logs | ✅ | `logger.js` redacts at the boundary |
| 10 | Refresh rotation and reuse detection demonstrated | ⚠️ | Configured, evidence not captured |
| 11 | Four negative tests pass | ✅ | 17 tests, all proven red by mutation |
| 12 | CI green, demonstration, tag `l4` | ⚠️ | 12a/12b done; ADR, checklist and tag left |

## The three that decide the grade

| # | Problem | Evidence |
|---|---|---|
| 1 | ~~Object-level authorisation does not exist.~~ **Fixed in Phase 4.** `booked_by` column, three booking object operations, `ownership.js`, and identical 404s verified byte-for-byte. | `service/src/auth/ownership.js` |
| 2 | ~~No authorisation tests.~~ **Fixed in Phase 5.** 17 tests in `service/tests/authz/`, run in CI, each one proven to fail when its check is removed. | `service/tests/authz/` |
| 3 | ~~CI cannot start the service.~~ **Fixed.** The job env now carries `DATABASE_URL` and the three `OIDC_*` vars, a test JWKS server starts before the service, and both the contract suite and the idempotency replay send a token. | `.github/workflows/contract.yml` |

---

## Step 0 — The starting point

| Item | Status | Where / what to do |
|---|:--:|---|
| Working branch created | ✅ | `14-auth`, since merged to `main` |
| Green Session 3 baseline | ⚠️ | The service starts, authenticates, and every operation in the contract now has a handler. **Not yet confirmed on GitHub** — the last push was Phase 2, when the new operations had no handlers, so that run was red. Push Phases 3–6 and check |

## Step 1 — Classify every client

| Item | Status | Where / what to do |
|---|:--:|---|
| Classification table filled in | ✅ | `docs/decisions/0003-autentikasi.md` — student web, admin web, cleanup job |
| Every Public row holds no secret | ✅ | All three rows correct |

## Step 2 — Design the scope vocabulary

| Item | Status | Where / what to do |
|---|:--:|---|
| Five `resource:action` scopes with an actor matrix | ✅ | `service/README.md` |
| No more than eight scopes | ✅ | Five |
| Every operation maps to exactly one scope | ✅ | The Phase 2 booking operations now use `bookings:read`; `bookings:fulfil` governs the ownership predicate |

## Step 3 — Set up the authorisation server

| Item | Status | Where / what to do |
|---|:--:|---|
| 3a Keycloak 26 via compose, admin password from `.env` | ✅ | `infra/docker-compose.auth.yml` |
| 3b Realm `badminton-booking` | ✅ | `infra/keycloak/badminton-booking-realm.json` |
| 3c Every Step 2 scope defined as a client scope | ✅ | All five present and spelled identically in the realm, `openapi.yaml` and `README.md` |
| 3d Two public clients: PKCE `S256`, full redirect URI, direct grants off, no secret | ✅ | `badminton-student-web`, `badminton-admin-web` |
| 3e Confidential job client: service account on, standard flow off, no committed secret | ✅ | `badminton-job` now carries `bookings:read` + `bookings:fulfil`; `bookings:write` removed — it never creates a booking |
| 3f Refresh rotation with reuse detection | ✅ | `revokeRefreshToken: true`, `refreshTokenMaxReuse: 0` |
| 3g Six test users | ✅ | `student-a/b`, `admin-a/b`, `staff-a/b`, documented in `service/README.md` |
| 3h Three `OIDC_*` variables, no values | ✅ | `service/.env.example` |
| Checkpoint: decoded token payload recorded | ❌ | `iss`/`aud`/`exp`/`sub`/`scope` evidence not captured anywhere |

## Step 4 — Declare security in `openapi.yaml`

| Item | Status | Where / what to do |
|---|:--:|---|
| 4a `securitySchemes.oauth2` with all scopes | ✅ | Both flows now on one scheme; the orphaned `clientCredentials` scheme is gone |
| 4b Narrow document-level default | ✅ | `security: [ oauth2: [courts:read] ]` |
| 4c Per-operation `security` where wider | ✅ | `createBooking` → `bookings:write`; `deactivateCourt` → `courts:write` |
| 4c `security: []` on genuinely public operations | ✅ | `/health` documented and served at `/health` and `/v1/health` |
| 4d `Unauthorized`, `Forbidden`, `NotFound` shared responses | ✅ | `WWW-Authenticate` documented; 404 covers both conditions deliberately |
| 4e Breaking change recorded, version raised | ✅ | `[1.1.0]` corrected to five scopes; `[1.2.0]` added for the new operations |
| Checkpoint: `redocly lint` passes | ✅ | **Valid**, 1 accepted warning (`/health` has no 4xx, deliberately). `security-defined` re-enabled in `spec/redocly.yaml`. File still carries L2 skeleton TODOs and a `tags: [Things]` entry |

## Step 5 — Auth file skeleton and configuration

| File | Status | Where / what to do |
|---|:--:|---|
| `auth/verify.js` | ✅ | — |
| `auth/principal.js` | ✅ | Exists; see the Step 6 defect |
| `auth/authenticate.js` | ✅ | — |
| `auth/require-scope.js` | ✅ | — |
| `auth/ownership.js` | ✅ | `mayReadBooking`, `mayCancelBooking`, `isFulfiller` |
| `config.js` refuses to start on a missing variable | ✅ | Checks all four required vars |
| `problem.js` 401 / 403 helpers | ✅ | `unauthorized()` and `forbidden()` added, both set `WWW-Authenticate`; slug renamed to `insufficient-scope` |

## Step 6 — Layer 1: authentication

| Item | Status | Where / what to do |
|---|:--:|---|
| JWKS built once at module level | ✅ | `auth/verify.js` |
| Signature, `iss`, `aud` verified; `RS256` allowlisted | ✅ | `auth/verify.js` |
| Middleware installed before `/v1`, after `/health` | ✅ | `src/app.js` |
| Anonymous request gets `req.principal = null` | ✅ | `auth/authenticate.js` |
| Refusal reason logged, token never logged | ✅ | `auth/authenticate.js` |
| Principal carries a correct `kind` | ⚠️ | Now derived from `client_id`/`clientId` or a `service-account-` username. **Still to confirm against a real client-credentials token** from your Keycloak |
| `WWW-Authenticate` on the 401 | ✅ | `Bearer error="invalid_token"`, verified |
| `clockTolerance: 5` | ✅ | Set |
| Checkpoint: no token → 401, edited payload → 401, valid → 200/404, `/health` → 200 | ✅ | Verified locally: `/health` and `/v1/health` → 200; no token, garbage token and **edited payload** all → 401, so the signature is genuinely checked |

## Step 7 — Layer 2: the scope check

| Item | Status | Where / what to do |
|---|:--:|---|
| `requireScope` returns 401 without a principal, 403 on a missing scope | ✅ | `auth/require-scope.js` |
| Installed on every route with the contract's exact strings | ✅ | `routes/courts.js`, `routes/bookings.js` |
| Scope checked before any object is loaded | ✅ | Middleware runs before the handler |
| `WWW-Authenticate: ... insufficient_scope` on the 403 | ✅ | Names the missing scope, verified |
| Checkpoint, including "stop the database, still 403" | ❌ | Not recorded |

## Step 8 — Layer 3: the object check ✅

| Item | Status | Where / what to do |
|---|:--:|---|
| Bookings have an owner | ✅ | `booked_by` column in `db/schema.sql`, written from `req.principal.subject`, never from the body. Added with `ALTER TABLE ... IF NOT EXISTS` so the file still builds from empty *and* upgrades a deployed database |
| A route that names a booking object | ✅ | `GET /v1/bookings/{bookingId}` and `POST /v1/bookings/{bookingId}/cancellation` |
| Collection constrained inside the query | ✅ | `listForPrincipal` builds the `WHERE` clause; `bookings:fulfil` widens it. Nothing is filtered in JavaScript |
| `auth/ownership.js` predicates | ✅ | `mayReadBooking`, `mayCancelBooking`, `isFulfiller` |
| Five-line pattern in every handler | ✅ | validate → load → absent 404 → not-yours 404 → represent |
| Both 404s are byte-identical | ✅ | One `notFound()` function serves both branches. Verified: the two bodies differ only in `instance` |
| Check runs before the write on cancellation | ✅ | Verified — a refused cancel leaves `status` at `confirmed` |
| 8a ownership inventory table | ✅ | `service/README.md`, including the two operations that name no object |
| 8e Representations follow the caller's role | ✅ | `bookedBy` is emitted only to callers holding `bookings:fulfil`; documented as optional on the `Booking` schema |
| Checkpoint: `diff` of the two 404 bodies is empty | ✅ | Verified against the handlers with a stubbed store |

**Still to do against a real database.** Every check above ran with the store
stubbed, because the only database this repo is configured against is the
team's shared Neon instance. Before the demonstration, apply `db/schema.sql`
(the `ALTER TABLE` lines are additive and safe to re-run) and repeat the
`diff` from `service/README.md` against the running service.

## Step 9 — Tokens never reach the logs

| Item | Status | Where / what to do |
|---|:--:|---|
| No token currently reaches a log | ✅ | `authenticate.js` logs `err.code`; the error handler logs method/url/requestId, not headers |
| Redaction at the logging boundary | ✅ | `src/logger.js` (pino) redacts `authorization`, `cookie`, `set-cookie` and token-shaped keys; serialisers drop headers entirely |
| Tokens never query parameters | ✅ | — |
| Checkpoint: `grep` over the logs recorded | ❌ | Not run |

## Step 10 — Refresh rotation and reuse detection

| Item | Status | Where / what to do |
|---|:--:|---|
| Rotation + reuse detection enabled on the server | ✅ | `revokeRefreshToken: true`, `refreshTokenMaxReuse: 0` |
| 10a Token storage table (browser / job) | ❌ | Not written down |
| 10b Three-request proof run | ❌ | Not run |
| Checkpoint: the three outputs + the setting name in the ADR | ❌ | Not captured |

## Step 11 — Four negative tests ✅

17 tests in `service/tests/authz/`, run with Node's built-in runner against a
real Postgres and a test-only signing key. No new test dependency was needed.

| # | Boundary crossed | Expected | Status |
|---|---|:--:|:--:|
| 1 | student-a reads student-b's booking | 404 | ✅ |
| 1b | "not yours" and "does not exist" bodies are identical | — | ✅ |
| 2 | student-a cancels student-b's booking (**and the row is unchanged**) | 404 | ✅ |
| 3 | a token without `bookings:write` cancels its *own* booking | 403 | ✅ |
| 4 | student-a's `GET /v1/bookings` page contains no other student's rows | 200 | ✅ |
| 5 | Layer 1: no header, edited payload, wrong audience, expired, non-JWT | 401 | ✅ |
| + | positive control: an admin holding `bookings:fulfil` *can* read it | 200 | ✅ |

The positive control matters: without it the whole suite would still pass if
`mayReadBooking` were replaced by `return false`, and it would be proving that
the service refuses everybody rather than that it refuses the right people.

### 11c — every check proven to matter

Each check was removed one at a time and the suite re-run. A test that stays
green when its check is deleted tests nothing.

| Mutation applied | Result |
|---|---|
| *(baseline — all checks present)* | 17 pass, 0 fail |
| `mayReadBooking` always returns `true` | 15 pass, **2 fail** |
| `mayCancelBooking` always returns `true` | 16 pass, **1 fail** |
| collection no longer constrained by owner | 16 pass, **1 fail** |
| `requireScope` never refuses | 13 pass, **4 fail** |
| signature not verified (payload decoded only) | 14 pass, **3 fail** |
| *(all checks restored)* | 17 pass, 0 fail |

## Step 12 — CI, demonstration, submission ❌

| Item | Status | Where / what to do |
|---|:--:|---|
| 12a `conformance` job can start the service | ✅ | `DATABASE_URL` and the three `OIDC_*` vars added to the job env; verified the service boots with them |
| 12a `test:authz` step | ✅ | Runs in the same job as the contract tests |
| 12b Contract suite re-run, now sending a token | ✅ | A test JWKS server starts before the service and mints a token; `run.sh` forwards `$TOKEN`, and the idempotency replay sends it. The contract was not changed |
| 12c ADR complete: Context, Decision, Alternatives, Consequences | ⚠️ | Has Context and Decision only; missing the Step 2 scope table and the Step 10 evidence |
| 12d Pre-demonstration checklist (9 rows) | ❌ | None evidenced yet |
| 12e Tag `l4` | ❌ | No tags exist |

---

## Suggested order of work

| # | Task | Why first |
|---|---|---|
| 1 | Unbreak CI (Step 12 env vars) | Nothing after this is measurable until it is green |
| 2 | Step 8 end to end — owner column, read/cancel routes, `ownership.js`, identical 404s | Worth the most marks; everything in Step 11 depends on it |
| 3 | Step 11 — test-key helper, four negative tests, wire `test:authz` into CI | Second-heaviest criterion |
| 4 | Step 3g six test users + the two missing client scopes | Cheap, and Step 11 reads better with them |
| 5 | Small fixes: `/health` in the contract, `WWW-Authenticate` helpers, `principal.kind`, `logger.js` redaction | Each is a few lines |
| 6 | Evidence and paperwork: Step 10 proof, ADR sections, 12d checklist, tag `l4` | Last, once the behaviour is settled |
