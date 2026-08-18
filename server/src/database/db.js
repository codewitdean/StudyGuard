import "dotenv/config";
import pg from "pg";

const { Pool } = pg;

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required.");
}

const pool = new Pool({
  connectionString: databaseUrl,
});

export async function query(text, params = []) {
  return pool.query(text, params);
}

export async function closeDatabase() {
  await pool.end();
}
