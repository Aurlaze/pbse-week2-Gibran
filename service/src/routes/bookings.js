const { createHash, randomUUID } = require("node:crypto");
const express = require("express");

const {
  checkIdempotencyKey,
  saveIdempotencyKey,
  findOverlappingBooking,
  createBooking,
  findBookingById,
  listForPrincipal,
  cancelBooking
} = require("../store/bookings");
const { findCourtById } = require("../store/courts");
const {
  toBookingRepresentation,
  toCancellationRepresentation
} = require("../representations/bookings");
const { parseNewBooking, isValidIdempotencyKey } = require("../schemas/bookings");
const { problem } = require("../problem");
const requireScope = require("../auth/require-scope");
const { mayReadBooking, mayCancelBooking } = require("../auth/ownership");

const router = express.Router();

const BOOKING_ID_PATTERN = /^bkg_[A-Za-z0-9]{3,}$/;

// Lines 3 and 4 of the five-line pattern must be indistinguishable: same
// status, same type, same body. Routing both through one function is how
// that stays true — if the "not yours" branch ever gains a more specific
// message, enumeration works again through the body even though the status
// codes still match.
function notFound(res) {
  return problem(res, 404, "not-found", { detail: "Booking not found" });
}

function newBookingId() {
  return `bkg_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

// Key order must not change the hash, or a retry would look like a reuse.
function hashBody(body) {
  const canonical = JSON.stringify({
    courtId: body.courtId,
    startTime: body.startTime,
    endTime: body.endTime
  });
  return createHash("sha256").update(canonical).digest("hex");
}

router.post(
  "/bookings",
  requireScope("bookings:write"),
  async (req, res) => {
  // Validation
  const idempotencyKey = req.get("Idempotency-Key")?.trim();

  if (!isValidIdempotencyKey(idempotencyKey)) {
    return problem(res, 400, "malformed-request", {
      detail:
        "Idempotency-Key header is required and must be a version-4 UUID with hyphens"
    });
  }

  const parsed = parseNewBooking(req.body);

  if (!parsed.ok) {
    return problem(res, 400, "malformed-request", {
      detail: "One or more fields do not match the documented schema",
      invalidFields: parsed.invalidFields
    });
  }

  const { courtId, startTime, endTime } = parsed.data;

  // Each field is valid on its own, but the pair is unusable.
  if (Date.parse(endTime) <= Date.parse(startTime)) {
    return problem(res, 422, "validation-failed", {
      detail: "endTime must be after startTime",
      invalidFields: ["endTime"]
    });
  }

  // Idempotency, before any consequential work
  const bodyHash = hashBody(parsed.data);
  const existing = await checkIdempotencyKey(idempotencyKey);

  if (existing) {
    if (existing.body_hash !== bodyHash) {
      return problem(res, 409, "idempotency-key-reuse", {
        detail:
          "This Idempotency-Key was already used for a request with a different body"
      });
    }

    const storedBody = JSON.parse(existing.response_body);
    return res
      .status(existing.response_status)
      .location(`/v1/bookings/${storedBody.id}`)
      .json(storedBody);
  }

  // Work
  const court = await findCourtById(courtId);

  if (!court) {
    return problem(res, 422, "validation-failed", {
      detail: `Court ${courtId} does not exist`,
      invalidFields: ["courtId"]
    });
  }

  if (court.status !== "active" || !court.is_available) {
    return problem(res, 409, "court-slot-unavailable", {
      detail: `Court ${courtId} is retired or not available for booking`,
      courtId: court.id,
      status: court.status
    });
  }

  const clash = await findOverlappingBooking(courtId, startTime, endTime);

  if (clash) {
    return problem(res, 409, "court-slot-unavailable", {
      detail: "That court is already booked for an overlapping time slot",
      courtId,
      conflictingBookingId: clash.id
    });
  }

  // The caller's own subject is what makes this booking theirs. It comes
  // from the verified token and never from the request body, so a client
  // cannot create a booking in somebody else's name.
  const booking = await createBooking(
    newBookingId(),
    courtId,
    startTime,
    endTime,
    req.principal.subject
  );

  // Representation
  const representation = toBookingRepresentation(booking, req.principal);

  await saveIdempotencyKey(
    idempotencyKey,
    bodyHash,
    201,
    JSON.stringify(representation)
  );

  // Response
  return res
    .status(201)
    .location(`/v1/bookings/${representation.id}`)
    .json(representation);
});

// ---------------------------------------------------------------------
// GET /v1/bookings — the collection.
//
// There is no ownerId parameter. Who the caller is comes from the token, so
// there is nothing here for a client to change in order to see somebody
// else's page. The constraint is applied inside the SQL; see
// store/bookings.js listForPrincipal.
// ---------------------------------------------------------------------
const LIST_BOOKINGS_PARAMS = ["status", "limit", "cursor"];

router.get("/bookings", requireScope("bookings:read"), async (req, res) => {
  const { status, limit, cursor } = req.query;

  const unknown = Object.keys(req.query).filter(
    (k) => !LIST_BOOKINGS_PARAMS.includes(k)
  );

  if (unknown.length > 0) {
    return problem(res, 400, "malformed-request", {
      detail: `Unknown query parameter: ${unknown.join(", ")}`,
      invalidFields: unknown
    });
  }

  let parsedLimit = 20;

  if (limit !== undefined) {
    parsedLimit = Number(limit);

    if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
      return problem(res, 400, "malformed-request", {
        detail: "Invalid limit value"
      });
    }
  }

  if (status !== undefined && !["confirmed", "cancelled"].includes(status)) {
    return problem(res, 400, "malformed-request", {
      detail: "Invalid status value"
    });
  }

  const decodedCursor =
    cursor === undefined || cursor === ""
      ? undefined
      : Buffer.from(cursor, "base64").toString("utf8");

  // A cursor that does not decode to a booking id names no position, so
  // nothing follows it. Answered here rather than passed to the database,
  // which rejects the arbitrary bytes such a cursor can carry.
  if (decodedCursor !== undefined && !BOOKING_ID_PATTERN.test(decodedCursor)) {
    return res.status(200).json({ items: [] });
  }

  // Work
  const bookings = await listForPrincipal(req.principal, {
    status,
    limit: parsedLimit,
    cursor: decodedCursor
  });

  const hasNextPage = bookings.length > parsedLimit;

  if (hasNextPage) {
    bookings.pop();
  }

  // Representation
  const items = bookings.map((b) => toBookingRepresentation(b, req.principal));

  const nextCursor = hasNextPage
    ? Buffer.from(bookings[bookings.length - 1].id).toString("base64")
    : undefined;

  return res.status(200).json({
    items,
    ...(nextCursor && { nextCursor })
  });
});

// ---------------------------------------------------------------------
// GET /v1/bookings/{bookingId} — the five-line pattern. The order is fixed
// and must not be swapped.
// ---------------------------------------------------------------------
router.get(
  "/bookings/:bookingId",
  requireScope("bookings:read"),
  async (req, res) => {
    const { bookingId } = req.params;

    // 1. validate -> 400
    if (!BOOKING_ID_PATTERN.test(bookingId)) {
      return problem(res, 400, "malformed-request", {
        detail: "Invalid bookingId format"
      });
    }

    // 2. load the object
    const booking = await findBookingById(bookingId);

    // 3. absent -> 404
    if (!booking) {
      return notFound(res);
    }

    // 4. not yours -> identical 404
    if (!mayReadBooking(req.principal, booking)) {
      return notFound(res);
    }

    // 5. representation
    return res.status(200).json(toBookingRepresentation(booking, req.principal));
  }
);

// ---------------------------------------------------------------------
// POST /v1/bookings/{bookingId}/cancellation — the same pattern on a write.
//
// The check runs before anything is stored. A handler that cancelled the
// booking and then returned 404 would be answering correctly about a change
// it had already made.
// ---------------------------------------------------------------------
router.post(
  "/bookings/:bookingId/cancellation",
  requireScope("bookings:write"),
  async (req, res) => {
    const { bookingId } = req.params;

    // 1. validate -> 400
    if (!BOOKING_ID_PATTERN.test(bookingId)) {
      return problem(res, 400, "malformed-request", {
        detail: "Invalid bookingId format"
      });
    }

    const reason = req.body?.reason;

    if (typeof reason !== "string" || reason.trim() === "") {
      return problem(res, 400, "malformed-request", {
        detail: "reason is required and must be a non-empty string",
        invalidFields: ["reason"]
      });
    }

    // 2. load the object
    const booking = await findBookingById(bookingId);

    // 3. absent -> 404
    if (!booking) {
      return notFound(res);
    }

    // 4. not yours -> identical 404, before any write
    if (!mayCancelBooking(req.principal, booking)) {
      return notFound(res);
    }

    // 5. work, then representation.
    //
    // Already cancelled is 200 with the existing record, not 409: the
    // requested end state already holds, so the caller's intent has been
    // satisfied. The UPDATE guards on status = 'confirmed', so it touches
    // no row in that case and returns nothing.
    const cancelled = await cancelBooking(bookingId, reason.trim());

    if (!cancelled) {
      return res.status(200).json(toCancellationRepresentation(booking));
    }

    return res
      .status(201)
      .location(`/v1/bookings/${cancelled.id}`)
      .json(toCancellationRepresentation(cancelled));
  }
);

module.exports = router;
