// The A.5 state model. Plain functions, no React, so `node --test` runs it.
//
// What is worth asserting here is the part that is easy to get wrong by
// accident: that empty is not error, that content carries its age, and that
// stale content says so in words a user can read.

import test from "node:test";
import assert from "node:assert/strict";

import {
  content,
  describeAge,
  empty,
  failed,
  fromCollection,
  loading,
} from "./view-state.js";

test("the four states are distinguishable", () => {
  assert.equal(loading().kind, "loading");
  assert.equal(empty().kind, "empty");
  assert.equal(failed({ status: 500 }).kind, "error");
  assert.equal(content([]).kind, "content");
});

test("an empty collection is the empty state, not content", () => {
  // Indistinguishable-from-broken is the failure this prevents: a list that
  // renders nothing looks identical whether the service said "none" or the
  // request died.
  assert.equal(fromCollection([]).kind, "empty");
  assert.equal(fromCollection([{ id: "crt_1" }]).kind, "content");
});

test("content carries the time it was fetched", () => {
  const state = content([{ id: "crt_1" }]);

  assert.ok(state.fetchedAt instanceof Date);
  assert.equal(state.stale, false);
});

test("fresh content states its age and nothing more", () => {
  const at = new Date();
  const sentence = describeAge(content([], { fetchedAt: at }), "courts");

  // The separator is whatever the viewer's locale uses — "21:23" or
  // "21.23". That is deliberate: it is a time a person reads.
  assert.match(sentence, /^Showing courts as of \d{1,2}[:.]\d{2}/);
  assert.doesNotMatch(sentence, /Reconnecting/);
});

test("stale content says it is reconnecting and when the last attempt failed", () => {
  const sentence = describeAge(
    content([], {
      fetchedAt: new Date(),
      stale: true,
      lastAttempt: new Date(Date.now() - 8000),
    }),
    "courts"
  );

  // The sentence A.5 asks for: old data must announce its own condition,
  // because unlike an error it does not announce itself.
  assert.match(sentence, /Reconnecting/);
  assert.match(sentence, /8 seconds ago/);
});

test("a state with no data has no age to report", () => {
  assert.equal(describeAge(loading()), null);
  assert.equal(describeAge(empty()), null);
  assert.equal(describeAge(failed({ status: 503 })), null);
});
