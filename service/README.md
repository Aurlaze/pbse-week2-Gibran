# Service operations

| Operation | Served by | Remaining work |
|---|---|---|
| GET /v1/courts | service | — |
| GET /v1/courts/{courtId} | service | — |
| POST /v1/bookings | service | concurrent-overlap race condition not yet handled |
| POST /v1/courts/{courtId}/retirement | service | concurrent double-retire race condition not yet handled |

## Failure mapping

| Cause in handler | Status | type URI |
|---|---:|---|
| Invalid cursor value | 400 | https://api.example.com/problems/malformed-request |
| Invalid limit value | 400 | https://api.example.com/problems/malformed-request |
| Invalid status value | 400 | https://api.example.com/problems/malformed-request |
| Invalid courtId format (court lookup) | 400 | https://api.example.com/problems/malformed-request |
| Court not found (court lookup) | 404 | https://api.example.com/problems/not-found |
| Missing or invalid Idempotency-Key header | 400 | https://api.example.com/problems/malformed-request |
| That idempotency key was already used for a different request | 409 | https://api.example.com/problems/idempotency-key-reuse |
| Invalid courtId format (booking) | 400 | https://api.example.com/problems/malformed-request |
| startTime must be a valid ISO date-time | 400 | https://api.example.com/problems/malformed-request |
| endTime must be a valid ISO date-time | 400 | https://api.example.com/problems/malformed-request |
| endTime must be after startTime | 400 | https://api.example.com/problems/malformed-request |
| courtId does not exist | 422 | https://api.example.com/problems/validation-failed |
| The badminton court is retired or not available | 409 | https://api.example.com/problems/court-slot-unavailable |
| The badminton court is already booked for this time slot | 409 | https://api.example.com/problems/court-slot-unavailable |
| reason missing or empty (retirement request body) | 400 | https://api.example.com/problems/malformed-request |
| Illegal transition (court status is neither active nor retired) | 409 | https://api.example.com/problems/illegal-transition |

## Error Mapping Catalogue (RFC 9457)

| Cause inside Handler | HTTP Status | Type URI | OpenAPI Operation / Response Reference |
| :--- | :---: | :--- | :--- |
| Malformed JSON body or invalid parameter type | `400` | `/errors/bad-request` | `400` response on `POST` & `GET` operations |
| Missing required `Idempotency-Key` header | `400` | `/errors/missing-idempotency-key` | `400` response on unsafe `POST` operations |
| Requested entity ID does not exist | `404` | `/errors/not-found` | `404` response on `GET /v1/<resource>/{id}` |
| Reusing `Idempotency-Key` with a different body payload | `409` | `/errors/idempotency-key-reuse` | `409` response on unsafe `POST` operations |
| Entity state constraint violation (e.g. invalid status transition) | `409` | `/errors/state-conflict` | `409` response on state update operations |
| Request body fields valid individually, but domain validation failed | `422` | `/errors/unprocessable-entity` | `422` response on unsafe `POST` operations |
| Unhandled exception / system failure | `500` | `/errors/internal-server-error` | Default `500` response on all operations |
