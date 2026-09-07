# Changelog

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
