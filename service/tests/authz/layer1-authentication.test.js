// Layer 1 — authentication.
//
// The extra test Step 11b asks for beyond the four boundaries: a request
// with no Authorization header is refused, and so is one whose payload has
// been edited.
//
// The edited-payload case is the one worth having. If it passes with a 200,
// anybody can mint themselves any subject and any scope they like by editing
// a token they already hold, and every other test in this directory is
// meaningless.

const test = require("node:test");
const assert = require("node:assert/strict");

const { startTestService, signInAs, SCOPES } = require("../helpers/harness");
const { tokenFor, withEditedPayload } = require("../helpers/tokens");

let service;

test.before(async () => {
  service = await startTestService();
});

test.after(async () => {
  await service.stop();
});

test("a request with no Authorization header is refused", async () => {
  const response = await service.request("GET", "/v1/bookings");

  assert.equal(response.status, 401);
  assert.equal(
    response.headers.get("www-authenticate"),
    'Bearer error="invalid_token"'
  );
});

test("a token with an edited payload is refused", async () => {
  const honest = await signInAs("student-a", SCOPES.student);
  const forged = withEditedPayload(honest);

  // The forgery is well-formed: three segments, decodable, and it claims a
  // different subject. Only the signature gives it away.
  assert.equal(forged.split(".").length, 3);
  assert.notEqual(forged, honest);

  const response = await service.request("GET", "/v1/bookings", {
    token: forged
  });

  assert.equal(response.status, 401);
});

test("a token that is not a JWT at all is refused", async () => {
  const response = await service.request("GET", "/v1/bookings", {
    token: "not-a-token"
  });

  assert.equal(response.status, 401);
});

test("a token issued for a different audience is refused", async () => {
  // A token from the same authorisation server, correctly signed, but minted
  // for another API in the same realm. Without the audience check this
  // service would accept it.
  const otherApi = await tokenFor("student-a", SCOPES.student, {
    audience: "some-other-api"
  });

  const response = await service.request("GET", "/v1/bookings", {
    token: otherApi
  });

  assert.equal(response.status, 401);
});

test("an expired token is refused", async () => {
  const expired = await tokenFor("student-a", SCOPES.student, {
    expiresIn: "-1m"
  });

  const response = await service.request("GET", "/v1/bookings", {
    token: expired
  });

  assert.equal(response.status, 401);
});

test("the health check stays public", async () => {
  // The one operation carrying `security: []` on the contract. The hosting
  // platform calls it with no token, so a change that put it behind the
  // authentication middleware would take the deployment down.
  for (const path of ["/health", "/v1/health"]) {
    const response = await service.request("GET", path);
    assert.equal(response.status, 200, `${path} must stay public`);
    assert.equal(response.body.status, "ok");
  }
});

test("no response ever echoes the token back", async () => {
  const honest = await signInAs("student-a", SCOPES.student);

  const responses = [
    await service.request("GET", "/v1/bookings", { token: honest }),
    await service.request("GET", "/v1/bookings", { token: "not-a-token" }),
    await service.request("GET", "/v1/bookings/bkg_neverIssued", { token: honest })
  ];

  for (const response of responses) {
    assert.ok(
      !response.text.includes(honest),
      "a token must never appear in a response body"
    );
    assert.ok(
      !/eyJ[A-Za-z0-9_-]{10,}/.test(response.text),
      "nothing JWT-shaped may appear in a response body"
    );
  }
});
