const { verifyAccessToken } = require("./verify");
const { buildPrincipal } = require("./principal");
const { problem } = require("../problem");

async function authenticate(req, res, next) {
  const authorization = req.get("Authorization");

  if (!authorization) {
    req.principal = null;
    return next();
  }

  if (!authorization.startsWith("Bearer ")) {
    return problem(res, 401, "unauthenticated");
  }

  const token = authorization.slice("Bearer ".length).trim();

  if (!token) {
    return problem(res, 401, "unauthenticated");
  }

  try {
    const claims = await verifyAccessToken(token);
    req.principal = buildPrincipal(claims);
    return next();
  } catch (err) {
    console.error("Token verification failed:", err.code || err.message);
    return problem(res, 401, "unauthenticated");
  }
}

module.exports = authenticate;
