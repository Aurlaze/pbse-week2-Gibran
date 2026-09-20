const pool = require('./db');

// The contract retains keys for 24 hours; a key reused after that is new.
async function checkIdempotencyKey(key) {
    const result = await pool.query(
        `
        SELECT key, body_hash, response_status, response_body
        FROM idempotency_keys
        WHERE key = $1
          AND created_at > now() - INTERVAL '24 hours'
        `,
        [key]
    );
    return result.rows[0] || null;
}

async function saveIdempotencyKey(key, bodyHash, status, responseBody) {
    await pool.query(
        `
        INSERT INTO idempotency_keys (key, body_hash, response_status, response_body)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (key) DO NOTHING
        `,
        [key, bodyHash, status, responseBody]
    );
}

// Half-open intervals: a booking ending as another starts does not overlap.
async function findOverlappingBooking(courtId, startTime, endTime) {
    const result = await pool.query(
        `
        SELECT id
        FROM bookings
        WHERE court_id = $1
          AND status = 'confirmed'
          AND start_time < $3
          AND end_time > $2
        LIMIT 1
        `,
        [courtId, startTime, endTime]
    );
    return result.rows[0] || null;
}

async function createBooking(bookingId, courtId, startTime, endTime, bookedBy) {
    const result = await pool.query(
        `
        INSERT INTO bookings (id, court_id, start_time, end_time, status, booked_by)
        VALUES ($1, $2, $3, $4, 'confirmed', $5)
        RETURNING *
        `,
        [bookingId, courtId, startTime, endTime, bookedBy]
    );
    return result.rows[0];
}

// Loads the row and nothing else. Deciding whether the caller may see it is
// ownership.js's job, and answering when they may not is the handler's: a
// store function that returned null for "not yours" would make the two
// conditions indistinguishable *here*, where the handler still needs to tell
// them apart in order to be sure it is answering both identically.
async function findBookingById(bookingId) {
    const result = await pool.query(
        `
        SELECT id, court_id, start_time, end_time, status,
               booked_by, cancelled_at, cancel_reason
        FROM bookings
        WHERE id = $1
        `,
        [bookingId]
    );
    return result.rows[0] || null;
}

// The collection, constrained inside the query.
//
// Filtering in JavaScript after a broad SELECT produces two defects at once:
// a page of `limit` rows can come back with fewer than `limit` visible ones
// (or none at all, while more exist further down), and every other caller's
// row was briefly held in this process's memory, where one mistake in a
// representation function is enough to leak it.
function listForPrincipal(principal, { status, limit, cursor }) {
    const conditions = [];
    const params = [];

    // A fulfiller — an administrator or the cleanup job — sees every
    // booking. Everyone else sees the rows they created, and there is no
    // request parameter that can widen that.
    if (!principal.scopes.includes("bookings:fulfil")) {
        params.push(principal.subject);
        conditions.push(`booked_by = $${params.length}`);
    }

    if (status) {
        params.push(status);
        conditions.push(`status = $${params.length}`);
    }

    if (cursor) {
        params.push(cursor);
        conditions.push(`id > $${params.length}`);
    }

    // One extra row, so the handler can tell whether a next page exists
    // without a second COUNT query.
    params.push(limit + 1);

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    return pool
        .query(
            `
            SELECT id, court_id, start_time, end_time, status,
                   booked_by, cancelled_at, cancel_reason
            FROM bookings
            ${where}
            ORDER BY id
            LIMIT $${params.length}
            `,
            params
        )
        .then((result) => result.rows);
}

// Only ever called after the ownership check has passed. The status guard in
// the WHERE clause makes the write itself idempotent: cancelling an already
// cancelled booking touches no row, and the handler answers 200 with the
// record that is already there.
async function cancelBooking(bookingId, reason) {
    const result = await pool.query(
        `
        UPDATE bookings
        SET status = 'cancelled',
            cancelled_at = now(),
            cancel_reason = $2
        WHERE id = $1
          AND status = 'confirmed'
        RETURNING id, court_id, start_time, end_time, status,
                  booked_by, cancelled_at, cancel_reason
        `,
        [bookingId, reason]
    );
    return result.rows[0] || null;
}

module.exports = {
    checkIdempotencyKey,
    saveIdempotencyKey,
    findOverlappingBooking,
    createBooking,
    findBookingById,
    listForPrincipal,
    cancelBooking
};
