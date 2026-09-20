-- IF NOT EXISTS on every statement in this file, so it can be run against an
-- empty database to build the schema and against a deployed one to bring it
-- up to date. Without it `npm run db:setup` — the command docs/deployment.md
-- tells you to run — fails on the second run.
CREATE TABLE IF NOT EXISTS courts (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    location VARCHAR(150) NOT NULL,
    court_type VARCHAR(20) NOT NULL,
    is_available BOOLEAN NOT NULL,
    status VARCHAR(20) NOT NULL
);

-- Columns derived from the Booking schema in openapi.yaml, plus created_at
-- and the three columns authorisation needs.
CREATE TABLE IF NOT EXISTS bookings (
    id VARCHAR(50) PRIMARY KEY,
    court_id VARCHAR(50) NOT NULL REFERENCES courts(id),
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('confirmed', 'cancelled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- The `sub` claim of the token that created this booking. This is the
    -- column every object-level check in src/auth/ownership.js reads: without
    -- it a booking belongs to nobody, and any authenticated caller holding
    -- bookings:read could read every row by changing the id in the URL.
    booked_by VARCHAR(255),

    -- Written by POST /v1/bookings/{bookingId}/cancellation.
    cancelled_at TIMESTAMPTZ,
    cancel_reason TEXT,

    CHECK (end_time > start_time)
);

-- Session 4 added the three columns above to a table that already existed in
-- deployed databases, so they are also applied separately. Together with the
-- CREATE TABLE IF NOT EXISTS above, this file both builds the schema from
-- empty and brings an existing database up to date.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS booked_by VARCHAR(255);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancel_reason TEXT;

-- Supports the overlap lookup.
CREATE INDEX IF NOT EXISTS bookings_court_id_start_time_idx
    ON bookings (court_id, start_time);

-- Supports the owner-constrained listing in GET /v1/bookings. The sort key is
-- part of the index because the constraint and the pagination are one query:
-- filtering after the query would make a page of 20 yield fewer than 20
-- visible rows.
CREATE INDEX IF NOT EXISTS bookings_booked_by_id_idx
    ON bookings (booked_by, id);

-- Keys live here rather than in process memory, so they survive a restart.
CREATE TABLE IF NOT EXISTS idempotency_keys (
    key VARCHAR(255) PRIMARY KEY,
    body_hash VARCHAR(255) NOT NULL,
    response_status INTEGER NOT NULL,
    response_body TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
