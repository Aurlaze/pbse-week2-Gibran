const { problem } = require("../problem");

function requireScope(...needed) {
  return (req, res, next) => {
    if (!req.principal) {
      return problem(res, 401, "unauthenticated");
    }

    const hasAllScopes = needed.every((scope) =>
      req.principal.scopes.includes(scope)
    );

    if (!hasAllScopes) {
      return problem(res, 403, "insufficient_scope");
    }

    return next();
  };
}

module.exports = requireScope;
