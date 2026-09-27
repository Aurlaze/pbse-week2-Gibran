// A.8 — conditional writes.
//
// The failure being prevented is the lost update: two people read the same
// booking, both act, and the second write silently overwrites the first
// with no sign that anything was lost. Nothing errors, nothing is logged,
// and one person's work is simply gone.
//
// The ordering matters as much as the rule. The precondition is checked
// after the authorisation checks, so a caller with no right to a booking
// still gets the identical 404 and never learns it exists.

const test = require("node:test");
const assert = require("node:assert/strict");

const { startTestService, signInAs, SCOPES } = require("../helpers/harness");

let service;
let token;

// A subject of this file's own. Test files run in parallel processes
// against one database, so a booking created here would otherwise appear
// in — and change the ETag of — the collection that reads.test.js is
// asserting is stable.
const OWNER = "student-writes";
const OTHER = "student-writes-other";

test.before(async () => {
  service = await startTestService();
  token = await signInAs(OWNER, SCOPES.student);
});

test.after(async () => {
  await service.stop();
});

async function readVersion(bookingId, as = token) {
  const response = await service.request("GET", `/v1/bookings/${bookingId}`, {
    token: as,
  });

  return response.headers.get("etag");
}

test("a write with no precondition is refused with 428", async () => {
  // With no If-Match the service has no basis on which to refuse a write
  // that overwrites somebody else's change, so it declines to guess.
  const booking = await service.givenBookingOwnedBy(OWNER);

  const response = await service.request(
    "POST",
    `/v1/bookings/${booking.id}/cancellation`,
    { token, body: { reason: "No precondition" } }
  );

  assert.equal(response.status, 428);
  assert.match(response.body.type, /precondition-required/);

  // Nothing was written.
  const row = await service.readBookingRow(booking.id);
  assert.equal(row.status, "confirmed");
});

test("a write carrying the current version succeeds", async () => {
  const booking = await service.givenBookingOwnedBy(OWNER);
  const version = await readVersion(booking.id);

  const response = await service.request(
    "POST",
    `/v1/bookings/${booking.id}/cancellation`,
    {
      token,
      body: { reason: "Changed my mind" },
      headers: { "If-Match": version },
    }
  );

  assert.equal(response.status, 201);

  const row = await service.readBookingRow(booking.id);
  assert.equal(row.status, "cancelled");
});

test("two windows, one booking: the second is refused with 412", async () => {
  // The scenario from the assignment, and the one demonstrated at Session
  // 7. Both windows read the same version, both press the same button.
  const booking = await service.givenBookingOwnedBy(OWNER);

  const windowOne = await readVersion(booking.id);
  const windowTwo = await readVersion(booking.id);

  assert.equal(windowOne, windowTwo, "both windows read the same version");

  const first = await service.request(
    "POST",
    `/v1/bookings/${booking.id}/cancellation`,
    {
      token,
      body: { reason: "Cancelled in the first window" },
      headers: { "If-Match": windowOne },
    }
  );

  assert.equal(first.status, 201);

  const second = await service.request(
    "POST",
    `/v1/bookings/${booking.id}/cancellation`,
    {
      token,
      body: { reason: "Cancelled in the second window" },
      headers: { "If-Match": windowTwo },
    }
  );

  // Somebody else got there first. Without the precondition this would
  // have been a second successful write, overwriting the first reason with
  // no sign that anything had happened.
  assert.equal(second.status, 412);
  assert.match(second.body.type, /precondition-failed/);
});

test("a 412 says what the current version is, so the client can recover", async () => {
  const booking = await service.givenBookingOwnedBy(OWNER);
  const stale = await readVersion(booking.id);

  await service.request("POST", `/v1/bookings/${booking.id}/cancellation`, {
    token,
    body: { reason: "First" },
    headers: { "If-Match": stale },
  });

  const refused = await service.request(
    "POST",
    `/v1/bookings/${booking.id}/cancellation`,
    {
      token,
      body: { reason: "Second" },
      headers: { "If-Match": stale },
    }
  );

  assert.equal(refused.status, 412);

  // The current tag comes back, so a client can re-read and re-render
  // without a second round trip to discover what it missed.
  assert.ok(refused.headers.get("etag"));
  assert.notEqual(refused.headers.get("etag"), stale);
});

test("a refused write changes nothing", async () => {
  // A 412 is a refusal, not a partial application. The first reason must
  // survive intact.
  const booking = await service.givenBookingOwnedBy(OWNER);
  const version = await readVersion(booking.id);

  await service.request("POST", `/v1/bookings/${booking.id}/cancellation`, {
    token,
    body: { reason: "The reason that must survive" },
    headers: { "If-Match": version },
  });

  await service.request("POST", `/v1/bookings/${booking.id}/cancellation`, {
    token,
    body: { reason: "The reason that must not be written" },
    headers: { "If-Match": version },
  });

  const row = await service.readBookingRow(booking.id);

  assert.equal(row.cancel_reason, "The reason that must survive");
});

test("the precondition never leaks that somebody else's booking exists", async () => {
  // Checked AFTER authorisation. If it ran first, a 428 or 412 would tell
  // this student that the other student's booking is real — the exact thing the
  // identical 404 exists to hide.
  const bookingOfOther = await service.givenBookingOwnedBy(OTHER);

  const noPrecondition = await service.request(
    "POST",
    `/v1/bookings/${bookingOfOther.id}/cancellation`,
    { token, body: { reason: "probing" } }
  );

  const wrongPrecondition = await service.request(
    "POST",
    `/v1/bookings/${bookingOfOther.id}/cancellation`,
    {
      token,
      body: { reason: "probing" },
      headers: { "If-Match": '"a-version-that-is-not-real"' },
    }
  );

  assert.equal(noPrecondition.status, 404);
  assert.equal(wrongPrecondition.status, 404);
});

test("a missing scope still answers 403, not 428", async () => {
  // Layer 2 runs before the handler, so an under-permitted caller is told
  // about the scope they lack rather than about a header they omitted.
  const readOnly = await signInAs(OWNER, ["courts:read", "bookings:read"]);
  const booking = await service.givenBookingOwnedBy(OWNER);

  const response = await service.request(
    "POST",
    `/v1/bookings/${booking.id}/cancellation`,
    { token: readOnly, body: { reason: "no write scope" } }
  );

  assert.equal(response.status, 403);
});

test("an invalid body is still a 400, before any precondition talk", async () => {
  const booking = await service.givenBookingOwnedBy(OWNER);

  const response = await service.request(
    "POST",
    `/v1/bookings/${booking.id}/cancellation`,
    { token, body: { reason: "" } }
  );

  assert.equal(response.status, 400);
});

test("If-Match: * writes against whatever version is current", async () => {
  // The escape hatch for a caller that means "this exists, and I do not
  // care which version" — a cleanup job, say. Still explicit, still a
  // precondition, so it is a decision rather than an omission.
  const booking = await service.givenBookingOwnedBy(OWNER);

  const response = await service.request(
    "POST",
    `/v1/bookings/${booking.id}/cancellation`,
    {
      token,
      body: { reason: "Cancelled by a job" },
      headers: { "If-Match": "*" },
    }
  );

  assert.equal(response.status, 201);
});
