const { Client } = require("pg");

const connectionConfig = {
  host: process.env.PGHOST ?? "localhost",
  user: process.env.PGUSER ?? "postgres",
  port: Number(process.env.PGPORT ?? 5432),
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE ?? "test",
};

async function main() {
  const client = new Client(connectionConfig);

  try {
    await client.connect();
    console.log("Connected to Postgres.");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
