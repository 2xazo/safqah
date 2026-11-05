import { and, count, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  offers,
  purchaseRequestItems,
  purchaseRequests,
} from "@/db/schema";
import {
  CACHE_TAGS,
  invalidateShortCache,
  withShortCache,
} from "@/lib/short-cache";

export type BuyerRequestListRow = typeof purchaseRequests.$inferSelect & {
  itemCount: number;
};

export type BuyerPublishedRequestSummary = {
  id: string;
  code: string;
  title: string;
  status: (typeof purchaseRequests.$inferSelect)["status"];
  submissionDeadline: Date | null;
  publishedAt: Date | null;
  offerCount: number;
  activeOfferCount: number;
};

export async function listBuyerPurchaseRequests(
  organizationId: string,
): Promise<BuyerRequestListRow[]> {
  return withShortCache(
    `buyer-requests:${organizationId}`,
    [CACHE_TAGS.buyerRequests(organizationId)],
    async () => {
      const db = getDb();
      const rows = await db
        .select()
        .from(purchaseRequests)
        .where(eq(purchaseRequests.organizationId, organizationId))
        .orderBy(desc(purchaseRequests.createdAt));

      const requestIds = rows.map((r) => r.id);
      const itemCountRows = requestIds.length
        ? await db
            .select({
              requestId: purchaseRequestItems.purchaseRequestId,
              value: count(),
            })
            .from(purchaseRequestItems)
            .where(inArray(purchaseRequestItems.purchaseRequestId, requestIds))
            .groupBy(purchaseRequestItems.purchaseRequestId)
        : [];
      const itemCountMap = new Map(
        itemCountRows.map((r) => [r.requestId, r.value]),
      );

      return rows.map((row) => ({
        ...row,
        itemCount: itemCountMap.get(row.id) ?? 0,
      }));
    },
  );
}

export async function listBuyerPublishedRequestSummaries(
  organizationId: string,
): Promise<BuyerPublishedRequestSummary[]> {
  return withShortCache(
    `buyer-dashboard-published:${organizationId}`,
    [CACHE_TAGS.buyerDashboard(organizationId)],
    async () => {
      const db = getDb();
      return db
        .select({
          id: purchaseRequests.id,
          code: purchaseRequests.code,
          title: purchaseRequests.title,
          status: purchaseRequests.status,
          submissionDeadline: purchaseRequests.submissionDeadline,
          publishedAt: purchaseRequests.publishedAt,
          offerCount: count(offers.id),
          activeOfferCount:
            sql<number>`count(${offers.id}) filter (where ${offers.status} in ('submitted', 'locked'))`.mapWith(
              Number,
            ),
        })
        .from(purchaseRequests)
        .leftJoin(offers, eq(offers.purchaseRequestId, purchaseRequests.id))
        .where(
          and(
            eq(purchaseRequests.organizationId, organizationId),
            eq(purchaseRequests.status, "published"),
          ),
        )
        .groupBy(purchaseRequests.id)
        .orderBy(desc(purchaseRequests.publishedAt));
    },
  );
}

export function invalidateBuyerListCaches(organizationId: string) {
  invalidateShortCache(
    CACHE_TAGS.buyerRequests(organizationId),
    CACHE_TAGS.buyerDashboard(organizationId),
  );
}

export function invalidateSupplierOpportunityCaches(organizationId?: string) {
  if (organizationId) {
    invalidateShortCache(
      CACHE_TAGS.supplierOpportunities,
      CACHE_TAGS.supplierOpportunitiesOrg(organizationId),
    );
    return;
  }
  invalidateShortCache(CACHE_TAGS.supplierOpportunities);
}
