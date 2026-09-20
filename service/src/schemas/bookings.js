// Validation rules copied from openapi.yaml.

const COURT_ID_PATTERN = /^crt_[A-Za-z0-9]{3,}$/;

// The contract requires a version-4 UUID with hyphens.
const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidIdempotencyKey(key) {
  return typeof key === "string" && UUID_V4_PATTERN.test(key);
}

// Date.parse accepts some inputs RFC 3339 does not, so check the shape first.
const RFC3339_PATTERN =
  /^\d{4}-\d{2}-\d{2}[Tt]\d{2}:\d{2}:\d{2}(\.\d+)?([Zz]|[+-]\d{2}:\d{2})$/;

function isValidDateTime(value) {
  return (
    typeof value === "string" &&
    RFC3339_PATTERN.test(value) &&
    !Number.isNaN(Date.parse(value))
  );
}

// Per-field shape only. Cross-field rules are 422s and belong in the handler.
function parseNewBooking(body) {
  const invalidFields = [];

  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, invalidFields: ["body"] };
  }

  if (!COURT_ID_PATTERN.test(body.courtId ?? "")) {
    invalidFields.push("courtId");
  }

  if (!isValidDateTime(body.startTime)) {
    invalidFields.push("startTime");
  }

  if (!isValidDateTime(body.endTime)) {
    invalidFields.push("endTime");
  }

  if (invalidFields.length > 0) {
    return { ok: false, invalidFields };
  }

  // Normalised to UTC. RFC 3339 allows offsets up to +/-23:59, but Postgres
  // rejects anything beyond +/-15:59, and the offset is only notation: the
  // instant is what gets stored.
  return {
    ok: true,
    data: {
      courtId: body.courtId,
      startTime: new Date(body.startTime).toISOString(),
      endTime: new Date(body.endTime).toISOString()
    }
  };
}

// Control characters, NUL included. A NUL byte cannot be stored in a
// Postgres text column at all: the driver sends it, the server refuses the
// whole statement, and the handler that was merely passing a string along
// ends up answering 500 to a request that was never valid in the first
// place. Rejecting it here makes that a 400, which is what it always was.
const CONTROL_CHARACTERS = /[\u0000-\u001F\u007F]/;

const REASON_MAX_LENGTH = 500;

// Matches the cancellation requestBody in openapi.yaml.
function parseCancellation(body) {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, invalidFields: ["body"] };
  }

  const { reason } = body;

  if (typeof reason !== "string") {
    return { ok: false, invalidFields: ["reason"] };
  }

  const trimmed = reason.trim();

  if (
    trimmed === "" ||
    trimmed.length > REASON_MAX_LENGTH ||
    CONTROL_CHARACTERS.test(trimmed)
  ) {
    return { ok: false, invalidFields: ["reason"] };
  }

  return { ok: true, data: { reason: trimmed } };
}

module.exports = {
  parseNewBooking,
  parseCancellation,
  isValidIdempotencyKey,
  REASON_MAX_LENGTH
};
