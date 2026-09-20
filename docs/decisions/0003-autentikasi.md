# 0003. Authentication and Access Control

**Status:** Accepted · Session 4

## Context

Since Session 3 this service has answered every `/v1` request without asking
who sent it. Any client that knew a URL could read any booking and create
bookings in anyone's name. That was deliberate — Session 3 was about the
contract and the store — but it cannot survive contact with real users, and
A2 marks object-level authorisation directly.

Three separate questions have to be answered, in order, and they are easy to
collapse into one condition that can be neither tested nor explained:

1. **Authentication** — who sent this request?
2. **Authorisation by scope** — is this *kind* of operation permitted to them?
3. **Authorisation by object** — is *this particular record* theirs?

A service that answers only the first two has the defect this session exists
to prevent: a caller with a perfectly valid token changes an identifier in
the URL and reads somebody else's booking.

## Decision

### 1. Authorisation server — Keycloak, self-hosted via Docker

`infra/docker-compose.auth.yml` runs Keycloak 26 with the realm in
`infra/keycloak/` imported on start. This service is a *resource server*: it
never sees a password and never issues a token. It needs exactly three values
from the authorisation server, and they are the only coupling between them:

```
OIDC_ISSUER      the realm URL
OIDC_JWKS_URI    where the public signing keys live
OIDC_AUDIENCE    badminton-api
```

`OIDC_AUDIENCE` is what stops a token minted for a different API in the same
realm from being accepted here.

### 2. Client classification

Every application that requests a token is classified by one question: **can
the user read values stored inside this application?**

| Our client | Runs on | Public/Confidential | Flow | Holds a secret? |
| :--- | :--- | :--- | :--- | :--- |
| Student Web App | User's browser | Public | Authorization Code + PKCE | No |
| Admin Web App | User's browser | Public | Authorization Code + PKCE | No |
| Cleanup Job | Team server | Confidential | Client Credentials | Yes, in a secret manager |

Both browser clients are registered with client authentication **off**, PKCE
`S256`, direct access grants **off**, and redirect URIs matched in full with
no wildcards. Obfuscating or splitting a secret inside a browser application
would not make it confidential: the application still has to reconstruct the
value in order to use it, so whoever controls the device can eventually read
it. A secret shipped to every user is not a secret.

### 3. Domain actors and the scope vocabulary

Our actors are **student**, **administrator**, and the **scheduled cleanup
job**. The scopes were derived from what each actor genuinely needs to do,
not from the list of endpoints — five scopes against eight operations.

| Scope | Permits | Student | Admin | Job |
| :--- | :--- | :---: | :---: | :---: |
| `courts:read` | Browse badminton courts and availability | yes | yes | yes |
| `courts:write` | Create, update, or retire badminton courts | — | yes | — |
| `bookings:read` | Read bookings visible to the principal | yes | yes | yes |
| `bookings:write` | Create and cancel own bookings | yes | yes | — |
| `bookings:fulfil` | Confirm, reject, or manage all bookings | — | yes | yes |

The same five strings appear in exactly three places, spelled identically:
the realm's client scopes, `security` in `openapi.yaml`, and the arguments to
`requireScope` in `src/routes/`. `requireScope` is the only place in the
service where a scope name is written.

**A scope does not grant access to an object.** A token carrying
`bookings:read` permits booking-reading operations; it does not make every
booking the caller's. Which records are visible is decided by the object
check, not the scope.

### 4. Three layers, three files, three statuses

| Layer | Question | Where | Refusal |
| :--- | :--- | :--- | ---: |
| 1 · authentication | Who sent this? | `src/auth/authenticate.js` | `401` |
| 2 · scope | May they do this *kind* of thing? | `src/auth/require-scope.js` | `403` |
| 3 · object | Is *this record* theirs? | `src/auth/ownership.js`, called in the handler | `404` |

Layer 2 answers `403` and Layer 3 answers `404`, and the two are consistent
rather than contradictory. The scope refusal is decided entirely by the
contents of the caller's own token, before any row is loaded, so it cannot
reveal whether a record exists. The object refusal has necessarily touched a
record, so it must answer identically whether that record is absent or merely
somebody else's — otherwise the difference between the two answers is a way
to enumerate booking identifiers, even though every request was refused.

Both branches in `src/routes/bookings.js` go through one `notFound()`
function so that they cannot drift apart. Matching the status while varying
the wording would move the signal from the status line into the body and leak
exactly the same thing.

### 5. How tests obtain tokens — a local test key

The suite generates its own RSA key pair, serves the JWKS from an HTTP server
inside the test process, and points `OIDC_ISSUER` / `OIDC_JWKS_URI` there.
Nineteen tests in `service/tests/authz/` run with no network and no
authorisation server.

The issuer under test is `https://test.local/`, so a token minted by the
suite can never be accepted by a real deployment. The key never leaves the
process that generated it.

This tests **our** authorisation, not Keycloak's configuration — which is why
the refresh-token rotation in section 6 is still checked by hand against the
real server.

### 6. Refresh token rotation with reuse detection

Enabled on the realm:

| Setting | Value |
| :--- | :--- |
| `revokeRefreshToken` | `true` |
| `refreshTokenMaxReuse` | `0` |
| `accessTokenLifespan` | `300` (5 minutes) |

Rotation alone only invalidates the old token. Reuse *detection* revokes the
whole family: if an already-used refresh token is presented, both parties
holding it are logged out and a fresh login is required. The server does not
need to work out which of the two is the legitimate one — it only needs to
stop trusting both.

#### Where each token type is stored

Access tokens are short-lived and sent on every API request. Refresh tokens
are long-lived and sent only to the authorisation server, so they are the
ones worth stealing.

| Platform | Use | Never |
| :--- | :--- | :--- |
| Browser | Access token in memory; refresh token in an `HttpOnly`, `Secure`, `SameSite` cookie | `localStorage` — any injected script can read it |
| Server-side job | Client secret and tokens from a secret manager, injected at runtime | Source code, or a committed `.env` |

#### Evidence

> **To be filled in.** Run `docs/checkpoints.sh` against a running Keycloak
> and paste the output of section 10b here, together with the name of the
> setting enabled. Until this block contains real output, Step 10 is not
> demonstrated.

```
$ # 1. exchange RT1 -> RT2, RT1 becomes used
$ # 2. reuse RT1   -> must be refused
$ # 3. present RT2 -> must ALSO be refused, because the family is revoked
```

### 7. Tokens never reach the logs

Redaction happens at the logging boundary in `src/logger.js`, not at each
call site: a rule enforced in one file holds for code nobody has written yet.
`Authorization`, `Cookie` and `Set-Cookie` are redacted, and the request
serialiser emits only method, path and correlation id — never the header
block, and never the whole request object.

The authentication middleware logs the *reason* a token was rejected
(`err.code`) and never the token, not even a prefix of one: a fraction of a
credential is still a fraction of a credential.

## Alternatives considered

### Session cookies instead of OAuth 2 / OIDC

Simpler to implement, and for a single browser client it would have been
enough. Rejected because Session 6 adds a mobile client and a scheduled job.
Neither has a cookie jar, and bolting a second authentication mechanism onto
a service later is how a codebase ends up with two half-trusted paths to the
same data.

### A hosted authorisation server (Auth0 and similar)

Less to run. Rejected because the free tiers do not reliably expose refresh
token rotation with reuse detection, which Step 10 requires and which is the
one setting here that genuinely protects a stolen long-lived credential.
Self-hosting also means the whole configuration is a file in the repository
and can be reviewed in a pull request.

### Roles in the token instead of scopes

`realm_access.roles` carrying `student` / `admin` would have worked, and is
the Keycloak default. Rejected because a role says who somebody *is*, while a
scope says what the token may *do*. The distinction matters for the cleanup
job, which is not a person at all, and for a browser client that should be
able to ask for a token narrower than the user's full authority.

### Direct grant for test tokens

The alternative offered by Step 11a: enable direct access grants on a test
client and have the suite log in as a real test user. Rejected as the
*primary* strategy because it makes CI depend on a reachable Keycloak, which
is a container start, a network hop, and a class of flakiness in every run.
We kept a `test-cli` client with direct grants enabled on the development
realm only, for the manual checkpoints where exercising the real server is
the point.

### One scope per endpoint

Briefly considered and abandoned — it is what happens when the vocabulary is
derived from the path list rather than from what each actor needs. It would
have produced eight scopes for eight operations, none of which could be
explained to a user, and every new endpoint would have meant a new scope and
a realm change.

## Consequences

### What this buys

- A caller cannot read or change another caller's booking by changing an
  identifier, and cannot learn whether an identifier exists.
- Nineteen tests in CI hold that boundary closed. Each one was verified to
  fail when its check is removed, so none of them is decorative.
- Changing authorisation server touches `src/auth/principal.js` and three
  environment variables. Nothing else in the service knows what Keycloak is.

### What it costs

- **A new runtime dependency.** The service cannot verify a token if the
  authorisation server's JWKS endpoint is unreachable. The JWKSet is built
  once at module level and cached, so a brief outage is survivable, but a
  long one is an outage here too.
- **Deployment now needs four variables, not one.** `src/config.js` refuses
  to start when any is missing. This is deliberate — the alternative is a
  service that starts and then fails on the first request — but it means a
  half-configured environment fails loudly and immediately. Our Vercel
  deployment did exactly this until the three `OIDC_*` variables were added.
- **Bookings created before Session 4 have no owner.** The `booked_by` column
  was added to a table that already had rows, so those rows are `NULL`. The
  ownership predicate treats `NULL` as *belonging to nobody*: invisible to
  every student, visible to `bookings:fulfil`. That is the safe direction to
  fail, but the old rows are effectively orphaned and should be either
  attributed or deleted before A2.
- **Local development needs Docker.** A contributor without it can still run
  the authorisation tests, because they use a local key, but cannot exercise
  a real login.

### What is deliberately still open

- `POST /v1/courts/{courtId}/retirement` is still served by the mock. It
  declares `courts:write` on the contract, but there is no handler and
  therefore no object check. It must not ship without one.
- `principal.kind` distinguishes a service token from a user token using
  Keycloak's `client_id` / `service-account-` markers. It is not yet
  confirmed against a token issued by our own realm through Client
  Credentials. Nothing currently branches on `kind`, so the risk is contained
  — but anything that starts to branch on it must verify it first.
