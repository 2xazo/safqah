import { config as loadEnv } from "dotenv";
import postgres from "postgres";

loadEnv({ path: [".env.local", ".env"], quiet: true });

const sql = postgres(process.env.DATABASE_URL!, {
  connection: { client_encoding: "UTF8" },
});

const rows = await sql`
  select datname, pg_encoding_to_char(encoding) as enc
  from pg_database
  where datname = current_database()
`;
console.log(rows);
await sql.end();
