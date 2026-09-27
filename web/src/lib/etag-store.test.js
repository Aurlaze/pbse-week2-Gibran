// A.7 item 2 — the ETags must outlive a re-render.
//
// The failure this guards against is silent: a tag kept in a variable
// inside the polling function is undefined on every cycle, so no poll ever
// sends If-None-Match, the service never answers 304, and the saving
// simply never happens. Nothing looks broken.

import test from "node:test";
import assert from "node:assert/strict";

import {
  forget,
  forgetAll,
  knownVersion,
  lastBody,
  rememberVersion,
} from "./etag-store.js";

test.afterEach(() => forgetAll());

test("a remembered version survives to the next read", () => {
  rememberVersion("/bookings", '"v1"', { items: [{ id: "bkg_1" }] });

  assert.equal(knownVersion("/bookings"), '"v1"');
  assert.deepEqual(lastBody("/bookings"), { items: [{ id: "bkg_1" }] });
});

test("the body is kept beside the tag, because a 304 has none", () => {
  // Without this a 304 would be a successful read the client could not
  // render — worse than a failure, because it looks like empty data.
  rememberVersion("/courts", '"v1"', { items: [{ id: "crt_1" }] });

  assert.deepEqual(lastBody("/courts"), { items: [{ id: "crt_1" }] });
});

test("different queries are different representations", () => {
  // /bookings and /bookings?status=confirmed have their own versions.
  // Sharing one tag between them would send the wrong If-None-Match and
  // invite a 304 for a list the client has never actually seen.
  rememberVersion("/bookings", '"all"', { items: [] });
  rememberVersion("/bookings?status=confirmed", '"confirmed"', { items: [] });

  assert.equal(knownVersion("/bookings"), '"all"');
  assert.equal(knownVersion("/bookings?status=confirmed"), '"confirmed"');
});

test("a later read replaces the version it supersedes", () => {
  rememberVersion("/bookings", '"v1"', { items: [] });
  rememberVersion("/bookings", '"v2"', { items: [{ id: "bkg_9" }] });

  assert.equal(knownVersion("/bookings"), '"v2"');
  assert.deepEqual(lastBody("/bookings"), { items: [{ id: "bkg_9" }] });
});

test("a response with no ETag is not remembered", () => {
  rememberVersion("/bookings", null, { items: [] });

  assert.equal(knownVersion("/bookings"), undefined);
});

test("an unknown path has no version to send", () => {
  assert.equal(knownVersion("/nothing-read-yet"), undefined);
});

test("forgetting one path leaves the others alone", () => {
  rememberVersion("/bookings", '"v1"', { items: [] });
  rememberVersion("/courts", '"v1"', { items: [] });

  forget("/bookings");

  assert.equal(knownVersion("/bookings"), undefined);
  assert.equal(knownVersion("/courts"), '"v1"');
});

test("signing out leaves nothing behind", () => {
  // The next person to use this browser must not find the previous
  // student's bookings sitting in memory.
  rememberVersion("/bookings", '"v1"', { items: [{ id: "bkg_private" }] });

  forgetAll();

  assert.equal(knownVersion("/bookings"), undefined);
  assert.equal(lastBody("/bookings"), undefined);
});
