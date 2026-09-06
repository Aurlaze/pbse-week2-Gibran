// service/src/store/bookings.js

const pool = require('./db');

async function checkIdempotencyKey(key) {
    const result = await pool.query(
        `SELECT * FROM idempotency_keys WHERE key = $1`,
        [key]
    );
    return result.rows[0] || null;
}

async function saveIdempotencyKey(key, bodyHash, status, responseBody) {
    await pool.query(
        `
        INSERT INTO idempotency_keys (key, body_hash, response_status, response_body)
        VALUES ($1, $2, $3, $4)
        `,
        [key, bodyHash, status, responseBody]
    );
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
    createBooking
};
