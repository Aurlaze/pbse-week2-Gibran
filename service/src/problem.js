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
  "internal-error": "An unexpected error occurred",
  "unauthenticated": "Authentication required",
  "insufficient-scope": "Insufficient scope"
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

// RFC 6750 requires a WWW-Authenticate header on a refused Bearer request,
// and openapi.yaml documents one on both the 401 and the 403. These two
// helpers are the only places it is set, so the header cannot drift away
// from the status it accompanies.

// Layer 1 refused the request: there was no token, or it could not be
// verified. The client's move is to obtain a fresh token and retry.
function unauthorized(res, error = "invalid_token") {
  res.set("WWW-Authenticate", `Bearer error="${error}"`);
  return problem(res, 401, "unauthenticated");
}

// Layer 2 refused it: the token verified, but it does not carry the scope
// this operation requires. The header names the missing scope so the client
// knows what to ask for next time. Retrying with the same token is pointless.
//
// Naming the scope here leaks nothing: the refusal was decided entirely by
// the contents of the caller's own token, without loading a single object.
function forbidden(res, needed) {
  const scopes = Array.isArray(needed) ? needed : [needed];

  res.set(
    "WWW-Authenticate",
    `Bearer error="insufficient_scope", scope="${scopes.join(" ")}"`
  );

  return problem(res, 403, "insufficient-scope", {
    detail: `This operation requires the ${scopes.join(" ")} scope`,
    requiredScopes: scopes
  });
}

module.exports = {
  problem,
  unauthorized,
  forbidden,
  TITLES
};
