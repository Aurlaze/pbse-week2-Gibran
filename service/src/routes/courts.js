const express = require("express");
const {
  findCourtById,
  findAllCourts,
  retireCourt
} = require("../store/courts");
const {
  toCourtRepresentation,
  toRetirementRepresentation
} = require("../representations/courts");
const { problem, invalidParam } = require("../problem");
const requireScope = require("../auth/require-scope");
const { parseReason } = require("../schemas/reason");
const {
  computeETag,
  requirePrecondition,
  sendRepresentation
} = require("../etag");

const router = express.Router();

// The contract names the query parameters of this operation, so a name it does
// not name is a request this service cannot read.
const LIST_COURTS_PARAMS = ["status", "limit", "cursor"];

router.get("/courts", requireScope("courts:read"), async (req, res) => {
  const { status, limit, cursor } = req.query;

  const unknown = Object.keys(req.query).filter(
    (k) => !LIST_COURTS_PARAMS.includes(k)
  );

  if (unknown.length > 0) {
    return problem(res, 400, "malformed-request", {
      detail: `Unknown query parameter: ${unknown.join(", ")}`,
      "invalid-params": unknown.map((name) =>
        invalidParam(name, "This query parameter is not part of the operation")
      )
    });
  }

  // The cursor is opaque and the contract puts no constraint on it, so any
  // string is accepted rather than rejected.
  const decodedCursor =
    cursor === undefined || cursor === ""
      ? undefined
      : Buffer.from(cursor, "base64").toString("utf8");

  let parsedLimit = 20;

  if (limit !== undefined) {
    parsedLimit = Number(limit);

    if (
      !Number.isInteger(parsedLimit) ||
      parsedLimit < 1 ||
      parsedLimit > 100
    ) {
      return problem(res, 400, "malformed-request", {
        detail: "Invalid limit value"
      });
    }
  }

  // Checked for presence, not truthiness: "" is not in the documented enum.
  if (status !== undefined && !["active", "retired"].includes(status)) {
    return problem(res, 400, "malformed-request", {
      detail: "Invalid status value"
    });
  }

  // Validation is done. A cursor that does not decode to a court id names no
  // position, so nothing follows it. Answered here rather than passed to the
  // database, which rejects the arbitrary bytes such a cursor can carry.
  if (
    decodedCursor !== undefined &&
    !/^crt_[A-Za-z0-9]{3,}$/.test(decodedCursor)
  ) {
    return res.status(200).json({ items: [] });
  }

  // Work
  const courts = await findAllCourts(
    status,
    parsedLimit,
    decodedCursor
  );

  const hasNextPage = courts.length > parsedLimit;

  if (hasNextPage) {
    courts.pop();
  }

  // Representation
  const items = courts.map(toCourtRepresentation);

  const nextCursor =
    hasNextPage
      ? Buffer.from(courts[courts.length - 1].id).toString("base64")
      : undefined;

  // A.7 — a polled collection carries an ETag, so the next poll can ask
  // whether anything changed instead of fetching the list again.
  return sendRepresentation(req, res, {
    items,
    ...(nextCursor && { nextCursor })
  });
});

router.get(
  "/courts/:courtId",
  requireScope("courts:read"),
  async (req, res) => {
    const { courtId } = req.params;

    // This operation documents no query parameters at all.
    const unknownQuery = Object.keys(req.query);

    if (unknownQuery.length > 0) {
      return problem(res, 400, "malformed-request", {
        detail: `Unknown query parameter: ${unknownQuery.join(", ")}`,
        "invalid-params": unknownQuery.map((name) =>
          invalidParam(name, "This query parameter is not part of the operation")
        )
      });
    }

    // Validation
    const courtIdPattern = /^crt_[A-Za-z0-9]{3,}$/;

    if (!courtIdPattern.test(courtId)) {
      return problem(res, 400, "malformed-request", {
        detail: "Invalid courtId format"
      });
    }

    // Work
    const court = await findCourtById(courtId);

    if (!court) {
      return problem(res, 404, "not-found", {
        detail: "Court not found"
      });
    }

    // Representation. The ETag here is what a write against this court
    // sends back in If-Match (A.8).
    return sendRepresentation(req, res, toCourtRepresentation(court));
  }
);

// ---------------------------------------------------------------------
// POST /v1/courts/{courtId}/retirement — the same five-line pattern the
// cancellation follows, in the same order, for the same reasons.
//
// Retirement is a noun sub-resource rather than a verb in the URI or a
// PATCH setting status: it carries a body of its own (why), it returns a
// record of its own (the reason and the moment), and that record can be
// read back.
// ---------------------------------------------------------------------
const COURT_ID_PATTERN = /^crt_[A-Za-z0-9]{3,}$/;

router.post(
  "/courts/:courtId/retirement",
  requireScope("courts:write"),
  async (req, res) => {
    const { courtId } = req.params;

    // 1. validate -> 400
    if (!COURT_ID_PATTERN.test(courtId)) {
      return problem(res, 400, "malformed-request", {
        detail: "Invalid courtId format"
      });
    }

    const parsed = parseReason(
      req.body,
      "Say why the court is being retired"
    );

    if (!parsed.ok) {
      return problem(res, 400, "malformed-request", {
        detail:
          "reason is required: 1 to 500 characters, with no control characters",
        "invalid-params": parsed.invalidParams
      });
    }

    // 2. load the object
    const court = await findCourtById(courtId);

    // 3. absent -> 404
    if (!court) {
      return problem(res, 404, "not-found", { detail: "Court not found" });
    }

    // 4. no object-level rule here. A court belongs to nobody in
    //    particular; holding courts:write is the whole of the permission,
    //    which is why that scope is granted only to administrators.

    // 5. precondition -> 428 or 412, after authorisation and before any
    //    write, for the reasons set out in the cancellation handler.
    const currentVersion = computeETag(toCourtRepresentation(court));

    if (!requirePrecondition(req, res, currentVersion)) {
      return undefined;
    }

    // 6. work, then representation.
    //
    // Already retired is 200 with the existing record, not 409: the end
    // state the caller asked for already holds. The UPDATE guards on
    // status = 'active', so it touches no row in that case.
    const retired = await retireCourt(courtId, parsed.data.reason);

    if (!retired) {
      return res.status(200).json(toRetirementRepresentation(court));
    }

    return res
      .status(201)
      .location(`/v1/courts/${courtId}`)
      .json(toRetirementRepresentation(retired));
  }
);

module.exports = router;
