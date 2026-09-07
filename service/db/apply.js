// Builds the database from empty. Same statements as running the .sql files
// through psql, but needs no psql installed.
//
//   DATABASE_URL=postgres://... node db/apply.js
//   node db/apply.js --schema-only

const fs = require("node:fs");
const path = require("node:path");
const pool = require("../src/store/db");

const files = process.argv.includes("--schema-only")
  ? ["schema.sql"]
  : ["schema.sql", "seed.sql"];

async function main() {
  for (const name of files) {
    const sql = fs.readFileSync(path.join(__dirname, name), "utf8");
    process.stdout.write(`applying ${name} ... `);
    await pool.query(sql);
    console.log("ok");
  }

  const { rows } = await pool.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' ORDER BY table_name`
  );
  console.log("tables:", rows.map((r) => r.table_name).join(", "));

  await pool.end();
}

main().catch((err) => {
  console.error("failed:", err.message);
  process.exit(1);
});
