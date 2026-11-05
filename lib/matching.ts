import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import {
  organizations,
  purchaseRequests,
  supplierCategories,
  supplierProfiles,
} from "@/db/schema";
import { CACHE_TAGS, withShortCache } from "@/lib/short-cache";

export type MatchReason = "category_and_city" | "city_other";

export type MatchedSupplier = {
  organizationId: string;
  name: string;
  city: string;
  reason: MatchReason;
};

function cityTokens(value: string | null | undefined) {
  return (value ?? "")
    .split(/[،,\s|/]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function citiesOverlap(
  requestCity: string | null | undefined,
  supplierCity: string | null | undefined,
  serviceCities: string | null | undefined,
) {
  const request = (requestCity ?? "").trim();
  // Never invent a delivery city. Unpublished/invalid rows without a city do not match.
  if (!request) return false;
  if ((supplierCity ?? "").includes(request) || request.includes(supplierCity ?? "")) {
    return true;
  }
  return cityTokens(serviceCities).some(
    (city) => city.includes(request) || request.includes(city),
  );
}

/** Simple MVP matching: verified/active supplier + city overlap + optional category. */
export async function findMatchingSuppliers(requestId: string): Promise<MatchedSupplier[]> {
  const db = getDb();
  const [request] = await db
    .select({
      id: purchaseRequests.id,
      categoryId: purchaseRequests.categoryId,
      deliveryCity: purchaseRequests.deliveryCity,
    })
    .from(purchaseRequests)
    .where(eq(purchaseRequests.id, requestId))
    .limit(1);

  if (!request) return [];

  const suppliers = await db
    .select({
      organizationId: organizations.id,
      name: organizations.name,
      city: organizations.city,
      isVerified: organizations.isVerified,
      serviceCities: supplierProfiles.serviceCities,
    })
    .from(organizations)
    .leftJoin(
      supplierProfiles,
      eq(supplierProfiles.organizationId, organizations.id),
    )
    .where(eq(organizations.type, "supplier"));

  const categoryLinks = request.categoryId
    ? await db
        .select({
          supplierOrganizationId: supplierCategories.supplierOrganizationId,
        })
        .from(supplierCategories)
        .where(eq(supplierCategories.categoryId, request.categoryId))
    : [];
  const categorySet = new Set(categoryLinks.map((row) => row.supplierOrganizationId));

  const matched: MatchedSupplier[] = [];
  for (const supplier of suppliers) {
    if (!citiesOverlap(request.deliveryCity, supplier.city, supplier.serviceCities)) {
      continue;
    }
    if (request.categoryId && categorySet.has(supplier.organizationId)) {
      matched.push({
        organizationId: supplier.organizationId,
        name: supplier.name,
        city: supplier.city,
        reason: "category_and_city",
      });
    } else {
      matched.push({
        organizationId: supplier.organizationId,
        name: supplier.name,
        city: supplier.city,
        reason: "city_other",
      });
    }
  }

  return matched;
}

export async function listPublishedOpportunitiesForSupplier(
  supplierOrganizationId: string,
) {
  return withShortCache(
    `supplier-opportunities:${supplierOrganizationId}`,
    [
      CACHE_TAGS.supplierOpportunities,
      CACHE_TAGS.supplierOpportunitiesOrg(supplierOrganizationId),
    ],
    async () => {
      const db = getDb();
      const [supplierRows, categoryRows, requests] = await Promise.all([
        db
          .select({
            id: organizations.id,
            city: organizations.city,
            serviceCities: supplierProfiles.serviceCities,
          })
          .from(organizations)
          .leftJoin(
            supplierProfiles,
            eq(supplierProfiles.organizationId, organizations.id),
          )
          .where(eq(organizations.id, supplierOrganizationId))
          .limit(1),
        db
          .select({ categoryId: supplierCategories.categoryId })
          .from(supplierCategories)
          .where(
            eq(
              supplierCategories.supplierOrganizationId,
              supplierOrganizationId,
            ),
          ),
        db
          .select()
          .from(purchaseRequests)
          .where(
            inArray(purchaseRequests.status, ["published", "awarded", "closed"]),
          ),
      ]);

      const [supplier] = supplierRows;
      if (!supplier) return [];

      const categoryIds = categoryRows.map((row) => row.categoryId);

      return requests
        .filter((request) =>
          citiesOverlap(
            request.deliveryCity,
            supplier.city,
            supplier.serviceCities,
          ),
        )
        .map((request) => {
          const categoryMatch =
            !!request.categoryId && categoryIds.includes(request.categoryId);
          return {
            ...request,
            matchReason: (categoryMatch || !request.categoryId
              ? "category_and_city"
              : "city_other") as MatchReason,
          };
        });
    },
  );
}
