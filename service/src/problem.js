// The single function that produces every failure response.

const BASE = "https://api.example.com/problems";

// One fixed title per slug, so clients can branch on type rather than wording.
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
      instance: `urn:request:${res.req?.id ?? "unknown"}`
    });
}

module.exports = {
  problem,
  TITLES
};
