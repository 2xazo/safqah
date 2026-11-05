import { config as loadEnv } from "dotenv";
import { applySqlMigrations, closeDb, getSql } from "../db/index";

loadEnv({ path: [".env.local", ".env"], quiet: true });

async function main() {
  const sql = getSql();
  await sql.unsafe("drop schema if exists public cascade");
  await sql.unsafe("create schema public");
  await sql.unsafe("grant all on schema public to postgres");
  await sql.unsafe("grant all on schema public to public");
  console.log("Public schema reset.");
  await closeDb();
  await applySqlMigrations();
  console.log("Migrations applied.");
  await closeDb();
}

main().catch(async (error) => {
  console.error(error);
  await closeDb().catch(() => undefined);
  process.exit(1);
});
