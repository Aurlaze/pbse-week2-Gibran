const { problem } = require("../problem");

// No route matched. Without this, Express answers with an HTML page, which is
// not a shape any client of this API can parse.
function notFoundHandler(req, res) {
  return problem(res, 404, "not-found", {
    detail: `No route matches ${req.method} ${req.path}`
  });
}

// Registered last, after every route (A.6.3). Full detail goes to the log;
// the response body carries nothing internal.
function globalErrorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  // express.json() rejects a malformed body here. The contract calls that a
  // 400, not a 500 - the request could not be read as promised.
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

  // No message, no stack, no SQL, no hostname - only the documented shape.
  return problem(res, 500, "internal-error");
}

module.exports = {
  notFoundHandler,
  globalErrorHandler
};
