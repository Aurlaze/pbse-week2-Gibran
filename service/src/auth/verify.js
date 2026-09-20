const { createRemoteJWKSet, jwtVerify } = require("jose");
const config = require("../config");

const JWKS = createRemoteJWKSet(new URL(config.oidcJwksUri));

async function verifyAccessToken(token) {
  const { payload } = await jwtVerify(token, JWKS, {
    issuer: config.oidcIssuer,
    audience: config.oidcAudience,

    // An allowlist, not a preference. Without it a token could arrive
    // signed with "none", or with a symmetric algorithm whose "key" is the
    // public key everybody already has.
    algorithms: ["RS256"],

    // Five seconds of clock skew between this host and the authorisation
    // server, so a freshly issued token is not refused as not-yet-valid.
    clockTolerance: 5
  });

  return payload;
}

module.exports = {
  verifyAccessToken,
};
