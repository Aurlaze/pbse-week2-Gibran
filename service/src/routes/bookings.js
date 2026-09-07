const { createHash, randomUUID } = require("node:crypto");
const express = require("express");

const {
  checkIdempotencyKey,
  saveIdempotencyKey,
  findOverlappingBooking,
  createBooking
} = require("../store/bookings");
const { findCourtById } = require("../store/courts");
const { toBookingRepresentation } = require("../representations/bookings");
const { parseNewBooking, isValidIdempotencyKey } = require("../schemas/bookings");
const { problem } = require("../problem");

const router = express.Router();

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

router.post("/bookings", async (req, res) => {
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

  const booking = await createBooking(
    newBookingId(),
    courtId,
    startTime,
    endTime
  );

  // Representation
  const representation = toBookingRepresentation(booking);

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

module.exports = router;
