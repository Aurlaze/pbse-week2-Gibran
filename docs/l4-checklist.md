# L4 — Authentication & Access Control: status checklist

Audit of the repository at commit `0f1375c` against the Session 4 handout (Steps 0–12).

**Legend:** ✅ done · ⚠️ partial (exists, but the checkpoint would not pass) · ❌ not started

Current standing against the marking criteria: **PARTIAL** — the object check is absent
everywhere, and no negative tests exist.

---

## Summary

| Step | Result the handout asks for | Status | Blocker |
|---|---|:--:|---|
| 0 | Baseline verified, branch created | ⚠️ | Pipeline fixed; green once Phase 4 lands |
| 1 | Every client classified public/confidential | ✅ | — |
| 2 | Scope vocabulary designed | ✅ | 2 scopes unused |
| 3 | Auth server running; clients and test users registered | ⚠️ | Zero test users; 2 scopes missing |
| 4 | Security declared on the contract | ✅ | Lint valid; 1 accepted warning |
| 5 | Auth file skeleton and configuration | ⚠️ | `ownership.js` missing |
| 6 | Layer 1 — authentication working | ⚠️ | `principal.kind` broken; no `WWW-Authenticate` |
| 7 | Layer 2 — scope checking working | ✅ | No header on the 403 |
| 8 | **Layer 3 — object check in every handler** | ❌ | **Nothing exists** |
| 9 | Tokens never appear in logs | ⚠️ | True by accident, no redaction boundary |
| 10 | Refresh rotation and reuse detection demonstrated | ⚠️ | Configured, evidence not captured |
| 11 | Four negative tests pass | ❌ | No test suite at all |
| 12 | CI green, demonstration, tag `l4` | ⚠️ | 12a/12b done; ADR, checklist and tag left |

## The three that decide the grade

| # | Problem | Evidence |
|---|---|---|
| 1 | **Object-level authorisation does not exist.** No `ownership.js`, no owner column on `bookings`, and no route names a booking object — `POST /v1/bookings` is the only booking operation, so there is nothing for Layer 3 to guard. | `service/src/routes/bookings.js`, `service/db/schema.sql` |
| 2 | **No authorisation tests.** No `tests/authz/`, no test runner installed, `npm test` still exits 1. | `service/package.json` |
| 3 | ~~CI cannot start the service.~~ **Fixed.** The job env now carries `DATABASE_URL` and the three `OIDC_*` vars, a test JWKS server starts before the service, and both the contract suite and the idempotency replay send a token. | `.github/workflows/contract.yml` |

---

## Step 0 — The starting point

| Item | Status | Where / what to do |
|---|:--:|---|
| Working branch created | ✅ | `14-auth`, since merged to `main` |
| Green Session 3 baseline | ⚠️ | The pipeline can now start the service and authenticate. It goes fully green once Phase 4 implements the three operations Phase 2 added to the contract |

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
| 3c Every Step 2 scope defined as a client scope | ❌ | Only `courts:read`, `courts:write`, `bookings:write` exist. **Add `bookings:read` and `bookings:fulfil`** — realm, `openapi.yaml` and README must name identical strings |
| 3d Two public clients: PKCE `S256`, full redirect URI, direct grants off, no secret | ✅ | `badminton-student-web`, `badminton-admin-web` |
| 3e Confidential job client: service account on, standard flow off, no committed secret | ⚠️ | `badminton-job` is correct, but its default scope is `bookings:write`; per the Step 2 table the job should carry `bookings:fulfil` |
| 3f Refresh rotation with reuse detection | ✅ | `revokeRefreshToken: true`, `refreshTokenMaxReuse: 0` |
| 3g Six test users | ❌ | **The realm has zero `users`.** Step 11 cannot cross four boundaries without them |
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
| `auth/ownership.js` | ❌ | **Does not exist** |
| `config.js` refuses to start on a missing variable | ✅ | Checks all four required vars |
| `problem.js` 401 / 403 helpers | ⚠️ | Slugs exist, but **no `unauthorized()` / `forbidden()` helpers and no response ever sets `WWW-Authenticate`**, which `openapi.yaml` documents. Also rename `insufficient_scope` → `insufficient-scope` to match every other slug |

## Step 6 — Layer 1: authentication

| Item | Status | Where / what to do |
|---|:--:|---|
| JWKS built once at module level | ✅ | `auth/verify.js` |
| Signature, `iss`, `aud` verified; `RS256` allowlisted | ✅ | `auth/verify.js` |
| Middleware installed before `/v1`, after `/health` | ✅ | `src/app.js` |
| Anonymous request gets `req.principal = null` | ✅ | `auth/authenticate.js` |
| Refusal reason logged, token never logged | ✅ | `auth/authenticate.js` |
| Principal carries a correct `kind` | ❌ | **`principal.js:4` reads `claims.kind`, a claim Keycloak never issues** — always `undefined`. Derive it from a real token (`sub === azp`, or presence of `client_id`) |
| `WWW-Authenticate` on the 401 | ❌ | Not set |
| `clockTolerance: 5` | ⚠️ | Optional; not set |
| Checkpoint: no token → 401, edited payload → 401, valid → 200/404, `/health` → 200 | ✅ | Verified locally: `/health` and `/v1/health` → 200; no token, garbage token and **edited payload** all → 401, so the signature is genuinely checked |

## Step 7 — Layer 2: the scope check

| Item | Status | Where / what to do |
|---|:--:|---|
| `requireScope` returns 401 without a principal, 403 on a missing scope | ✅ | `auth/require-scope.js` |
| Installed on every route with the contract's exact strings | ✅ | `routes/courts.js`, `routes/bookings.js` |
| Scope checked before any object is loaded | ✅ | Middleware runs before the handler |
| `WWW-Authenticate: ... insufficient_scope` on the 403 | ❌ | Not set (same fix as Step 5) |
| Checkpoint, including "stop the database, still 403" | ❌ | Not recorded |

## Step 8 — Layer 3: the object check ❌

Nothing in this step exists. The most heavily assessed layer.

| Item | Status | Where / what to do |
|---|:--:|---|
| Bookings have an owner | ❌ | Add a `booked_by` (subject) column to `db/schema.sql`, write it from `req.principal.subject` in `createBooking`, seed rows for two students |
| A route that names a booking object | ❌ | Add `GET /v1/bookings/{bookingId}` (`bookings:read`) and a cancel transition (`bookings:write`) — contract first, then handler |
| Collection constrained inside the query | ❌ | `GET /v1/bookings` with `WHERE booked_by = $1` (or the wider `bookings:fulfil` branch) — never filtered in JavaScript after the query |
| `auth/ownership.js` predicates | ❌ | `mayReadBooking(principal, booking)` in one place |
| Five-line pattern in every handler | ❌ | validate → load → absent 404 → not-yours **identical** 404 → represent |
| Check runs before the write on the cancel operation | ❌ | — |
| 8a ownership inventory table | ❌ | Operation / object named / ownership rule, in `service/README.md` |
| 8e Representations follow the caller's role | ❌ | — |
| Checkpoint: `diff` of the two 404 bodies is empty | ❌ | — |

## Step 9 — Tokens never reach the logs

| Item | Status | Where / what to do |
|---|:--:|---|
| No token currently reaches a log | ✅ | `authenticate.js` logs `err.code`; the error handler logs method/url/requestId, not headers |
| Redaction at the logging boundary | ❌ | No `logger.js` exists — the property holds by accident, so the next `console.log(req)` breaks it. Add pino with `redact: ['req.headers.authorization', ...]` |
| Tokens never query parameters | ✅ | — |
| Checkpoint: `grep` over the logs recorded | ❌ | Not run |

## Step 10 — Refresh rotation and reuse detection

| Item | Status | Where / what to do |
|---|:--:|---|
| Rotation + reuse detection enabled on the server | ✅ | `revokeRefreshToken: true`, `refreshTokenMaxReuse: 0` |
| 10a Token storage table (browser / job) | ❌ | Not written down |
| 10b Three-request proof run | ❌ | Not run |
| Checkpoint: the three outputs + the setting name in the ADR | ❌ | Not captured |

## Step 11 — Four negative tests ❌

| # | Test | Expected | Status |
|---|---|:--:|:--:|
| — | Test-token helper (`service/tests/helpers/tokens.js`, local key + JWKS server) | — | ✅ |
| — | Test runner installed, `test:authz` / `test:contract` scripts | — | ❌ |
| 1 | Student A reads student B's booking | 404 | ❌ |
| 2 | Student A cancels student B's booking (**and the row is unchanged**) | 404 | ❌ |
| 3 | Student token on a `courts:write` operation | 403 | ❌ |
| 4 | A job/admin boundary | 404 | ❌ |
| 5 | Layer 1: no header → 401, edited payload → 401 | 401 | ❌ |
| — | 11c Each test proven red when its check is deleted | — | ❌ |

## Step 12 — CI, demonstration, submission ❌

| Item | Status | Where / what to do |
|---|:--:|---|
| 12a `conformance` job can start the service | ✅ | `DATABASE_URL` and the three `OIDC_*` vars added to the job env; verified the service boots with them |
| 12a `test:authz` step | ❌ | Phase 5. The OIDC test vars are already in place |
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
