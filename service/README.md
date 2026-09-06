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
