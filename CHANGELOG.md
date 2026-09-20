# Changelog

## [1.2.1] — 2026-09-20

Documentation only. No schema, no operation, no status code changed, so
nothing a client relies on has moved.

### Changed

- **The L2 starter skeleton is gone.** The file carried its own instructions
  — the `STARTER SKELETON` header, seven `TODO` markers, and a `Things` tag
  the operations never used — into a document meant to be read by another
  team.
- **`servers` names the deployed service** (`https://pbse-week2.vercel.app/v1`)
  instead of the `api.example.com` placeholder. The `localhost` entry was
  removed with it: it advertised an address that exists on one machine to
  every reader of the document. Local tooling takes its own base URL —
  the contract runner reads `$BASE`, and `npm run mock` serves its own port.
- **`info.description` describes this domain.** It previously stated
  conventions for monetary amounts and currencies, of which this service has
  neither. It now covers the timestamp and identifier conventions, the three
  access checks, idempotency, and the state machine as a transition table.
- **Tags declared and used consistently:** `Courts`, `Bookings` and a new
  `Service` tag for `GET /health`, which was tagged `Courts` despite not
  being a court operation.
- `listCourts` and `deactivateCourt` state their obligations — what the list
  includes, the difference between `isAvailable` and `status`, and that
  retiring a court does not cancel bookings already made against it.

### Not changed, deliberately

- **Problem `type` URIs still read `https://api.example.com/problems/...`.**
  They are identifiers, not addresses. RFC 9457 does not require a type URI
  to resolve, clients branch on the exact string, and the policy below says
  a published `type` never changes. Renaming them to match the deployment
  would break every client and buy nothing.
- `security-defined` and `no-server-example.com` are both back on in
  `spec/redocly.yaml`, each having been switched off with a note to remove
  it once there was something real to declare.

## [1.2.0] — 2026-09-20

### Added

- **`GET /v1/bookings`, `GET /v1/bookings/{bookingId}` and
  `POST /v1/bookings/{bookingId}/cancellation`.** Session 4 requires an
  object-level access check in every handler that names an object, and
  `POST /v1/bookings` was the only booking operation — there was no
  operation naming a booking for that check to guard. The three added
  operations give the `bookings:read`, `bookings:write` and
  `bookings:fulfil` scopes something to govern.
- **`GET /v1/health` documented with `security: []`.** It was always
  served and never written down. It is the one operation deliberately
  callable without a token, and saying so on the contract is what makes
  that deliberate rather than an oversight.
- `components.parameters.BookingId` and `components.schemas.Cancellation`.
- `404` on every operation that names a single booking. Its description
  covers two conditions at once — absent, and present but not the
  caller's — because both are answered identically.

### Changed

- `GET /v1/bookings` takes no owner filter. Who the caller is comes from
  the token, so a client cannot ask for another caller's page.
- `security-defined` is back on in `spec/redocly.yaml`. It was switched
  off for Meeting 2 with a note to remove it at Meeting 4. An operation
  added without a security entry is now a lint failure.

## [1.1.0] - 2026-09-15
### Changed - BREAKING
All `/v1/**` operations now require an access token carrying the scope stated on that operation. Requests without a token are answered 401.
Reason: Session 3 deliberately had no authentication; user data must not be served without checking the caller.

### Added
- `components.securitySchemes.oauth2` with five scopes.
- `401` and `403` responses on every protected operation.

Every deliberate change to `openapi.yaml` is recorded here with the reason for
it. The contract is the reference; the implementation follows it. When the two
disagree the implementation is fixed, and the contract is changed only when the
contract itself is wrong — never to make a failing test pass.

Versions follow the compatibility policy agreed in Session 2:

| Change | Bump |
| :--- | :--- |
| Adding an optional field, a new operation, or documenting a response the service already returns | minor |
| Removing or renaming a field, making an optional field required, changing a type or a status code | major |
| Wording, descriptions, examples | patch |

The version in `info.version` describes **this document**. It is not the `v1`
in the URL path, which changes only on a breaking revision.

---

## 0.4.1 — 2026-09-07

### Changed

- **`format: uuid` dropped from `Idempotency-Key`; the v4 `pattern` is now the
  whole constraint.** Nothing that validated before stops validating: the
  pattern is stricter than the format, so it already decided every case. The
  two together left the contract test unable to generate a conforming value at
  all, and it sent requests with the header missing.

### Fixed (implementation, not contract)

Found by contract tests, none of which changed the document:

- **Unknown query parameters are now rejected with `400`.** `GET /v1/courts`
  accepted `?anything=42` and ignored it. A.4.4 makes parameter names part of
  the contract, so a name the contract does not list cannot be read.
- **An unresolvable `cursor` now returns `200` with an empty list.** It
  previously returned `400`, which contradicted the contract's own typing of
  `cursor` as a plain string with no constraints. A cursor that decodes to no
  court id names no position, so nothing follows it. The decoded value is no
  longer passed to the database, which rejects the arbitrary bytes such a
  cursor can carry.
- **Query parameters are validated before the cursor is resolved**, so a
  request carrying both a bad `limit` and an unresolvable cursor is a `400`
  rather than an empty `200`.

---

## 0.4.0 — 2026-09-07

### Changed

- **`Idempotency-Key` now carries a version-4 UUID pattern.** The parameter
  declared `format: uuid`, which admits every UUID version, while the
  `## Idempotency` section of `info.description` said version 4 and the service
  enforced version 4. A contract test found the gap: a schema-compliant v1 UUID
  was rejected with `400`.

  The prose and the implementation already agreed, so the schema was corrected
  to match them rather than the service being loosened. No client that worked
  before is affected, because a non-v4 key was never accepted — hence a minor
  bump.

---

## 0.3.0 — 2026-09-07

### Added

- **`400` documented on `POST /v1/courts/{courtId}/retirement`.**
  The operation documented only `200`, `201`, `404` and `409`, but any request
  body that is not a JSON object is rejected before the handler is reached, and
  a contract test found it: `-d '"AAA"'` produced an undocumented `400`. Every
  operation carrying a `requestBody` can fail to parse it, so the response was
  documented. Additive, so a minor bump.

### Fixed (implementation, not contract)

Recorded here because a contract test found them, though neither changed the
document:

- `GET /v1/courts?cursor=` returned `400`. The contract types `cursor` as a
  plain string with no minimum length, so an empty value is schema-compliant
  and now means "first page".
- `GET /v1/courts?status=` returned `200`. The empty string is not a member of
  the documented `enum`, so it is now a `400`. The check tested truthiness
  rather than presence, which silently accepted it.

---

## 0.2.0 — 2026-09-06

### Added

- **`400` documented on `GET /v1/courts/{courtId}`.**
  The operation previously documented only `200` and `404`, but a `courtId`
  that does not match `^crt_[A-Za-z0-9]{3,}$` has always produced a `400`, and
  must: `400` says *the request could not be read as the contract promised*,
  while `404` says *the request was read, and that court does not exist*.
  Collapsing the two would leave a client unable to tell a defect in itself
  from data that is simply absent.

  The implementation was correct and the document was incomplete, so the
  document was corrected. This is additive — no client that reads the previous
  version breaks — hence a minor bump rather than a major one.

### Changed

- **`openapi.yaml` moved from `spec/` to the repository root.**
  Clients in Sessions 5 through 12 read the contract from the root. The mock
  and lint scripts in `spec/package.json` now reference `../openapi.yaml`; the
  mock server is otherwise unchanged and still serves the same document.

---

## 0.1.0 — 2026-08-30

### Added

- First published contract for the Badminton Court Booking API: `GET /v1/courts`,
  `GET /v1/courts/{courtId}`, `POST /v1/bookings`, and
  `POST /v1/courts/{courtId}/retirement`.
- `Court`, `NewBooking`, `Booking`, `Retirement` and `Problem` schemas.
- RFC 9457 Problem Details as the single failure shape, with extension members
  permitted via `additionalProperties: true`.
- `Idempotency-Key` declared required on `POST /v1/bookings`, retained 24 hours,
  with reuse under a different body reserved for `409 idempotency-key-reuse`.

---

## Known contract defects, not yet revised

These are recorded rather than silently fixed, so the decision is visible.

- **`servers` still lists `https://api.example.com/v1`**, a placeholder. It is
  replaced with the real deployment URL when the service is deployed, and
  `no-server-example.com` is re-enabled in `spec/redocly.yaml` at that point.
- **The `409` example on `POST /v1/courts/{courtId}/retirement` contradicts
  itself**: the detail refuses a court because it *is* `active`, while
  `allowedFrom` lists `active` as the permitted source state. One of the two is
  wrong. Resolving it requires the state table from Worksheet W4, which is the
  `## State machine` section still marked TODO in `info.description`.
- **`405` is not documented on any operation.** A method not listed on a path
  currently falls through to the catch-all and returns `404`. Returning `405`
  would be better HTTP, but it cannot be done until `405` is documented on the
  operations that would produce it, or the response becomes an undocumented
  status. The `unsupported_method` check is excluded in
  `tests/contract/schemathesis.toml` until this is resolved.
- **`info.description` and two operation descriptions still contain `TODO`
  markers** inherited from the Session 2 skeleton.
