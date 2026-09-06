CREATE TABLE courts (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    location VARCHAR(150) NOT NULL,
    court_type VARCHAR(20) NOT NULL,
    is_available BOOLEAN NOT NULL,
    status VARCHAR(20) NOT NULL
);

-- Idempotency Keys table (Required by A.8 to prevent memory storage)
CREATE TABLE IF NOT EXISTS idempotency_keys (
    key VARCHAR(255) PRIMARY KEY,
    body_hash VARCHAR(255) NOT NULL,
    response_status INTEGER NOT NULL,
    response_body TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
