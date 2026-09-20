// A signing key that exists only inside the test process.
//
// Step 11a of the Session 4 handout offers two ways for tests to obtain a
// token. This is the first one: the tests generate their own key pair and
// serve its JWKS from a tiny HTTP server, and OIDC_ISSUER / OIDC_JWKS_URI
// point there while the tests run. CI therefore needs no network access to
// Keycloak, and nothing here is flaky because a container was slow to start.
//
// OIDC_ISSUER under test is a test-only value, so a token minted here can
// never be accepted by a real running service. This key is never used
// anywhere else and never leaves the process that generated it.

const { createServer } = require("node:http");
const { generateKeyPair, exportJWK, SignJWT } = require("jose");

const ALG = "RS256";
const KID = "test-key";

let keyPairPromise = null;

// One key pair per process. Generating a 2048-bit RSA pair is slow enough
// that doing it per token would dominate the runtime of the suite.
function keys() {
  if (!keyPairPromise) {
    keyPairPromise = generateKeyPair(ALG, { extractable: true });
  }
  return keyPairPromise;
}

async function publicJwks() {
  const { publicKey } = await keys();
  const jwk = await exportJWK(publicKey);
  return { keys: [{ ...jwk, kid: KID, alg: ALG, use: "sig" }] };
}

// Listens on 127.0.0.1 only. Port 0 asks the OS for a free port, which is
// what the test suite wants; CI pins a port so the service can be pointed
// at it from a separate process.
async function startJwksServer(port = 0) {
  const body = JSON.stringify(await publicJwks());

  const server = createServer((_req, res) => {
    res.setHeader("content-type", "application/json");
    res.end(body);
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });

  const actualPort = server.address().port;

  return {
    server,
    port: actualPort,
    url: `http://127.0.0.1:${actualPort}/jwks.json`,
    async close() {
      await new Promise((resolve) => server.close(resolve));
    }
  };
}

// The claims a Keycloak access token carries that this service reads: sub,
// scope, aud, iss, exp. `azp` is what marks a client-credentials token, so
// passing it is how a test builds a service principal rather than a user one.
async function tokenFor(subject, scopes, options = {}) {
  const {
    issuer = process.env.OIDC_ISSUER,
    audience = process.env.OIDC_AUDIENCE,
    expiresIn = "5m",
    azp
  } = options;

  const { privateKey } = await keys();

  const claims = { scope: scopes.join(" ") };

  if (azp) {
    claims.azp = azp;
  }

  return new SignJWT(claims)
    .setProtectedHeader({ alg: ALG, kid: KID })
    .setIssuer(issuer)
    .setAudience(audience)
    .setSubject(subject)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(privateKey);
}

// Flips one character in the payload segment, leaving the signature alone.
// The result is a well-formed JWT whose signature no longer matches, which
// is the forged token every Layer 1 test must refuse.
function withEditedPayload(token) {
  const [header, payload, signature] = token.split(".");
  const decoded = Buffer.from(payload, "base64url").toString("utf8");
  const tampered = decoded.replace(/"sub":"[^"]*"/, '"sub":"attacker"');
  return [header, Buffer.from(tampered).toString("base64url"), signature].join(".");
}

module.exports = {
  ALG,
  KID,
  publicJwks,
  startJwksServer,
  tokenFor,
  withEditedPayload
};
