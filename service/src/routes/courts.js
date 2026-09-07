const express = require("express");
const { findCourtById, findAllCourts } = require("../store/courts");
const { toCourtRepresentation } = require("../representations/courts");
const { problem } = require("../problem");

const router = express.Router();

// The contract names the query parameters of this operation, so a name it does
// not name is a request this service cannot read.
const LIST_COURTS_PARAMS = ["status", "limit", "cursor"];

router.get("/courts", async (req, res) => {
  const { status, limit, cursor } = req.query;

  const unknown = Object.keys(req.query).filter(
    (k) => !LIST_COURTS_PARAMS.includes(k)
  );

  if (unknown.length > 0) {
    return problem(res, 400, "malformed-request", {
      detail: `Unknown query parameter: ${unknown.join(", ")}`,
      invalidFields: unknown
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
      return problem(res, 400, "malformed-request", { detail: "Invalid limit value" });
    }
  }

  // Checked for presence, not truthiness: "" is not in the documented enum.
  if (status !== undefined && !["active", "retired"].includes(status)) {
    return problem(res, 400, "malformed-request", { detail: "Invalid status value" });
  }

  // Validation is done. A cursor that does not decode to a court id names no
  // position, so nothing follows it. Answered here rather than passed to the
  // database, which rejects the arbitrary bytes such a cursor can carry.
  if (decodedCursor !== undefined && !/^crt_[A-Za-z0-9]{3,}$/.test(decodedCursor)) {
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

  return res.status(200).json({
    items,
    ...(nextCursor && { nextCursor })
  });
});

router.get("/courts/:courtId", async (req, res) => {
  const { courtId } = req.params;

  // This operation documents no query parameters at all.
  const unknownQuery = Object.keys(req.query);

  if (unknownQuery.length > 0) {
    return problem(res, 400, "malformed-request", {
      detail: `Unknown query parameter: ${unknownQuery.join(", ")}`,
      invalidFields: unknownQuery
    });
  }

  // Validation
  const courtIdPattern = /^crt_[A-Za-z0-9]{3,}$/;

  if (!courtIdPattern.test(courtId)) {
    return problem(res, 400, "malformed-request", { detail: "Invalid courtId format" });
  }

  // Work
  const court = await findCourtById(courtId);

  if (!court) {
    return problem(res, 404, "not-found", { detail: "Court not found" });
  }

  // Representation
  return res.status(200).json(toCourtRepresentation(court));
});

module.exports = router;
