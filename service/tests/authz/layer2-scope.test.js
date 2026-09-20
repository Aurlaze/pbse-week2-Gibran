// Layer 2 — the scope check.
//
// Boundary 3 of Step 11b: a caller whose token is perfectly valid, but which
// does not carry the scope the operation declares in openapi.yaml.
//
// This is the one refusal in the suite that is a 403 rather than a 404, and
// the distinction is deliberate. The answer is decided entirely by the
// contents of the caller's own token, before any row is loaded, so it cannot
// reveal whether the booking named in the URL exists.

const test = require("node:test");
const assert = require("node:assert/strict");

const { startTestService, signInAs } = require("../helpers/harness");

let service;

test.before(async () => {
  service = await startTestService();
});

test.after(async () => {
  await service.stop();
});

// A read-only student: the scopes a client would hold before the user has
// agreed to anything that changes data.
const READ_ONLY = ["courts:read", "bookings:read"];

test("a token without bookings:write cannot cancel, even its own booking", async () => {
  const readOnlyToken = await signInAs("student-a", READ_ONLY);
  const ownBooking = await service.givenBookingOwnedBy("student-a");

  const response = await service.request(
    "POST",
    `/v1/bookings/${ownBooking.id}/cancellation`,
    { token: readOnlyToken, body: { reason: "changed my mind" } }
  );

  // 403 and not 404: the caller is identified and under-permitted. The
  // booking is theirs, so ownership was never the problem.
  assert.equal(response.status, 403);

  // RFC 6750: the refusal names the scope the client should ask for next.
  assert.match(
    response.headers.get("www-authenticate"),
    /error="insufficient_scope"/
  );
  assert.match(response.headers.get("www-authenticate"), /scope="bookings:write"/);

  // And nothing happened to the booking.
  const row = await service.readBookingRow(ownBooking.id);
  assert.equal(row.status, "confirmed");
});

test("a token carrying no booking scopes cannot list bookings", async () => {
  const courtsOnly = await signInAs("student-a", ["courts:read"]);

  const response = await service.request("GET", "/v1/bookings", {
    token: courtsOnly
  });

  assert.equal(response.status, 403);
  assert.match(response.headers.get("www-authenticate"), /scope="bookings:read"/);
});

test("the scope refusal happens before any object is loaded", async () => {
  const courtsOnly = await signInAs("student-a", ["courts:read"]);

  // An id that was never issued. If the handler were loading the booking
  // before checking the scope, this would be a 404 — the absence of the row
  // would have been allowed to decide the answer. It must be 403: at this
  // layer the service has not yet looked, and does not need to.
  const response = await service.request("GET", "/v1/bookings/bkg_neverIssued", {
    token: courtsOnly
  });

  assert.equal(response.status, 403);
});

test("the 403 body is Problem Details and names the missing scope", async () => {
  const courtsOnly = await signInAs("student-a", ["courts:read"]);

  const response = await service.request("GET", "/v1/bookings", {
    token: courtsOnly
  });

  assert.match(
    response.headers.get("content-type"),
    /application\/problem\+json/
  );
  assert.ok(response.body.type.endsWith("/insufficient-scope"));
  assert.equal(response.body.status, 403);
  assert.deepEqual(response.body.requiredScopes, ["bookings:read"]);
});
