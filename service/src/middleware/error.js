const { problem } = require("../problem");

// Express answers unmatched routes with HTML, which no client of this API can parse.
function notFoundHandler(req, res) {
  return problem(res, 404, "not-found", {
    detail: `No route matches ${req.method} ${req.path}`
  });
}

function globalErrorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  // express.json() rejects a malformed body here, which is a 400 and not a 500.
  if (err.type === "entity.parse.failed" || err instanceof SyntaxError) {
    console.warn(
      JSON.stringify({
        level: "warn",
        requestId: req.id,
        method: req.method,
        url: req.originalUrl,
        message: "malformed JSON body"
      })
    );
    return problem(res, 400, "malformed-request", {
      detail: "Request body is not valid JSON"
    });
  }

  console.error(
    JSON.stringify({
      level: "error",
      requestId: req.id,
      method: req.method,
      url: req.originalUrl,
      message: err.message,
      stack: err.stack
    })
  );

  // Detail goes to the log; the body carries nothing internal.
  return problem(res, 500, "internal-error");
}

module.exports = {
  notFoundHandler,
  globalErrorHandler
};
