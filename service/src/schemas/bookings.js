
// (A.4.2).

// NewBooking.courtId -> pattern '^crt_[A-Za-z0-9]{3,}$'
const COURT_ID_PATTERN = /^crt_[A-Za-z0-9]{3,}$/;

// Idempotency-Key -> "a version-4 UUID with hyphens"
const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidIdempotencyKey(key) {
  return typeof key === "string" && UUID_V4_PATTERN.test(key);
}

// format: date-time -> RFC 3339. Date.parse accepts some inputs RFC 3339 does
// not, so the shape is checked explicitly before parsing.
const RFC3339_PATTERN =
  /^\d{4}-\d{2}-\d{2}[Tt]\d{2}:\d{2}:\d{2}(\.\d+)?([Zz]|[+-]\d{2}:\d{2})$/;

function isValidDateTime(value) {
  return (
    typeof value === "string" &&
    RFC3339_PATTERN.test(value) &&
    !Number.isNaN(Date.parse(value))
  );
}


 // Validates a NewBooking request body against the documented schema.


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

  return {
    ok: true,
    data: {
      courtId: body.courtId,
      startTime: body.startTime,
      endTime: body.endTime
    }
  };
}

module.exports = {
  parseNewBooking,
  isValidIdempotencyKey
};
