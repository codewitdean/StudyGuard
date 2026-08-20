import "dotenv/config";
import pg from "pg";

const { Pool } = pg;

let pool;

function getPool() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required.");
  }

  if (!pool) {
    pool = new Pool({
      connectionString: databaseUrl,
    });
  }

  return pool;
}

export async function query(text, params = []) {
  return getPool().query(text, params);
}

export async function transaction(callback) {
  const client = await getPool().connect();

  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function closeDatabase() {
  if (!pool) {
    return;
  }

  await pool.end();
  pool = undefined;
}
