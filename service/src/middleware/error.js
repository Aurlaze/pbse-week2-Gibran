const { problem } = require("../problem");
const logger = require("../logger");

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
    logger.warn(
      {
        requestId: req.id,
        method: req.method,
        url: req.originalUrl
      },
      "malformed JSON body"
    );
    return problem(res, 400, "malformed-request", {
      detail: "Request body is not valid JSON"
    });
  }

  // The method, the path, the status and the correlation id — never the
  // request object itself. Logging `req` here would put the Authorization
  // header into the log on the one code path that fires when something has
  // already gone wrong, which is the worst possible moment to leak a token.
  logger.error(
    {
      requestId: req.id,
      method: req.method,
      url: req.originalUrl,
      err: { message: err.message, stack: err.stack }
    },
    "unhandled error"
  );

  // Detail goes to the log; the body carries nothing internal.
  return problem(res, 500, "internal-error");
}

module.exports = {
  notFoundHandler,
  globalErrorHandler
};
