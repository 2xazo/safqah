import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { cacheForRequest } from "vinext/cache";
import * as schema from "./schema";

declare global {
  // eslint-disable-next-line no-var
  var __safqahPglite: PGlite | undefined;
  // eslint-disable-next-line no-var
  var __safqahPgliteDb: Database | undefined;
}

export type Database =
  | ReturnType<typeof drizzlePostgres<typeof schema>>
  | ReturnType<typeof drizzlePglite<typeof schema>>;

type SqlClient = ReturnType<typeof postgres>;

/**
 * Tracks the most recently created postgres.js client so Node scripts
 * (seed / migrate / verify) can still call closeDb(). Never reused as a
 * cross-request cache — Cloudflare Workers binds TCP sockets to the
 * request that opened them.
 */
let lastSqlClient: SqlClient | undefined;

function requireDatabaseUrl() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is missing. Copy .env.example to .env.local and set a PostgreSQL connection string, or use pglite:.data/safqah for local embedded Postgres.",
    );
  }
  return url;
}

function isPgliteUrl(url: string) {
  return url.startsWith("pglite:");
}

function pglitePath(url: string) {
  const raw = url.replace(/^pglite:/, "");
  return resolve(process.cwd(), raw || ".data/safqah");
}

function createSqlClient(url: string): SqlClient {
  // Fresh client per request. Reusing a global client across Workers requests
  // causes: "Cannot perform I/O on behalf of a different request".
  const client = postgres(url, {
    prepare: false,
    // Each request gets a fresh client. Allow independent dashboard reads
    // to use a small request-local pool instead of queueing behind one socket.
    // The client is never shared across Cloudflare Worker requests.
    max: 6,
    fetch_types: false,
    idle_timeout: 20,
    connect_timeout: 10,
    connection: {
      client_encoding: "UTF8",
    },
  });
  lastSqlClient = client;
  return client;
}

function createDatabase(): Database {
  const url = requireDatabaseUrl();

  if (isPgliteUrl(url)) {
    const dir = pglitePath(url);
    mkdirSync(dir, { recursive: true });
    if (!globalThis.__safqahPglite) {
      globalThis.__safqahPglite = new PGlite(dir);
    }
    if (!globalThis.__safqahPgliteDb) {
      globalThis.__safqahPgliteDb = drizzlePglite(globalThis.__safqahPglite, {
        schema,
      });
    }
    return globalThis.__safqahPgliteDb;
  }

  return drizzlePostgres(createSqlClient(url), { schema });
}

const getRequestDatabase = cacheForRequest(createDatabase);

export function getDb(): Database {
  return getRequestDatabase();
}

export function getSql() {
  const url = requireDatabaseUrl();
  if (isPgliteUrl(url)) {
    throw new Error(
      "getSql() is only available for PostgreSQL DATABASE_URL connections.",
    );
  }
  return createSqlClient(url);
}

export async function closeDb() {
  if (lastSqlClient) {
    await lastSqlClient.end({ timeout: 5 });
    lastSqlClient = undefined;
  }
  if (globalThis.__safqahPglite) {
    await globalThis.__safqahPglite.close();
    globalThis.__safqahPglite = undefined;
  }
  globalThis.__safqahPgliteDb = undefined;
}

const MIGRATIONS = [
  "0000_init_safqah.sql",
  "0001_mvp_direct_rfq.sql",
  "0002_request_validation_ux.sql",
] as const;

function migrationStatements(fileName: string) {
  const migrationPath = resolve(
    dirname(fileURLToPath(import.meta.url)),
    `../drizzle/${fileName}`,
  );
  if (!existsSync(migrationPath)) {
    throw new Error(`Migration file not found: ${migrationPath}`);
  }
  return readFileSync(migrationPath, "utf8")
    .split("--> statement-breakpoint")
    .map((part) => part.trim())
    .filter(Boolean);
}

export async function applySqlMigrations() {
  const url = requireDatabaseUrl();

  if (isPgliteUrl(url)) {
    getDb();
    const client = globalThis.__safqahPglite!;
    await client.exec(`
      create table if not exists schema_migrations (
        id text primary key,
        applied_at timestamptz not null default now()
      )
    `);
    const existing = await client.query<{ exists: boolean }>(
      `select exists (
         select 1 from information_schema.tables
         where table_schema = 'public' and table_name = 'users'
       ) as exists`,
    );
    const applied = await client.query<{ id: string }>(
      `select id from schema_migrations`,
    );
    const appliedSet = new Set(applied.rows.map((row) => row.id));
    if (existing.rows[0]?.exists && !appliedSet.has("0000_init_safqah.sql")) {
      await client.exec(
        `insert into schema_migrations (id) values ('0000_init_safqah.sql') on conflict do nothing`,
      );
      appliedSet.add("0000_init_safqah.sql");
    }
    for (const fileName of MIGRATIONS) {
      if (appliedSet.has(fileName)) continue;
      if (fileName === "0000_init_safqah.sql" && existing.rows[0]?.exists) {
        await client.exec(
          `insert into schema_migrations (id) values ('${fileName}') on conflict do nothing`,
        );
        continue;
      }
      for (const statement of migrationStatements(fileName)) {
        await client.exec(statement);
      }
      await client.exec(
        `insert into schema_migrations (id) values ('${fileName}') on conflict do nothing`,
      );
    }
    return getDb();
  }

  const sqlClient = getSql();
  try {
    await sqlClient.unsafe(`
      create table if not exists schema_migrations (
        id text primary key,
        applied_at timestamptz not null default now()
      )
    `);
    const existing = await sqlClient<{ exists: boolean }[]>`
      select exists (
        select 1 from information_schema.tables
        where table_schema = 'public' and table_name = 'users'
      ) as exists`;
    const applied = await sqlClient<{ id: string }[]>`
      select id from schema_migrations`;
    const appliedSet = new Set(applied.map((row) => row.id));
    if (existing[0]?.exists && !appliedSet.has("0000_init_safqah.sql")) {
      await sqlClient.unsafe(
        `insert into schema_migrations (id) values ('0000_init_safqah.sql') on conflict do nothing`,
      );
      appliedSet.add("0000_init_safqah.sql");
    }
    for (const fileName of MIGRATIONS) {
      if (appliedSet.has(fileName)) continue;
      if (fileName === "0000_init_safqah.sql" && existing[0]?.exists) {
        await sqlClient.unsafe(
          `insert into schema_migrations (id) values ('${fileName}') on conflict do nothing`,
        );
        continue;
      }
      for (const statement of migrationStatements(fileName)) {
        await sqlClient.unsafe(statement);
      }
      await sqlClient.unsafe(
        `insert into schema_migrations (id) values ('${fileName}') on conflict do nothing`,
      );
    }
    return getDb();
  } finally {
    await sqlClient.end({ timeout: 5 }).catch(() => undefined);
    if (lastSqlClient === sqlClient) {
      lastSqlClient = undefined;
    }
  }
}
