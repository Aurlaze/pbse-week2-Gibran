// A.6 — reading a refusal as a Problem Document.
//
// These assert the translation, because everything the forms do depends on
// it: a field message that never arrives silently becomes a blank form the
// user cannot fix.

import test from "node:test";
import assert from "node:assert/strict";

import { Problem } from "./problem.js";

const validationFailure = {
  type: "https://api.example.com/problems/malformed-request",
  title: "The request could not be parsed",
  status: 400,
  detail: "One or more fields do not match the documented schema",
  "invalid-params": [
    { name: "courtId", reason: "Choose a court" },
    { name: "endTime", reason: "The end time must be after the start time" },
  ],
};

test("invalid-params are indexed by field name", () => {
  const problem = new Problem("refused", 400, validationFailure);

  assert.equal(problem.fieldReason("courtId"), "Choose a court");
  assert.equal(
    problem.fieldReason("endTime"),
    "The end time must be after the start time"
  );
  assert.equal(problem.fieldReason("startTime"), undefined);
  assert.equal(problem.hasFieldReasons, true);
});

test("the stable type is kept, not just the wording", () => {
  // Client code branches on `type`; `title` is for a developer reading a
  // log and is free to be reworded.
  const problem = new Problem("refused", 400, validationFailure);

  assert.equal(problem.type, "https://api.example.com/problems/malformed-request");
});

test("a refusal naming no field belongs at the level of the form", () => {
  // An overlapping slot is not any one field's fault — every field is
  // valid and the request as a whole is not.
  const conflict = new Problem("refused", 409, {
    type: "https://api.example.com/problems/court-slot-unavailable",
    title: "The badminton court is not available for this time slot",
    status: 409,
    detail: "That court is already booked for an overlapping time slot",
  });

  assert.equal(conflict.hasFieldReasons, false);
  assert.equal(
    conflict.sentence,
    "That court is already booked for an overlapping time slot"
  );
});

test("the sentence prefers detail, then title", () => {
  const titleOnly = new Problem("refused", 409, {
    title: "That status change is not permitted",
    status: 409,
  });

  assert.equal(titleOnly.sentence, "That status change is not permitted");
});

test("a response with no problem body does not throw", () => {
  // A gateway timeout or a dropped connection produces no document at all.
  // The form still has to render something.
  const bare = new Problem("Request failed", 504, null);

  assert.equal(bare.hasFieldReasons, false);
  assert.equal(bare.fieldReason("courtId"), undefined);
  assert.equal(bare.sentence, "Request failed");
});

test("malformed invalid-params entries are ignored, not crashed on", () => {
  const messy = new Problem("refused", 400, {
    status: 400,
    "invalid-params": [null, { reason: "no name" }, { name: "courtId", reason: "ok" }],
  });

  assert.equal(messy.fieldReason("courtId"), "ok");
  assert.equal(Object.keys(messy.invalidParams).length, 1);
});

test("a Problem is still an Error", () => {
  // It is thrown, so `catch` blocks and anything logging it must not be
  // surprised by what they get.
  const problem = new Problem("refused", 400, validationFailure);

  assert.ok(problem instanceof Error);
  assert.equal(problem.status, 400);
});
