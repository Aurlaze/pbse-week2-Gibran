// service/src/store/bookings.js

// const db = require('../db'); // TODO: Import your database connection here later

async function checkIdempotencyKey(key) {
    const query = `SELECT * FROM idempotency_keys WHERE key = $1`;
    // return await db.query(query, [key]);
}

async function saveIdempotencyKey(key, bodyHash, status, responseBody) {
    const query = `
        INSERT INTO idempotency_keys (key, body_hash, response_status, response_body)
        VALUES ($1, $2, $3, $4)
    `;
    // await db.query(query, [key, bodyHash, status, responseBody]);
}

async function createBooking(bookingId, courtId, startTime, endTime) {
    const query = `
        INSERT INTO bookings (id, court_id, start_time, end_time, status)
        VALUES ($1, $2, $3, $4, 'confirmed')
        RETURNING *;
    `;
    // return await db.query(query, [bookingId, courtId, startTime, endTime]);
}

module.exports = {
    checkIdempotencyKey,
    saveIdempotencyKey,
    createBooking
};
