import { createClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase Data API client.
 * Uses the public URL + server secret key.
 * Not wired to auth, pages, queries, or workflows yet.
 * Do not import from Client Components.
 */
export function createSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!url || !secretKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY",
    );
  }

  return createClient(url, secretKey);
}
