// The only layer that decides which fields a caller sees.
//
// Access has already been granted by the time anything here runs. What is
// left is Step 8e: return the fields that caller actually needs, and not the
// rest. `booked_by` is the example — a student reading their own booking
// learns nothing from being told it is theirs, while an administrator
// reconciling bookings needs to know whose it is.

const { isFulfiller } = require("../auth/ownership");

function toBookingRepresentation(dbRow, principal) {
    if (!dbRow) return null;

    const representation = {
        id: dbRow.id,
        courtId: dbRow.court_id,
        startTime: new Date(dbRow.start_time).toISOString(), // Converts to required RFC 3339 format
        endTime: new Date(dbRow.end_time).toISOString(),
        status: dbRow.status
    };

    // Who a booking belongs to is an administrative detail. It goes only to
    // callers holding bookings:fulfil, which is never granted to a student
    // client. Without this guard, one caller's subject identifier would be
    // handed to every other caller who could read the booking.
    if (principal && isFulfiller(principal) && dbRow.booked_by) {
        representation.bookedBy = dbRow.booked_by;
    }

    return representation;
}

// The cancellation sub-resource, as documented on
// POST /v1/bookings/{bookingId}/cancellation.
function toCancellationRepresentation(dbRow) {
    if (!dbRow) return null;

    return {
        bookingId: dbRow.id,
        reason: dbRow.cancel_reason,
        cancelledAt: new Date(dbRow.cancelled_at).toISOString()
    };
}

module.exports = {
    toBookingRepresentation,
    toCancellationRepresentation
};
