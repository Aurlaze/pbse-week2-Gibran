// Layer 3 — the object check. Answers one question per resource: may this
// principal touch this object?
//
// These predicates live here rather than inside the handlers so the
// ownership rules of the whole service can be read in one place, and tested
// without HTTP or a database. A handler calls one of them; it does not
// reimplement the rule.
//
// Two things every caller of these functions must get right:
//
//   1. A refused check is answered 404, never 403. "This booking is not
//      yours" and "there is no such booking" must be indistinguishable, or
//      the difference becomes a way to enumerate booking identifiers.
//
//   2. On a write, the check runs BEFORE the change is stored. A handler
//      that writes and then returns 404 has already made the change; the
//      status is right and the data has still moved.

// A caller holding bookings:fulfil is an administrator or the scheduled
// cleanup job. That scope is never granted to a student client, so it is the
// one that widens visibility beyond the caller's own rows.
function isFulfiller(principal) {
  return principal.scopes.includes("bookings:fulfil");
}

// The booking's own student, or a fulfiller.
//
// Note what this does NOT do: it never consults the scope alone. A valid
// token carrying bookings:read permits booking-reading operations; it does
// not make every booking the caller's. That distinction is the whole of
// Layer 3.
function mayReadBooking(principal, booking) {
  if (!principal || !booking) {
    return false;
  }

  if (booking.booked_by && booking.booked_by === principal.subject) {
    return true;
  }

  return isFulfiller(principal);
}

// Cancelling is the same relationship as reading: your own booking, or a
// fulfiller acting on anyone's. Kept as its own function rather than aliased
// so that the day the two rules diverge, the change is one line here and not
// a search through the handlers.
function mayCancelBooking(principal, booking) {
  if (!principal || !booking) {
    return false;
  }

  if (booking.booked_by && booking.booked_by === principal.subject) {
    return true;
  }

  return isFulfiller(principal);
}

module.exports = {
  isFulfiller,
  mayReadBooking,
  mayCancelBooking
};
