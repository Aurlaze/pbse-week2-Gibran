CREATE TABLE courts (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    location VARCHAR(150) NOT NULL,
    court_type VARCHAR(20) NOT NULL,
    is_available BOOLEAN NOT NULL,
    status VARCHAR(20) NOT NULL
);

    id VARCHAR(50) PRIMARY KEY,
    court_id VARCHAR(50) NOT NULL REFERENCES courts(id),
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('confirmed', 'cancelled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS bookings_court_id_start_time_idx
    ON bookings (court_id, start_time);

-- Keys live here rather than in process memory, so they survive a restart.
CREATE TABLE IF NOT EXISTS idempotency_keys (
    key VARCHAR(255) PRIMARY KEY,
    body_hash VARCHAR(255) NOT NULL,
    response_status INTEGER NOT NULL,
    response_body TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
