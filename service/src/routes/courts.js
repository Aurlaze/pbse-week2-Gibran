const express = require("express");
const { findCourtById, findAllCourts } = require("../store/courts");
const { toCourtRepresentation } = require("../representations/courts");
const { problem } = require("../problem");

const router = express.Router();

router.get("/courts", async (req, res) => {
  const { status, limit, cursor } = req.query;
  let decodedCursor;

  if (cursor !== undefined) {
    const decoded = Buffer.from(cursor, "base64").toString("utf8");
    const reEncoded = Buffer.from(decoded).toString("base64");

    if (reEncoded !== cursor || !/^crt_[A-Za-z0-9]{3,}$/.test(decoded)) {
      return problem(res, 400, "malformed-request", { detail: "Invalid cursor value" });
    }

    decodedCursor = decoded;
  }

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

  // Validation
  if (status && !["active", "retired"].includes(status)) {
    return problem(res, 400, "malformed-request", { detail: "Invalid status value" });
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
