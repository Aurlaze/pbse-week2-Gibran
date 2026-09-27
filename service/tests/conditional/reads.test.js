// A.7 — conditional reads.
//
// The behaviour a polling client depends on: an ETag that identifies this
// exact representation, a 304 when nothing has changed, and a fresh tag the
// moment it does. A service that returns a new tag on every request looks
// correct and saves nothing; one that returns a stale tag after a write
// hides the change. Both are tested here.

const test = require("node:test");
const assert = require("node:assert/strict");

const { startTestService, signInAs, SCOPES } = require("../helpers/harness");

let service;
let token;

test.before(async () => {
  service = await startTestService();
  token = await signInAs("student-a", SCOPES.student);
});

test.after(async () => {
  await service.stop();
});

test("a collection carries an ETag", async () => {
  const response = await service.request("GET", "/v1/bookings", { token });

  assert.equal(response.status, 200);
  assert.ok(response.headers.get("etag"), "no ETag on the collection");
});

test("the same unchanged collection answers 304 with no body", async () => {
  const first = await service.request("GET", "/v1/bookings", { token });
  const etag = first.headers.get("etag");

  const second = await service.request("GET", "/v1/bookings", {
    token,
    headers: { "If-None-Match": etag },
  });

  assert.equal(second.status, 304);

  // What a 304 saves is the body on the wire. The service still had to do
  // the work of deciding what the current version was.
  assert.equal(second.text, "");

  // Repeated so the client may refresh what it holds from this response.
  assert.equal(second.headers.get("etag"), etag);
});

test("the tag is stable across repeated reads of unchanged data", async () => {
  // A tag regenerated per request — from a timestamp, say — would never
  // produce a 304 and the poll would save nothing at all.
  const a = await service.request("GET", "/v1/bookings", { token });
  const b = await service.request("GET", "/v1/bookings", { token });

  assert.equal(a.headers.get("etag"), b.headers.get("etag"));
});

test("a write changes the tag, and the next poll sees the new data", async () => {
  const booking = await service.givenBookingOwnedBy("student-a");

  const before = await service.request("GET", "/v1/bookings", { token });
  const staleTag = before.headers.get("etag");

  await service.request("POST", `/v1/bookings/${booking.id}/cancellation`, {
    token,
    body: { reason: "Changed my mind" },
  });

  const after = await service.request("GET", "/v1/bookings", {
    token,
    headers: { "If-None-Match": staleTag },
  });

  // Not 304: the list is genuinely different now, and answering 304 here
  // would leave the client showing a cancelled booking as confirmed.
  assert.equal(after.status, 200);
  assert.notEqual(after.headers.get("etag"), staleTag);
});

test("a single booking carries an ETag too", async () => {
  // This is the tag a conditional write sends back in If-Match (A.8).
  const booking = await service.givenBookingOwnedBy("student-a");

  const response = await service.request("GET", `/v1/bookings/${booking.id}`, {
    token,
  });

  assert.equal(response.status, 200);
  assert.ok(response.headers.get("etag"));
});

test("two students' lists never share a tag", async () => {
  // The tag is derived from the representation, and each student's
  // representation is their own. A shared tag would mean one student could
  // learn that another's list matched theirs.
  const tokenB = await signInAs("student-b", SCOPES.student);

  await service.givenBookingOwnedBy("student-a");

  const a = await service.request("GET", "/v1/bookings", { token });
  const b = await service.request("GET", "/v1/bookings", { token: tokenB });

  assert.notEqual(a.headers.get("etag"), b.headers.get("etag"));
});

test("a per-student collection is not cacheable by a shared cache", async () => {
  const response = await service.request("GET", "/v1/bookings", { token });
  const cacheControl = response.headers.get("cache-control");

  assert.match(cacheControl, /private/);
  assert.match(cacheControl, /no-cache/);
});

test("If-None-Match: * answers 304 for a representation that exists", async () => {
  const response = await service.request("GET", "/v1/courts", {
    token,
    headers: { "If-None-Match": "*" },
  });

  assert.equal(response.status, 304);
});

test("a tag the client does not hold is answered with the full body", async () => {
  const response = await service.request("GET", "/v1/courts", {
    token,
    headers: { "If-None-Match": '"not-the-current-version"' },
  });

  assert.equal(response.status, 200);
  assert.ok(response.body.items);
});
