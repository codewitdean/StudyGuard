import "dotenv/config";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Pool } = pg;

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("DATABASE_URL is required. Add it to server/.env first.");
  process.exit(1);
}

const pool = new Pool({
  connectionString: databaseUrl,
});

const currentFile = fileURLToPath(import.meta.url);
const currentDirectory = path.dirname(currentFile);
const migrationsDirectory = path.join(currentDirectory, "migrations");

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

async function getAppliedMigrationNames(client) {
  const result = await client.query("SELECT name FROM schema_migrations;");

  return new Set(result.rows.map((row) => row.name));
}

async function getMigrationFiles() {
  const files = await readdir(migrationsDirectory);

  return files.filter((file) => file.endsWith(".sql")).sort();
}

async function runMigration(client, fileName) {
  const filePath = path.join(migrationsDirectory, fileName);
  const sql = await readFile(filePath, "utf8");

  await client.query("BEGIN");

  try {
    await client.query(sql);
    await client.query("INSERT INTO schema_migrations (name) VALUES ($1);", [
      fileName,
    ]);
    await client.query("COMMIT");
    console.log(`Applied migration: ${fileName}`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

async function migrate() {
  const client = await pool.connect();

  try {
    await ensureMigrationsTable(client);

    const appliedMigrationNames = await getAppliedMigrationNames(client);
    const migrationFiles = await getMigrationFiles();

    for (const fileName of migrationFiles) {
      if (appliedMigrationNames.has(fileName)) {
        console.log(`Skipped migration: ${fileName}`);
        continue;
      }

      await runMigration(client, fileName);
    }

    console.log("Database migrations complete.");
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((error) => {
  console.error("Database migration failed.");
  console.error(error);
  process.exit(1);
});
