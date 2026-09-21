// Layer 3 — object-level authorisation.
//
// Every test here uses a token that is valid and carries the right scope.
// The only thing standing between the caller and another person's booking is
// the ownership check inside the handler. Delete that check and all of these
// go red; that is what they are for.

const test = require("node:test");
const assert = require("node:assert/strict");

const { startTestService, signInAs, SCOPES } = require("../helpers/harness");

let service;

test.before(async () => {
  service = await startTestService();
});

test.after(async () => {
  await service.stop();
});

// ---------------------------------------------------------------------
// Boundary 1 — a student reads another student's booking.
// ---------------------------------------------------------------------
test("a student cannot read another student's booking", async () => {
  const tokenA = await signInAs("student-a", SCOPES.student);
  const bookingOfB = await service.givenBookingOwnedBy("student-b");

  const response = await service.request("GET", `/v1/bookings/${bookingOfB.id}`, {
    token: tokenA
  });

  // 404, not 403. A 403 here would confirm the booking exists.
  assert.equal(response.status, 404);

  // The right status is not enough on its own: the body must not carry the
  // booking either.
  assert.equal(response.body.status, 404);
  assert.ok(!("bookedBy" in response.body));
  assert.ok(!("courtId" in response.body));
});

test("'not yours' and 'does not exist' are answered identically", async () => {
  const tokenA = await signInAs("student-a", SCOPES.student);
  const bookingOfB = await service.givenBookingOwnedBy("student-b");

  const notYours = await service.request("GET", `/v1/bookings/${bookingOfB.id}`, {
    token: tokenA
  });
  const absent = await service.request("GET", "/v1/bookings/bkg_neverIssued", {
    token: tokenA
  });

  assert.equal(notYours.status, 404);
  assert.equal(absent.status, 404);

  // This assertion, not the two above, is the real check. Matching statuses
  // with differing bodies leaves the identifiers just as enumerable — the
  // signal simply moves from the status line into the response body.
  //
  // `instance` carries the per-request correlation id and is expected to
  // differ; everything else must be byte-for-byte identical.
  const withoutInstance = (problem) => {
    const { instance, ...rest } = problem;
    return rest;
  };

  assert.deepEqual(withoutInstance(notYours.body), withoutInstance(absent.body));
});

// ---------------------------------------------------------------------
// Boundary 2 — a student cancels another student's booking.
//
// A write. The status alone proves nothing here: a handler that cancelled
// the booking and then answered 404 would pass a status-only assertion while
// having already destroyed somebody's booking.
// ---------------------------------------------------------------------
test("a student cannot cancel another student's booking", async () => {
  const tokenA = await signInAs("student-a", SCOPES.student);
  const bookingOfB = await service.givenBookingOwnedBy("student-b");

  const response = await service.request(
    "POST",
    `/v1/bookings/${bookingOfB.id}/cancellation`,
    { token: tokenA, body: { reason: "not mine to cancel" } }
  );

  assert.equal(response.status, 404);

  // Prove nothing changed.
  const row = await service.readBookingRow(bookingOfB.id);
  assert.equal(row.status, "confirmed");
  assert.equal(row.cancelled_at, null);
  assert.equal(row.cancel_reason, null);
});

// ---------------------------------------------------------------------
// Boundary 4 — the collection.
//
// The constraint belongs inside the query. A handler that selected every
// booking and filtered afterwards would pass the single-object tests above
// and still hand a page of other people's bookings to this caller.
// ---------------------------------------------------------------------
test("a student's booking list contains no other student's bookings", async () => {
  const tokenA = await signInAs("student-a", SCOPES.student);
  const mine = await service.givenBookingOwnedBy("student-a");
  const theirs = await service.givenBookingOwnedBy("student-b");

  // Every page, not just the first. A database that has accumulated rows
  // would otherwise push this test's own booking past the end of page one,
  // and the assertion would start failing for a reason that has nothing to
  // do with authorisation.
  const seen = [];
  let cursor;
  let pages = 0;

  do {
    const path = `/v1/bookings?limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;
    const response = await service.request("GET", path, { token: tokenA });

    assert.equal(response.status, 200);
    seen.push(...response.body.items);
    cursor = response.body.nextCursor;
    pages += 1;
  } while (cursor && pages < 50);

  const ids = seen.map((item) => item.id);
  assert.ok(ids.includes(mine.id), "the caller's own booking should be listed");
  assert.ok(
    !ids.includes(theirs.id),
    "another student's booking must not appear in any page"
  );

  // Nothing returned may belong to anybody else, not merely the one row this
  // test created.
  //
  // A row can legitimately disappear between the page being fetched and this
  // read: the other test files run in their own processes against the same
  // database, and each deletes its own fixtures when it finishes. That is a
  // race in the test, not a defect in the service, so a row that has since
  // been removed is skipped rather than failing the assertion on `null`.
  for (const item of seen) {
    const row = await service.readBookingRow(item.id);

    if (!row) {
      continue;
    }

    assert.equal(
      row.booked_by,
      "student-a",
      `${item.id} was listed for student-a but belongs to ${row.booked_by}`
    );
  }
});

// ---------------------------------------------------------------------
// The positive control.
//
// Without this, every test above would still pass if mayReadBooking were
// replaced by `return false`, and the suite would be proving that the
// service refuses everyone rather than that it refuses the right people.
// ---------------------------------------------------------------------
test("an administrator holding bookings:fulfil can read any booking", async () => {
  const tokenAdmin = await signInAs("staff-1", SCOPES.admin);
  const bookingOfB = await service.givenBookingOwnedBy("student-b");

  const response = await service.request("GET", `/v1/bookings/${bookingOfB.id}`, {
    token: tokenAdmin
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.id, bookingOfB.id);

  // Step 8e: the representation follows the caller's role. An administrator
  // needs to know whose booking this is; the owner does not.
  assert.equal(response.body.bookedBy, "student-b");
});

test("a student reading their own booking is not told who owns it", async () => {
  const tokenB = await signInAs("student-b", SCOPES.student);
  const bookingOfB = await service.givenBookingOwnedBy("student-b");

  const response = await service.request("GET", `/v1/bookings/${bookingOfB.id}`, {
    token: tokenB
  });

  assert.equal(response.status, 200);
  assert.ok(
    !("bookedBy" in response.body),
    "bookedBy is an administrative field and must not reach a student"
  );
});
