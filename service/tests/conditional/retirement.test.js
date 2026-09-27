// POST /v1/courts/{courtId}/retirement — the operation the contract has
// documented since Session 2 and the service did not implement.
//
// It is tested here rather than in tests/authz/ because every interesting
// case is a conditional one: retirement is terminal, so the question is
// always "is this the version you read, and is it still active?"

const test = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");

const { startTestService, signInAs, SCOPES } = require("../helpers/harness");

let service;
let adminToken;
let studentToken;

// Courts of this file's own. The harness's shared fixture court is used by
// the other suites, and retiring it would take them with it.
const pool = require("../../src/store/db");
const createdCourts = [];

async function givenActiveCourt() {
  const id = `crt_${randomUUID().replace(/-/g, "").slice(0, 12)}`;

  await pool.query(
    `INSERT INTO courts (id, name, location, court_type, is_available, status)
     VALUES ($1, 'Retirement Test Court', 'Test Hall', 'indoor', true, 'active')`,
    [id]
  );

  createdCourts.push(id);

  return id;
}

async function versionOf(courtId) {
  const read = await service.request("GET", `/v1/courts/${courtId}`, {
    token: studentToken,
  });

  return read.headers.get("etag");
}

test.before(async () => {
  service = await startTestService();
  adminToken = await signInAs("admin-a", SCOPES.admin);
  studentToken = await signInAs("student-r", SCOPES.student);
});

test.after(async () => {
  // A failing assertion must not also leave fixtures behind: every run
  // would otherwise add courts that the listing tests then page through.
  try {
    if (createdCourts.length > 0) {
      await pool.query("DELETE FROM courts WHERE id = ANY($1)", [createdCourts]);
    }
  } catch (err) {
    console.error("court cleanup failed:", err.message);
  }

  await service.stop();
});

test("an administrator retires a court", async () => {
  const courtId = await givenActiveCourt();

  const response = await service.request(
    "POST",
    `/v1/courts/${courtId}/retirement`,
    {
      token: adminToken,
      body: { reason: "Replaced by a newer revision" },
      headers: { "If-Match": await versionOf(courtId) },
    }
  );

  assert.equal(response.status, 201);

  // The Retirement schema: a record of its own, which is what the noun
  // sub-resource buys over a PATCH setting status.
  assert.equal(response.body.courtId, courtId);
  assert.equal(response.body.reason, "Replaced by a newer revision");
  assert.ok(Date.parse(response.body.retiredAt));
});

test("a retired court is no longer available for booking", async () => {
  const courtId = await givenActiveCourt();

  await service.request("POST", `/v1/courts/${courtId}/retirement`, {
    token: adminToken,
    body: { reason: "Out of service" },
    headers: { "If-Match": await versionOf(courtId) },
  });

  const read = await service.request("GET", `/v1/courts/${courtId}`, {
    token: studentToken,
  });

  assert.equal(read.body.status, "retired");
  assert.equal(read.body.isAvailable, false);
});

test("retiring an already retired court is 200, not 409", async () => {
  // The requested end state already holds, so the caller's intent has been
  // satisfied. The existing record comes back.
  const courtId = await givenActiveCourt();

  await service.request("POST", `/v1/courts/${courtId}/retirement`, {
    token: adminToken,
    body: { reason: "The original reason" },
    headers: { "If-Match": await versionOf(courtId) },
  });

  const again = await service.request(
    "POST",
    `/v1/courts/${courtId}/retirement`,
    {
      token: adminToken,
      body: { reason: "A second attempt" },
      headers: { "If-Match": await versionOf(courtId) },
    }
  );

  assert.equal(again.status, 200);

  // The first reason stands. A second retirement does not rewrite history.
  assert.equal(again.body.reason, "The original reason");
});

test("a student holding no courts:write is refused with 403", async () => {
  // A court belongs to nobody in particular, so the scope IS the whole of
  // the permission — which is why 403 and not 404 is right here. The caller
  // is identified and under-permitted, and the court is not a secret.
  const courtId = await givenActiveCourt();

  const response = await service.request(
    "POST",
    `/v1/courts/${courtId}/retirement`,
    {
      token: studentToken,
      body: { reason: "I should not be able to do this" },
      headers: { "If-Match": await versionOf(courtId) },
    }
  );

  assert.equal(response.status, 403);
  assert.match(
    response.headers.get("www-authenticate"),
    /error="insufficient_scope"/
  );
});

test("a court that does not exist is 404", async () => {
  const response = await service.request(
    "POST",
    "/v1/courts/crt_doesNotExist/retirement",
    {
      token: adminToken,
      body: { reason: "nothing to retire" },
      headers: { "If-Match": "*" },
    }
  );

  assert.equal(response.status, 404);
});

test("a write with no precondition is refused with 428", async () => {
  const courtId = await givenActiveCourt();

  const response = await service.request(
    "POST",
    `/v1/courts/${courtId}/retirement`,
    { token: adminToken, body: { reason: "No precondition" } }
  );

  assert.equal(response.status, 428);

  const read = await service.request("GET", `/v1/courts/${courtId}`, {
    token: studentToken,
  });

  assert.equal(read.body.status, "active");
});

test("two administrators, one court: the second is refused with 412", async () => {
  const courtId = await givenActiveCourt();

  const windowOne = await versionOf(courtId);
  const windowTwo = await versionOf(courtId);

  const first = await service.request(
    "POST",
    `/v1/courts/${courtId}/retirement`,
    {
      token: adminToken,
      body: { reason: "Retired by the first administrator" },
      headers: { "If-Match": windowOne },
    }
  );

  assert.equal(first.status, 201);

  const second = await service.request(
    "POST",
    `/v1/courts/${courtId}/retirement`,
    {
      token: adminToken,
      body: { reason: "Retired by the second administrator" },
      headers: { "If-Match": windowTwo },
    }
  );

  assert.equal(second.status, 412);
});

test("an empty reason is a 400 naming the field", async () => {
  const courtId = await givenActiveCourt();

  const response = await service.request(
    "POST",
    `/v1/courts/${courtId}/retirement`,
    {
      token: adminToken,
      body: { reason: "   " },
      headers: { "If-Match": await versionOf(courtId) },
    }
  );

  assert.equal(response.status, 400);
  assert.deepEqual(
    response.body["invalid-params"].map((p) => p.name),
    ["reason"]
  );
});

test("a reason carrying a NUL byte is a 400, not a 500", async () => {
  // Postgres refuses a NUL in a text column outright, so a handler that
  // merely passed the string along would answer 500 to a request that was
  // never valid.
  const courtId = await givenActiveCourt();

  const response = await service.request(
    "POST",
    `/v1/courts/${courtId}/retirement`,
    {
      token: adminToken,
      body: { reason: "has a \u0000 nul byte" },
      headers: { "If-Match": await versionOf(courtId) },
    }
  );

  assert.equal(response.status, 400);
});
