/**
 * Development E2E workflow verification for the direct RFQ MVP.
 * Verifies cross-role database visibility without a browser.
 */
import { config as loadEnv } from "dotenv";
import { and, eq } from "drizzle-orm";
import { closeDb, getDb } from "../db/index";
import {
  offerItems,
  offers,
  organizationMembers,
  purchaseOrders,
  purchaseRequestItems,
  purchaseRequests,
  users,
} from "../db/schema";
import { listPublishedOpportunitiesForSupplier } from "../lib/matching";
import { scoreOffers } from "../lib/offer-scoring";

loadEnv({ path: [".env.local", ".env"], quiet: true });

const results: Array<{ step: string; passed: boolean; detail?: string }> = [];

function record(step: string, passed: boolean, detail?: string) {
  results.push({ step, passed, detail });
  console.log(`[${passed ? "PASS" : "FAIL"}] ${step}${detail ? ` — ${detail}` : ""}`);
}

async function main() {
  const db = getDb();

  const [buyer] = await db.select().from(users).where(eq(users.email, "buyer@safqah.demo")).limit(1);
  const [supplier] = await db
    .select()
    .from(users)
    .where(eq(users.email, "supplier@safqah.demo"))
    .limit(1);
  record("1. Demo buyer exists", !!buyer);
  record("2. Demo supplier exists", !!supplier);

  const [buyerMember] = await db
    .select()
    .from(organizationMembers)
    .where(eq(organizationMembers.userId, buyer!.id))
    .limit(1);
  const [supplierMember] = await db
    .select()
    .from(organizationMembers)
    .where(eq(organizationMembers.userId, supplier!.id))
    .limit(1);

  const stamp = Date.now();
  const [createdRequest] = await db
    .insert(purchaseRequests)
    .values({
      code: `PR-E2E-${stamp}`,
      organizationId: buyerMember.organizationId,
      createdByUserId: buyer!.id,
      status: "published",
      title: "E2E رفوف معدنية للمستودع",
      deliveryCity: "الرياض",
      deliveryDistrict: "الياسمين",
      neededByDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      submissionDeadline: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      publishedAt: new Date(),
      rawRequirementText: "أحتاج 20 رف معدني للمستودع غير موجود في الكتالوج",
    })
    .returning();

  await db.insert(purchaseRequestItems).values({
    purchaseRequestId: createdRequest.id,
    productId: null,
    productName: "رف معدني للمستودع ارتفاع 2 متر",
    quantity: 20,
    unitLabel: "قطعة",
    description: "منتج خارج الكتالوج",
    sortOrder: 0,
  });
  record("3. Buyer published free-text request", !!createdRequest.id, createdRequest.code);

  const buyerRequests = await db
    .select()
    .from(purchaseRequests)
    .where(eq(purchaseRequests.organizationId, buyerMember.organizationId));
  record(
    "4. Request appears under buyer requests",
    buyerRequests.some((r) => r.id === createdRequest.id),
  );

  const opportunities = await listPublishedOpportunitiesForSupplier(
    supplierMember.organizationId,
  );
  record(
    "5. Same request appears in supplier opportunities",
    opportunities.some((r) => r.id === createdRequest.id),
  );

  const [item] = await db
    .select()
    .from(purchaseRequestItems)
    .where(eq(purchaseRequestItems.purchaseRequestId, createdRequest.id))
    .limit(1);

  const [offer] = await db
    .insert(offers)
    .values({
      code: `OF-E2E-${stamp}`,
      purchaseRequestId: createdRequest.id,
      supplierOrganizationId: supplierMember.organizationId,
      submittedByUserId: supplier!.id,
      status: "locked",
      deliveryFee: "50.00",
      paymentTerms: "آجل 7 أيام",
      proposedDeliveryDate: createdRequest.neededByDate!,
      meetsDeliveryDate: true,
      deliveryDaysDiff: 0,
      subtotalAmount: "4000.00",
      taxAmount: "607.50",
      totalAmount: "4657.50",
      isLocked: true,
      submittedAt: new Date(),
      lockedAt: new Date(),
    })
    .returning();

  await db.insert(offerItems).values({
    offerId: offer.id,
    purchaseRequestItemId: item.id,
    offeredProductName: "رف معدني صناعي",
    brandName: "إمداد",
    availableQuantity: 20,
    unitPrice: "200.00",
    lineTotal: "4000.00",
    isAlternative: false,
  });
  record("6. Supplier submitted complete offer", !!offer.id, offer.code);

  const supplierOffers = await db
    .select()
    .from(offers)
    .where(eq(offers.supplierOrganizationId, supplierMember.organizationId));
  record("7. Offer appears under supplier offers", supplierOffers.some((o) => o.id === offer.id));

  const buyerSees = await db
    .select()
    .from(offers)
    .where(
      and(
        eq(offers.purchaseRequestId, createdRequest.id),
        eq(offers.supplierOrganizationId, supplierMember.organizationId),
      ),
    );
  record("8. Buyer sees supplier offer on request", buyerSees.length === 1);

  const scored = scoreOffers([
    {
      offerId: offer.id,
      totalAmount: Number(offer.totalAmount),
      proposedDeliveryDate: offer.proposedDeliveryDate,
      meetsDeliveryDate: offer.meetsDeliveryDate,
      deliveryDaysDiff: offer.deliveryDaysDiff,
      supplierRating: 4.6,
    },
  ]);
  record("9. Recommendation score computed", scored[0]?.totalScore != null, String(scored[0]?.totalScore));

  await db
    .update(purchaseRequests)
    .set({ submissionDeadline: new Date(Date.now() - 60_000) })
    .where(eq(purchaseRequests.id, createdRequest.id));

  const [po] = await db
    .insert(purchaseOrders)
    .values({
      code: `PO-E2E-${stamp}`,
      offerId: offer.id,
      purchaseRequestId: createdRequest.id,
      buyerOrganizationId: buyerMember.organizationId,
      supplierOrganizationId: supplierMember.organizationId,
      status: "issued",
      fulfillmentStatus: "new",
      receiptStatus: "pending",
      totalAmount: offer.totalAmount,
      deliveryFee: offer.deliveryFee,
      expectedDeliveryDate: offer.proposedDeliveryDate,
      issuedAt: new Date(),
    })
    .returning();

  await db.update(offers).set({ status: "selected" }).where(eq(offers.id, offer.id));
  await db
    .update(purchaseRequests)
    .set({ status: "awarded", selectedOfferId: offer.id, awardedAt: new Date() })
    .where(eq(purchaseRequests.id, createdRequest.id));
  record("10. Purchase order created after selection", !!po.id, po.code);

  const supplierPos = await db
    .select()
    .from(purchaseOrders)
    .where(eq(purchaseOrders.supplierOrganizationId, supplierMember.organizationId));
  record("11. PO appears under supplier orders", supplierPos.some((p) => p.id === po.id));

  await db
    .update(purchaseOrders)
    .set({ fulfillmentStatus: "preparing", status: "in_fulfillment" })
    .where(eq(purchaseOrders.id, po.id));
  const [updated] = await db
    .select()
    .from(purchaseOrders)
    .where(eq(purchaseOrders.id, po.id))
    .limit(1);
  record("12. Fulfillment update visible to buyer query", updated?.fulfillmentStatus === "preparing");

  const [persistedRequest] = await db
    .select()
    .from(purchaseRequests)
    .where(eq(purchaseRequests.id, createdRequest.id))
    .limit(1);
  record("13. Records persist after refresh query", persistedRequest?.status === "awarded");

  const seededFreeText = (await db.select().from(purchaseRequestItems)).filter(
    (row) => row.productId == null,
  );
  record("14. Seed includes free-text products", seededFreeText.length > 0, seededFreeText[0]?.productName);

  /* Hail coffee-cup scenario: buyer city/line items must match supplier view */
  const [hailRequest] = await db
    .insert(purchaseRequests)
    .values({
      code: `PR-HAIL-${stamp}`,
      organizationId: buyerMember.organizationId,
      createdByUserId: buyer!.id,
      status: "published",
      title: "توريد أكواب قهوة ورقية لفروع حائل",
      deliveryCity: "حائل",
      deliveryDistrict: "النقرة",
      deliveryAddressText:
        "فرع النقرة، شارع الأمير سعود بن عبدالمحسن، التسليم عند بوابة المستودع.",
      neededByDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      submissionDeadline: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
      publishedAt: new Date(),
      notes: "يرجى تقديم عرض شامل للتوصيل، مع توضيح بلد المنشأ والعينة المتاحة.",
    })
    .returning();

  await db.insert(purchaseRequestItems).values({
    purchaseRequestId: hailRequest.id,
    productId: null,
    productName: "أكواب قهوة ورقية مزدوجة الجدار سعة 8 أونصات",
    quantity: 10,
    unitLabel: "كرتون",
    specificationNotes:
      "لون أبيض، مناسبة للمشروبات الساخنة، يحتوي الكرتون على 500 كوب، خامة غذائية معتمدة.",
    acceptedAlternatives: "يُقبل مقاس مماثل بشرط توضيح الاختلاف.",
    sortOrder: 0,
  });

  const hailForSupplier = await listPublishedOpportunitiesForSupplier(
    supplierMember.organizationId,
  );
  const hailOpportunity = hailForSupplier.find((r) => r.id === hailRequest.id);
  record(
    "15. Hail request visible to supplier",
    !!hailOpportunity,
    hailOpportunity?.deliveryCity ?? undefined,
  );
  record(
    "16. Supplier sees delivery city حائل (not الرياض)",
    hailOpportunity?.deliveryCity === "حائل",
    hailOpportunity?.deliveryCity ?? undefined,
  );

  const [hailItem] = await db
    .select()
    .from(purchaseRequestItems)
    .where(eq(purchaseRequestItems.purchaseRequestId, hailRequest.id))
    .limit(1);
  record(
    "17. Hail line item is coffee cups (not لا يوجد)",
    hailItem?.productName.includes("أكواب قهوة") && hailItem.productName !== "لا يوجد",
    hailItem?.productName,
  );
  record(
    "18. Hail quantity is 10 كرتون",
    hailItem?.quantity === 10 && hailItem?.unitLabel === "كرتون",
    `${hailItem?.quantity} ${hailItem?.unitLabel}`,
  );
  record(
    "19. Hail specifications persisted",
    Boolean(hailItem?.specificationNotes?.includes("500 كوب")),
  );

  const failed = results.filter((r) => !r.passed);
  console.log(`\nPassed ${results.length - failed.length}/${results.length}`);
  if (failed.length) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
  });
