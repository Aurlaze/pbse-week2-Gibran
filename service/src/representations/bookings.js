// service/src/representations/bookings.js

function toBookingRepresentation(dbRow) {
    if (!dbRow) return null;

    return {
        id: dbRow.id,
        courtId: dbRow.court_id,
        startTime: new Date(dbRow.start_time).toISOString(), // Converts to required RFC 3339 format
        endTime: new Date(dbRow.end_time).toISOString(),
        status: dbRow.status
    };
}

module.exports = {
    toBookingRepresentation
};
