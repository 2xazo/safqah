/**
 * Drop and recreate the local safqah database as UTF8.
 * Encoding cannot be altered in-place on an existing PostgreSQL database.
 */
import { config as loadEnv } from "dotenv";
import postgres from "postgres";

loadEnv({ path: [".env.local", ".env"], quiet: true });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is missing");
}

const targetDb = process.env.SAFQAH_PG_DATABASE ?? "safqah";
const adminUrl = databaseUrl.replace(/\/[^/?]+(\?|$)/, "/postgres$1");

async function main() {
  const sql = postgres(adminUrl, {
    max: 1,
    prepare: false,
    connection: { client_encoding: "UTF8" },
    onnotice: () => undefined,
  });

  console.log("Connected to maintenance DB: postgres");

  const before = await sql<{
    datname: string;
    enc: string;
    datcollate: string;
    datctype: string;
  }[]>`
    select datname,
           pg_encoding_to_char(encoding) as enc,
           datcollate,
           datctype
    from pg_database
    where datname = ${targetDb}
  `;
  console.log("Before:", before[0] ?? "(missing)");

  await sql.unsafe(`
    SELECT pg_terminate_backend(pid)
    FROM pg_stat_activity
    WHERE datname = '${targetDb}'
      AND pid <> pg_backend_pid()
  `);

  await sql.unsafe(`DROP DATABASE IF EXISTS "${targetDb}"`);
  console.log(`Dropped database ${targetDb}`);

  // template0 + C locale allows creating UTF8 even when cluster default is WIN1256.
  await sql.unsafe(`
    CREATE DATABASE "${targetDb}"
      WITH OWNER = postgres
           ENCODING = 'UTF8'
           LC_COLLATE = 'C'
           LC_CTYPE = 'C'
           TEMPLATE = template0
  `);
  console.log(`Created database ${targetDb} as UTF8`);

  const after = await sql<{
    datname: string;
    enc: string;
    datcollate: string;
    datctype: string;
  }[]>`
    select datname,
           pg_encoding_to_char(encoding) as enc,
           datcollate,
           datctype
    from pg_database
    where datname = ${targetDb}
  `;
  console.log("After:", after[0]);

  if (after[0]?.enc !== "UTF8") {
    throw new Error(`Expected UTF8, got ${after[0]?.enc}`);
  }

  await sql.end({ timeout: 5 });
}

main().catch(async (error) => {
  console.error(error);
  process.exit(1);
});
