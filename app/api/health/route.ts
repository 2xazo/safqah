import { count } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { users } from "@/db/schema";

export async function GET() {
  try {
    const db = getDb();
    const [row] = await db.select({ value: count() }).from(users);
    return NextResponse.json({
      ok: true,
      users: row?.value ?? 0,
      driver: process.env.DATABASE_URL?.startsWith("pglite:")
        ? "pglite"
        : "postgres",
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "unknown",
      },
      { status: 500 },
    );
  }
}
