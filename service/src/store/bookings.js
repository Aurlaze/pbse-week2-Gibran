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

async function createBooking(bookingId, courtId, startTime, endTime) {
    const result = await pool.query(
        `
        INSERT INTO bookings (id, court_id, start_time, end_time, status)
        VALUES ($1, $2, $3, $4, 'confirmed')
        RETURNING *
        `,
        [bookingId, courtId, startTime, endTime]
    );
    return result.rows[0];
}

module.exports = {
    checkIdempotencyKey,
    saveIdempotencyKey,
    findOverlappingBooking,
    createBooking
};
