// The one place this service writes a log line.
//
// Step 9 of the Session 4 handout: a token must never reach an application
// log, an error report, an analytics event or a URL. The way to get that is
// to redact at the logging boundary rather than to remember it at each call
// site — a rule enforced in one file holds for code nobody has written yet,
// and a rule remembered per call site fails the first time somebody logs a
// whole request object.
//
// `redact` below therefore names the paths that carry a credential, not the
// places we happen to log today.

const pino = require("pino");

const logger = pino({
  level: process.env.LOG_LEVEL || "info",

  redact: {
    paths: [
      // The access token. This is the one that matters.
      "req.headers.authorization",
      "headers.authorization",

      // Session and refresh cookies are credentials too, in both directions.
      "req.headers.cookie",
      "headers.cookie",
      "res.headers['set-cookie']",

      // Belt and braces: anything a future call site names like a token.
      "token",
      "accessToken",
      "refreshToken",
      "password"
    ],
    censor: "[redacted]"
  },

  // Never the whole request object: the method, the path, the status and the
  // correlation id are what a report can be matched against. Headers are not
  // on that list, and neither is the body.
  serializers: {
    req(req) {
      return { id: req.id, method: req.method, url: req.originalUrl || req.url };
    },
    res(res) {
      return { statusCode: res.statusCode };
    }
  }
});

module.exports = logger;
