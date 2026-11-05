import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import EmbeddedPostgres from "embedded-postgres";

const databaseDir = resolve(".data/embedded-pg");
const port = Number(process.env.SAFQAH_PG_PORT ?? 54329);
const password = process.env.SAFQAH_PG_PASSWORD ?? "postgres";
const database = process.env.SAFQAH_PG_DATABASE ?? "safqah";

async function main() {
  mkdirSync(databaseDir, { recursive: true });
  const pg = new EmbeddedPostgres({
    databaseDir,
    user: "postgres",
    password,
    port,
    persistent: true,
  });

  if (!existsSync(resolve(databaseDir, "PG_VERSION"))) {
    console.log("Initializing embedded PostgreSQL cluster...");
    await pg.initialise();
  }

  console.log(`Starting embedded PostgreSQL on port ${port}...`);
  await pg.start();

  try {
    await pg.createDatabase(database);
    console.log(`Database ${database} ready.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/already exists/i.test(message)) {
      throw error;
    }
  }

  // Ensure the demo DB is UTF8. Windows cluster defaults may be WIN1256;
  // encoding cannot be changed in-place, so recreate via template0 if needed.
  const client = pg.getPgClient("postgres");
  try {
    await client.connect();
    const { rows } = await client.query<{ enc: string }>(
      `select pg_encoding_to_char(encoding) as enc from pg_database where datname = $1`,
      [database],
    );
    const enc = rows[0]?.enc;
    if (enc && enc !== "UTF8") {
      console.log(
        `Database ${database} encoding is ${enc}; recreating as UTF8...`,
      );
      await client.query(
        `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
        [database],
      );
      await client.query(`DROP DATABASE IF EXISTS "${database}"`);
      await client.query(
        `CREATE DATABASE "${database}" WITH OWNER = postgres ENCODING = 'UTF8' LC_COLLATE = 'C' LC_CTYPE = 'C' TEMPLATE = template0`,
      );
      console.log(`Database ${database} recreated as UTF8.`);
    } else {
      console.log(`Database ${database} encoding: ${enc ?? "unknown"}`);
    }
  } catch (error) {
    console.warn(
      "UTF8 encoding check/recreate skipped:",
      error instanceof Error ? error.message : error,
    );
  } finally {
    await client.end().catch(() => undefined);
  }

  console.log(
    `DATABASE_URL=postgresql://postgres:${password}@127.0.0.1:${port}/${database}`,
  );
  console.log("Embedded PostgreSQL is running. Keep this process open.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
