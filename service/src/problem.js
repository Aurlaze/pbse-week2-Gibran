// The single function that produces every failure response for this API (A.6.1).

const BASE = "https://api.example.com/problems";


const TITLES = {
  "malformed-request": "The request could not be parsed",
  "not-found": "Resource not found",
  "validation-failed": "One or more fields are invalid",
  "court-slot-unavailable": "The badminton court is not available for this time slot",
  "idempotency-key-reuse": "That idempotency key was already used for a different request",
  "illegal-transition": "That status change is not permitted",
  "internal-error": "An unexpected error occurred"
};

function problem(res, status, slug, options = {}) {
  const { detail, ...extensions } = options;

  if (!TITLES[slug]) {
    // A slug with no registered title is a programming error, not a client
    // error. Fail loudly in the log rather than shipping an untitled problem.
    console.error(`problem(): unregistered slug "${slug}"`);
  }

  return res
    .status(status)
    .type("application/problem+json")
    .json({
      ...extensions,
      type: `${BASE}/${slug}`,
      title: TITLES[slug] || TITLES["internal-error"],
      status,
      ...(detail ? { detail } : {}),
      // Ties this response to the matching server log line (A.6.3).
      instance: `urn:request:${res.req?.id ?? "unknown"}`
    });
}

module.exports = {
  problem,
  TITLES
};
