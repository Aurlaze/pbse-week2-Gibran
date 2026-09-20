// Layer 2 — the scope check. Compares the scopes in the caller's token with
// the scope openapi.yaml states on this operation.
//
// It runs as middleware, before the handler, so the refusal happens before
// any object is loaded from the database. That ordering is what makes the
// 403 here safe: the answer is decided entirely by the contents of the
// caller's own token, so it cannot reveal whether any particular record
// exists. Whether the caller may touch a *specific* object is Layer 3's
// question, answered inside the handler with a 404.

const { unauthorized, forbidden } = require("../problem");

function requireScope(...needed) {
  return (req, res, next) => {
    // No verified token reached us. Not an authorisation failure — the
    // caller has not been identified at all, so 401 and not 403.
    if (!req.principal) {
      return unauthorized(res);
    }

    const missing = needed.filter(
      (scope) => !req.principal.scopes.includes(scope)
    );

    // Identified, and under-permitted. Retrying with this token will not
    // help; the client needs a token carrying the named scope.
    if (missing.length > 0) {
      return forbidden(res, missing);
    }

    return next();
  };
}

module.exports = requireScope;
