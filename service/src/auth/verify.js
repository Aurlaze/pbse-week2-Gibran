const { createRemoteJWKSet, jwtVerify } = require("jose");
const config = require("../config");

const JWKS = createRemoteJWKSet(new URL(config.oidcJwksUri));

async function verifyAccessToken(token) {
  const { payload } = await jwtVerify(token, JWKS, {
    issuer: config.oidcIssuer,
    audience: config.oidcAudience,
    algorithms: ["RS256"],
  });

  return payload;
}

module.exports = {
  verifyAccessToken,
};
