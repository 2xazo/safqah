/**
 * Short-lived in-memory cache for semi-static list queries.
 * Per-isolate only (fine for Cloudflare Workers / vinext).
 * Avoids next/cache JSON serialization so Date fields stay Date objects,
 * and avoids background revalidation that can break Workers TCP I/O.
 */

type CacheEntry = {
  value: unknown;
  expiresAt: number;
  tags: string[];
};

const store = new Map<string, CacheEntry>();

/** Default TTL for opportunity / request list data. */
export const LIST_CACHE_TTL_MS = 15_000;

export async function withShortCache<T>(
  key: string,
  tags: string[],
  fn: () => Promise<T>,
  ttlMs: number = LIST_CACHE_TTL_MS,
): Promise<T> {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && hit.expiresAt > now) {
    return hit.value as T;
  }

  const value = await fn();
  store.set(key, {
    value,
    expiresAt: now + ttlMs,
    tags,
  });
  return value;
}

/** Drop entries that carry any of the given tags. */
export function invalidateShortCache(...tags: string[]) {
  if (tags.length === 0) return;
  const tagSet = new Set(tags);
  for (const [key, entry] of store) {
    if (entry.tags.some((tag) => tagSet.has(tag))) {
      store.delete(key);
    }
  }
}

export const CACHE_TAGS = {
  supplierOpportunities: "supplier-opportunities",
  supplierOpportunitiesOrg: (orgId: string) =>
    `supplier-opportunities:${orgId}`,
  buyerRequests: (orgId: string) => `buyer-requests:${orgId}`,
  buyerDashboard: (orgId: string) => `buyer-dashboard:${orgId}`,
} as const;
