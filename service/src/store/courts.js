const pool = require("./db");

async function findCourtById(courtId) {
  const result = await pool.query(
    `
    SELECT
      id,
      name,
      location,
      court_type,
      is_available,
      status,
      retired_at,
      retire_reason
    FROM courts
    WHERE id = $1
    `,
    [courtId]
  );

  return result.rows[0] || null;
}

async function findAllCourts(status, limit, cursor) {
  const result = await pool.query(
    `
    SELECT
      id,
      name,
      location,
      court_type,
      is_available,
      status,
      retired_at,
      retire_reason
    FROM courts
    WHERE ($1::varchar IS NULL OR status = $1)
      AND ($2::varchar IS NULL OR id > $2)
    ORDER BY id
    LIMIT $3 + 1
    `,
    [status || null, cursor || null, limit]
  );

  return result.rows;
}

// Guarded on status = 'active' in the UPDATE itself rather than by reading
// first and writing after. Two requests arriving together would both pass a
// read-then-write check; only one can win this one, and the loser touches
// no row and gets back nothing. Retirement is terminal, so there is no
// transition out of 'retired' to worry about.
async function retireCourt(courtId, reason) {
  const result = await pool.query(
    `
    UPDATE courts
       SET status = 'retired',
           is_available = false,
           retired_at = now(),
           retire_reason = $2
     WHERE id = $1
       AND status = 'active'
    RETURNING id, retired_at, retire_reason
    `,
    [courtId, reason]
  );

  return result.rows[0] || null;
}

module.exports = {
  findCourtById,
  findAllCourts,
  retireCourt
};
