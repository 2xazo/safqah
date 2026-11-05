/**
 * Verify database encoding and Arabic text integrity directly in PostgreSQL.
 */
import { config as loadEnv } from "dotenv";
import postgres from "postgres";

loadEnv({ path: [".env.local", ".env"], quiet: true });

const sql = postgres(process.env.DATABASE_URL!, {
  max: 1,
  prepare: false,
  connection: { client_encoding: "UTF8" },
});

function hasArabic(value: string | null | undefined) {
  return Boolean(value && /[\u0600-\u06FF]/.test(value));
}

function looksMojibake(value: string | null | undefined) {
  if (!value) return false;
  // Common corruption markers when UTF8 bytes were stored/read as Latin1/Win1256.
  return /Ã.|Ø.|Ù.|Ð.|Ñ.|Â./.test(value) && !hasArabic(value);
}

const encoding = await sql<{
  datname: string;
  enc: string;
  datcollate: string;
  datctype: string;
  server_encoding: string;
  client_encoding: string;
}[]>`
  select
    current_database() as datname,
    pg_encoding_to_char(d.encoding) as enc,
    d.datcollate,
    d.datctype,
    current_setting('server_encoding') as server_encoding,
    current_setting('client_encoding') as client_encoding
  from pg_database d
  where d.datname = current_database()
`;

const samples = await sql<{
  source: string;
  value: string;
}[]>`
  select 'org.name' as source, name as value from organizations
  union all
  select 'product.name', name from products
  union all
  select 'pr.title', title from purchase_requests
  union all
  select 'pri.product_name', product_name from purchase_request_items
  union all
  select 'offer.payment_terms', payment_terms from offers where payment_terms is not null
  limit 40
`;

const arabicRows = samples.filter((row) => hasArabic(row.value));
const mojibakeRows = samples.filter((row) => looksMojibake(row.value));
const samplePreview = arabicRows.slice(0, 8).map((row) => ({
  source: row.source,
  value: row.value,
  codepoints: [...row.value]
    .slice(0, 12)
    .map((ch) => "U+" + ch.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0"))
    .join(" "),
}));

const report = {
  encoding: encoding[0],
  sampleCount: samples.length,
  arabicCount: arabicRows.length,
  mojibakeCount: mojibakeRows.length,
  samplePreview,
  mojibakePreview: mojibakeRows.slice(0, 5),
  passed:
    encoding[0]?.enc === "UTF8" &&
    encoding[0]?.client_encoding === "UTF8" &&
    arabicRows.length > 0 &&
    mojibakeRows.length === 0,
};

console.log(JSON.stringify(report, null, 2));
await sql.end({ timeout: 5 });
process.exitCode = report.passed ? 0 : 1;
