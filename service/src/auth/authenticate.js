// Layer 1 — authentication. Answers one question: who sent this request?
//
// It decides nothing about permissions. A request arriving here either
// carries a token this service can verify, or it does not; what the caller
// is then allowed to do is Layer 2's question, and which objects they may
// touch is Layer 3's.

const { verifyAccessToken } = require("./verify");
const { buildPrincipal } = require("./principal");
const { unauthorized } = require("../problem");
const logger = require("../logger");

async function authenticate(req, res, next) {
  const authorization = req.get("Authorization");

  // Anonymous, not refused. /health is served above this middleware, and
  // every /v1 route sits behind requireScope, which turns a null principal
  // into a 401. Refusing here instead would make this file decide policy.
  if (!authorization) {
    req.principal = null;
    return next();
  }

  if (!authorization.startsWith("Bearer ")) {
    return unauthorized(res);
  }

  const token = authorization.slice("Bearer ".length).trim();

  if (!token) {
    return unauthorized(res);
  }

  try {
    const claims = await verifyAccessToken(token);
    req.principal = buildPrincipal(claims);
    return next();
  } catch (err) {
    // The reason for the refusal is logged. The token never is — not even
    // a prefix of it, which is still a usable fraction of a credential.
    logger.warn(
      { requestId: req.id, reason: err.code || err.name },
      "token rejected"
    );
    return unauthorized(res);
  }
}

module.exports = authenticate;
