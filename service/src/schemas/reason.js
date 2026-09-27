// The free-text "why" carried by the two terminal transitions: cancelling a
// booking and retiring a court. One rule, one place, because they are the
// same rule — and because the control-character case below is the kind of
// thing that gets fixed in one handler and not the other.

const MAX_LENGTH = 500;

// Control characters, NUL included. A NUL byte cannot be stored in a
// Postgres text column at all: the driver sends it, the server refuses the
// whole statement, and the handler that was merely passing a string along
// ends up answering 500 to a request that was never valid in the first
// place. Rejecting it here makes that a 400, which is what it always was.
const CONTROL_CHARACTERS = /[\u0000-\u001F\u007F]/;

const { invalidParam } = require("../problem");

/**
 * @param body     the parsed request body
 * @param missing  what to say when it is absent, in domain terms
 */
function parseReason(body, missing) {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return {
      ok: false,
      invalidParams: [invalidParam("body", "A JSON object is required")]
    };
  }

  const { reason } = body;

  if (typeof reason !== "string" || reason.trim() === "") {
    return { ok: false, invalidParams: [invalidParam("reason", missing)] };
  }

  if (reason.length > MAX_LENGTH) {
    return {
      ok: false,
      invalidParams: [
        invalidParam("reason", `Keep the reason under ${MAX_LENGTH} characters`)
      ]
    };
  }

  if (CONTROL_CHARACTERS.test(reason)) {
    return {
      ok: false,
      invalidParams: [
        invalidParam(
          "reason",
          "The reason contains characters that cannot be stored"
        )
      ]
    };
  }

  return { ok: true, data: { reason: reason.trim() } };
}

module.exports = { parseReason, MAX_LENGTH, CONTROL_CHARACTERS };
