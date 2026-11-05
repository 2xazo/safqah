"use server";

import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db";
import {
  categories,
  fulfillmentEvents,
  offerItems,
  offers,
  offerScores,
  organizations,
  purchaseOrderItems,
  purchaseOrders,
  purchaseRequestItems,
  purchaseRequests,
  purchaseRequestStatusHistory,
  supplierProfiles,
} from "@/db/schema";
import { assistRequirementDraft } from "@/lib/ai/requirement-assistant";
import { requireSession } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import {
  invalidateBuyerListCaches,
  invalidateSupplierOpportunityCaches,
} from "@/lib/buyer-queries";
import { TAX_RATE } from "@/lib/constants";
import { findMatchingSuppliers } from "@/lib/matching";
import { notifyOrganizationUsers, notifyUser } from "@/lib/notifications";
import { scoreOffers } from "@/lib/offer-scoring";
import {
  arabicPublishError,
  isPlaceholderProductName,
  validatePublishRequest,
} from "@/lib/request-validation";
import { FULFILLMENT_FLOW } from "@/lib/status-labels";
import { dateOnly, daysBetweenDates, isDeadlinePassed } from "@/lib/workflow";

function optionalString(value: FormDataEntryValue | null) {
  const s = String(value ?? "").trim();
  return s.length ? s : undefined;
}

function parseItemsJson(raw: FormDataEntryValue | null) {
  const text = String(raw ?? "[]");
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    throw new Error(arabicPublishError("ITEMS_REQUIRED"));
  }
  const schema = z
    .array(
      z.object({
        productName: z.string().trim().min(2).max(200),
        description: z.string().trim().max(1000).optional(),
        quantity: z.coerce.number().int().positive().max(100000),
        unitLabel: z.string().trim().min(1).max(50),
        specificationNotes: z.string().trim().max(1000).optional(),
        acceptedAlternatives: z.string().trim().max(500).optional(),
        brandPreference: z.string().trim().max(120).optional(),
        minShelfLifeMonths: z.coerce.number().int().min(1).max(60).optional().nullable(),
      }),
    )
    .min(1)
    .max(20);
  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new Error(arabicPublishError("INVALID_ITEM"));
  }
  for (const item of result.data) {
    if (isPlaceholderProductName(item.productName)) {
      throw new Error("اسم المنتج غير صالح. اكتب اسم المنتج الحقيقي المطلوب.");
    }
  }
  return result.data;
}

async function resolveCategoryId(slugOrId?: string) {
  if (!slugOrId) return null;
  const db = getDb();
  if (z.string().uuid().safeParse(slugOrId).success) {
    return slugOrId;
  }
  const [row] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.slug, slugOrId))
    .limit(1);
  return row?.id ?? null;
}

/**
 * Optional AI drafting for create-purchase-request.
 * Authenticated buyers only. Never persists or publishes a request.
 */
/** Readable sequential codes, e.g. PR-2026-0008 / PO-2026-0004. */
async function nextDocumentCode(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  table: typeof purchaseRequests | typeof purchaseOrders,
  prefix: "PR" | "PO",
) {
  const year = new Date().getFullYear();
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(table);
  const next = Number(row?.n ?? 0) + 1;
  return `${prefix}-${year}-${String(next).padStart(4, "0")}`;
}

export async function assistRequirementAction(formData: FormData) {
  const includeDiag = process.env.NODE_ENV !== "production";
  try {
    const session = await requireSession(["buyer"]);
    const text = String(formData.get("rawText") ?? "");
    return await assistRequirementDraft(text, {
      rateLimitKey: `buyer:${session.id}`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message === "UNAUTHORIZED") {
      console.error("[ai] requirement assist", { diagCode: "AI_RBAC", reason: "UNAUTHORIZED" });
      return {
        ok: false as const,
        configured: false,
        code: "UNAVAILABLE" as const,
        message: "يلزم تسجيل الدخول كمشتري لاستخدام مساعد الصياغة.",
        didNotPersist: true as const,
        ...(includeDiag ? { diagCode: "AI_RBAC" as const } : {}),
      };
    }
    if (message === "FORBIDDEN") {
      console.error("[ai] requirement assist", { diagCode: "AI_RBAC", reason: "FORBIDDEN" });
      return {
        ok: false as const,
        configured: false,
        code: "UNAVAILABLE" as const,
        message: "هذه الميزة متاحة لحسابات المشترين فقط.",
        didNotPersist: true as const,
        ...(includeDiag ? { diagCode: "AI_RBAC" as const } : {}),
      };
    }
    console.error("[ai] requirement assist", {
      diagCode: "AI_UNKNOWN_ERROR",
      layer: "server_action",
    });
    return {
      ok: false as const,
      configured: true,
      code: "API_ERROR" as const,
      message: "تعذر تحليل الاحتياج الآن. راجع النص أو أكمل النموذج يدويًا.",
      didNotPersist: true as const,
      ...(includeDiag ? { diagCode: "AI_UNKNOWN_ERROR" as const } : {}),
    };
  }
}

export async function publishPurchaseRequest(formData: FormData) {
  const session = await requireSession(["buyer"]);
  const title = String(formData.get("title") ?? "").trim();
  const notes = optionalString(formData.get("notes"));
  const rawRequirementText = optionalString(formData.get("rawRequirementText"));
  const neededByDate = optionalString(formData.get("neededByDate"));
  const submissionDeadline = optionalString(formData.get("submissionDeadline"));
  const deliveryCity = optionalString(formData.get("deliveryCity"));
  const deliveryDistrict = optionalString(formData.get("deliveryDistrict"));
  const deliveryAddressText = optionalString(formData.get("deliveryAddressText"));
  const branchId = optionalString(formData.get("branchId"));
  const deliveryAddressId = optionalString(formData.get("deliveryAddressId"));
  const categoryOtherText = optionalString(formData.get("categoryOtherText"));
  const categoryId = await resolveCategoryId(optionalString(formData.get("categoryId")));
  const items = parseItemsJson(formData.get("itemsJson"));

  const validation = validatePublishRequest({
    title,
    deliveryCity: deliveryCity ?? "",
    deliveryDistrict,
    deliveryAddressText,
    deliveryAddressId,
    neededByDate,
    submissionDeadline,
    items,
  });
  if (!validation.ok) {
    throw new Error(validation.message);
  }

  const safeTitle = z.string().trim().min(3).max(200).parse(title);
  const safeCity = z.string().trim().min(2).max(80).parse(deliveryCity);
  const deadline = new Date(submissionDeadline!);

  const db = getDb();
  const code = await nextDocumentCode(db, purchaseRequests, "PR");
  const now = new Date();

  const result = await db.transaction(async (tx) => {
    const [request] = await tx
      .insert(purchaseRequests)
      .values({
        code,
        organizationId: session.organizationId,
        createdByUserId: session.id,
        branchId: branchId ?? null,
        deliveryAddressId: deliveryAddressId ?? null,
        status: "published",
        title: safeTitle,
        notes: notes ?? null,
        neededByDate: neededByDate!,
        categoryId,
        categoryOtherText: categoryOtherText ?? null,
        deliveryCity: safeCity,
        deliveryDistrict: deliveryDistrict ?? null,
        deliveryAddressText: deliveryAddressText ?? null,
        submissionDeadline: deadline,
        publishedAt: now,
        rawRequirementText: rawRequirementText ?? null,
      })
      .returning();

    await tx.insert(purchaseRequestItems).values(
      items.map((item, index) => ({
        purchaseRequestId: request.id,
        productId: null,
        productName: item.productName,
        description: item.description ?? null,
        quantity: item.quantity,
        unitLabel: item.unitLabel,
        specificationNotes: item.specificationNotes ?? null,
        acceptedAlternatives: item.acceptedAlternatives ?? null,
        brandPreference: item.brandPreference ?? null,
        minShelfLifeMonths: item.minShelfLifeMonths ?? null,
        sortOrder: index,
      })),
    );

    await tx.insert(purchaseRequestStatusHistory).values({
      purchaseRequestId: request.id,
      fromStatus: null,
      toStatus: "published",
      changedByUserId: session.id,
      note: "نشر طلب شراء لاستقبال عروض الموردين",
    });

    return request;
  });

  await writeAuditLog({
    actorUserId: session.id,
    action: "purchase_request.publish",
    entityType: "purchase_request",
    entityId: result.id,
    details: code,
  });

  await notifyUser({
    userId: session.id,
    title: "تم نشر طلب الشراء",
    body: `نُشر الطلب ${code} وأصبح ظاهرًا للموردين المناسبين.`,
    linkPath: `/buyer/requests/${result.id}`,
  });

  const matched = await findMatchingSuppliers(result.id);
  for (const supplier of matched) {
    await notifyOrganizationUsers({
      organizationId: supplier.organizationId,
      title: "فرصة توريد جديدة",
      body:
        supplier.reason === "category_and_city"
          ? `فرصة مطابقة: ${safeTitle}`
          : `فرصة أخرى في مدينتك: ${safeTitle}`,
      linkPath: `/supplier/opportunities/${result.id}`,
    });
  }

  revalidatePath("/buyer/requests");
  revalidatePath("/buyer");
  revalidatePath("/supplier/opportunities");
  revalidatePath("/supplier");
  invalidateBuyerListCaches(session.organizationId);
  invalidateSupplierOpportunityCaches();
  redirect(`/buyer/requests/${result.id}`);
}

/** @deprecated Prefer publishPurchaseRequest for the MVP workflow. */
export async function submitPurchaseRequest(formData: FormData) {
  return publishPurchaseRequest(formData);
}

const offerLineSchema = z.object({
  purchaseRequestItemId: z.string().uuid(),
  offeredProductName: z.string().trim().min(2).max(200),
  brandName: z.string().trim().max(120).optional(),
  specificationNote: z.string().trim().max(1000).optional(),
  availableQuantity: z.coerce.number().int().positive(),
  unitPrice: z.coerce.number().positive(),
  isAlternative: z.coerce.boolean().optional(),
});

export async function submitOffer(formData: FormData) {
  const session = await requireSession(["supplier"]);
  const purchaseRequestId = z.string().uuid().parse(formData.get("purchaseRequestId"));
  const proposedDeliveryDate = z
    .string()
    .min(8)
    .parse(formData.get("proposedDeliveryDate"));
  const offerValidityDate = optionalString(formData.get("offerValidityDate"));
  const deliveryFee = z.coerce.number().min(0).parse(formData.get("deliveryFee") ?? "0");
  const paymentTerms = optionalString(formData.get("paymentTerms"));
  const notes = optionalString(formData.get("notes"));
  const lock = formData.get("lock") !== "false";
  const lines = z
    .array(offerLineSchema)
    .min(1)
    .parse(JSON.parse(String(formData.get("itemsJson") ?? "[]")));

  const db = getDb();
  const [request] = await db
    .select()
    .from(purchaseRequests)
    .where(eq(purchaseRequests.id, purchaseRequestId))
    .limit(1);

  if (!request) throw new Error("NOT_FOUND");
  if (request.status !== "published") throw new Error("REQUEST_NOT_OPEN");
  if (isDeadlinePassed(request.submissionDeadline)) throw new Error("DEADLINE_PASSED");

  const requestItems = await db
    .select()
    .from(purchaseRequestItems)
    .where(eq(purchaseRequestItems.purchaseRequestId, purchaseRequestId));

  if (requestItems.length === 0) throw new Error("NO_ITEMS");
  if (lines.length !== requestItems.length) throw new Error("INCOMPLETE_OFFER");

  const itemIds = new Set(requestItems.map((item) => item.id));
  for (const line of lines) {
    if (!itemIds.has(line.purchaseRequestItemId)) throw new Error("INVALID_ITEM");
  }

  const neededBy = request.neededByDate ?? proposedDeliveryDate;
  const diff = daysBetweenDates(neededBy, proposedDeliveryDate);
  const meets = diff <= 0;

  const subtotal = lines.reduce(
    (sum, line) => sum + line.unitPrice * line.availableQuantity,
    0,
  );
  const taxable = subtotal + deliveryFee;
  const tax = Math.round(taxable * TAX_RATE * 100) / 100;
  const total = Math.round((taxable + tax) * 100) / 100;

  const [existing] = await db
    .select()
    .from(offers)
    .where(
      and(
        eq(offers.purchaseRequestId, purchaseRequestId),
        eq(offers.supplierOrganizationId, session.organizationId),
      ),
    )
    .limit(1);

  if (existing?.isLocked || existing?.status === "locked" || existing?.status === "selected") {
    throw new Error("OFFER_LOCKED");
  }

  const now = new Date();
  const status = lock ? ("locked" as const) : ("submitted" as const);

  const offerId = await db.transaction(async (tx) => {
    let id = existing?.id;
    const payload = {
      purchaseRequestId,
      supplierOrganizationId: session.organizationId,
      submittedByUserId: session.id,
      status,
      offerValidityDate: offerValidityDate ?? null,
      deliveryFee: deliveryFee.toFixed(2),
      paymentTerms: paymentTerms ?? null,
      notes: notes ?? null,
      proposedDeliveryDate: dateOnly(proposedDeliveryDate),
      meetsDeliveryDate: meets,
      deliveryDaysDiff: Math.max(0, diff),
      subtotalAmount: subtotal.toFixed(2),
      taxAmount: tax.toFixed(2),
      totalAmount: total.toFixed(2),
      isLocked: lock,
      submittedAt: now,
      lockedAt: lock ? now : null,
    };

    if (existing) {
      await tx.update(offers).set(payload).where(eq(offers.id, existing.id));
      await tx.delete(offerItems).where(eq(offerItems.offerId, existing.id));
      id = existing.id;
    } else {
      const [created] = await tx
        .insert(offers)
        .values({
          code: `OF-${Date.now()}`,
          ...payload,
        })
        .returning();
      id = created.id;
    }

    await tx.insert(offerItems).values(
      lines.map((line) => ({
        offerId: id!,
        purchaseRequestItemId: line.purchaseRequestItemId,
        offeredProductName: line.offeredProductName,
        brandName: line.brandName ?? null,
        specificationNote: line.specificationNote ?? null,
        availableQuantity: line.availableQuantity,
        unitPrice: line.unitPrice.toFixed(2),
        lineTotal: (line.unitPrice * line.availableQuantity).toFixed(2),
        isAlternative: line.isAlternative === true,
      })),
    );

    return id!;
  });

  await writeAuditLog({
    actorUserId: session.id,
    action: existing ? "offer.update" : "offer.submit",
    entityType: "offer",
    entityId: offerId,
    details: purchaseRequestId,
  });

  await notifyOrganizationUsers({
    organizationId: request.organizationId,
    title: "عرض جديد على طلبك",
    body: `ورد عرض جديد على الطلب ${request.code}.`,
    linkPath: `/buyer/requests/${request.id}/offers`,
  });

  revalidatePath("/supplier/offers");
  revalidatePath("/supplier/opportunities");
  revalidatePath(`/buyer/requests/${request.id}/offers`);
  revalidatePath("/buyer/offers");
  invalidateSupplierOpportunityCaches(session.organizationId);
  invalidateBuyerListCaches(request.organizationId);
  redirect(`/supplier/offers/${offerId}`);
}

async function recomputeOfferScores(purchaseRequestId: string) {
  const db = getDb();
  const rows = await db
    .select({
      offerId: offers.id,
      totalAmount: offers.totalAmount,
      proposedDeliveryDate: offers.proposedDeliveryDate,
      meetsDeliveryDate: offers.meetsDeliveryDate,
      deliveryDaysDiff: offers.deliveryDaysDiff,
      ratingAverage: supplierProfiles.ratingAverage,
    })
    .from(offers)
    .leftJoin(
      supplierProfiles,
      eq(supplierProfiles.organizationId, offers.supplierOrganizationId),
    )
    .where(
      and(
        eq(offers.purchaseRequestId, purchaseRequestId),
        inArray(offers.status, ["submitted", "locked", "selected", "not_selected"]),
      ),
    );

  const scored = scoreOffers(
    rows.map((row) => ({
      offerId: row.offerId,
      totalAmount: Number(row.totalAmount),
      proposedDeliveryDate: row.proposedDeliveryDate,
      meetsDeliveryDate: row.meetsDeliveryDate,
      deliveryDaysDiff: row.deliveryDaysDiff,
      supplierRating: Number(row.ratingAverage ?? 0),
    })),
  );

  for (const score of scored) {
    await db
      .insert(offerScores)
      .values({
        offerId: score.offerId,
        priceScore: score.priceScore.toFixed(2),
        deliveryScore: score.deliveryScore.toFixed(2),
        ratingScore: score.ratingScore.toFixed(2),
        totalScore: score.totalScore.toFixed(2),
        isBestValue: score.isBestValue,
        isCheapest: score.isCheapest,
        isFastest: score.isFastest,
        isHighestRated: score.isHighestRated,
        explanation: score.explanation,
      })
      .onConflictDoUpdate({
        target: offerScores.offerId,
        set: {
          priceScore: score.priceScore.toFixed(2),
          deliveryScore: score.deliveryScore.toFixed(2),
          ratingScore: score.ratingScore.toFixed(2),
          totalScore: score.totalScore.toFixed(2),
          isBestValue: score.isBestValue,
          isCheapest: score.isCheapest,
          isFastest: score.isFastest,
          isHighestRated: score.isHighestRated,
          explanation: score.explanation,
          updatedAt: new Date(),
        },
      });
  }

  return scored;
}

export async function selectOffer(formData: FormData) {
  const session = await requireSession(["buyer"]);
  const offerId = z.string().uuid().parse(formData.get("offerId"));
  const confirmed = formData.get("confirm") === "yes";
  if (!confirmed) throw new Error("CONFIRM_REQUIRED");

  const db = getDb();
  const [offer] = await db.select().from(offers).where(eq(offers.id, offerId)).limit(1);
  if (!offer) throw new Error("NOT_FOUND");

  const [request] = await db
    .select()
    .from(purchaseRequests)
    .where(
      and(
        eq(purchaseRequests.id, offer.purchaseRequestId),
        eq(purchaseRequests.organizationId, session.organizationId),
      ),
    )
    .limit(1);

  if (!request) throw new Error("FORBIDDEN");
  if (request.status !== "published") throw new Error("INVALID_STATE");
  if (!isDeadlinePassed(request.submissionDeadline)) throw new Error("DEADLINE_NOT_PASSED");
  if (!["submitted", "locked"].includes(offer.status)) throw new Error("INVALID_OFFER");

  const [existingPo] = await db
    .select({ id: purchaseOrders.id })
    .from(purchaseOrders)
    .where(eq(purchaseOrders.offerId, offer.id))
    .limit(1);
  if (existingPo) throw new Error("PO_EXISTS");

  const lines = await db.select().from(offerItems).where(eq(offerItems.offerId, offer.id));
  const now = new Date();

  const order = await db.transaction(async (tx) => {
    await tx
      .update(purchaseRequests)
      .set({
        status: "awarded",
        awardedAt: now,
        selectedOfferId: offer.id,
      })
      .where(eq(purchaseRequests.id, request.id));

    await tx
      .update(offers)
      .set({ status: "selected", isLocked: true, lockedAt: now })
      .where(eq(offers.id, offer.id));

    await tx
      .update(offers)
      .set({ status: "not_selected", isLocked: true })
      .where(
        and(
          eq(offers.purchaseRequestId, request.id),
          ne(offers.id, offer.id),
          inArray(offers.status, ["submitted", "locked", "draft"]),
        ),
      );

    await tx.insert(purchaseRequestStatusHistory).values({
      purchaseRequestId: request.id,
      fromStatus: "published",
      toStatus: "awarded",
      changedByUserId: session.id,
      note: "اختيار عرض وإنشاء أمر شراء",
    });

    const [created] = await tx
      .insert(purchaseOrders)
      .values({
        code: await nextDocumentCode(tx, purchaseOrders, "PO"),
        offerId: offer.id,
        finalOfferId: null,
        purchaseRequestId: request.id,
        buyerOrganizationId: request.organizationId,
        supplierOrganizationId: offer.supplierOrganizationId,
        status: "issued",
        fulfillmentStatus: "new",
        receiptStatus: "pending",
        totalAmount: offer.totalAmount,
        deliveryFee: offer.deliveryFee,
        paymentTerms: offer.paymentTerms,
        expectedDeliveryDate: offer.proposedDeliveryDate,
        issuedAt: now,
      })
      .returning();

    await tx.insert(purchaseOrderItems).values(
      lines.map((line) => ({
        purchaseOrderId: created.id,
        productId: null,
        productName: line.offeredProductName,
        quantity: line.availableQuantity,
        unitPrice: line.unitPrice,
        lineTotal: line.lineTotal,
        specificationNote: line.specificationNote,
      })),
    );

    await tx.insert(fulfillmentEvents).values({
      purchaseOrderId: created.id,
      fromStatus: null,
      toStatus: "new",
      changedByUserId: session.id,
      note: "إنشاء أمر الشراء",
    });

    return created;
  });

  await recomputeOfferScores(request.id);

  await writeAuditLog({
    actorUserId: session.id,
    action: "offer.select",
    entityType: "offer",
    entityId: offer.id,
    details: order.code,
  });

  await notifyOrganizationUsers({
    organizationId: offer.supplierOrganizationId,
    title: "تم اختيار عرضك",
    body: `تم اختيار عرضك للطلب ${request.code}. صدر أمر توريد ${order.code}.`,
    linkPath: `/supplier/purchase-orders/${order.id}`,
  });

  await notifyUser({
    userId: session.id,
    title: "تم إنشاء أمر الشراء",
    body: `أُنشئ أمر الشراء ${order.code} من العرض المختار.`,
    linkPath: `/buyer/purchase-orders/${order.id}`,
  });

  revalidatePath("/buyer/offers");
  revalidatePath("/buyer/purchase-orders");
  revalidatePath("/supplier/offers");
  revalidatePath("/supplier/purchase-orders");
  invalidateBuyerListCaches(session.organizationId);
  invalidateSupplierOpportunityCaches();
  redirect(`/buyer/purchase-orders/${order.id}`);
}

export async function updateFulfillmentStatus(formData: FormData) {
  const session = await requireSession(["supplier"]);
  const purchaseOrderId = z.string().uuid().parse(formData.get("purchaseOrderId"));
  const nextStatus = z
    .enum(FULFILLMENT_FLOW)
    .parse(formData.get("fulfillmentStatus"));
  const note = optionalString(formData.get("note"));

  const db = getDb();
  const [order] = await db
    .select()
    .from(purchaseOrders)
    .where(
      and(
        eq(purchaseOrders.id, purchaseOrderId),
        eq(purchaseOrders.supplierOrganizationId, session.organizationId),
      ),
    )
    .limit(1);

  if (!order) throw new Error("FORBIDDEN");

  const currentIndex = FULFILLMENT_FLOW.indexOf(order.fulfillmentStatus);
  const nextIndex = FULFILLMENT_FLOW.indexOf(nextStatus);
  if (nextIndex < 0 || nextIndex < currentIndex) throw new Error("INVALID_TRANSITION");

  const poStatus =
    nextStatus === "delivered"
      ? ("delivered" as const)
      : nextStatus === "new"
        ? ("issued" as const)
        : nextStatus === "confirmed"
          ? ("confirmed" as const)
          : ("in_fulfillment" as const);

  await db.transaction(async (tx) => {
    await tx
      .update(purchaseOrders)
      .set({
        fulfillmentStatus: nextStatus,
        status: poStatus,
      })
      .where(eq(purchaseOrders.id, order.id));

    await tx.insert(fulfillmentEvents).values({
      purchaseOrderId: order.id,
      fromStatus: order.fulfillmentStatus,
      toStatus: nextStatus,
      changedByUserId: session.id,
      note: note ?? null,
    });
  });

  await writeAuditLog({
    actorUserId: session.id,
    action: "fulfillment.update",
    entityType: "purchase_order",
    entityId: order.id,
    details: `${order.fulfillmentStatus}->${nextStatus}`,
  });

  await notifyOrganizationUsers({
    organizationId: order.buyerOrganizationId,
    title: "تحديث حالة التوريد",
    body: `تم تحديث أمر ${order.code} إلى حالة جديدة.`,
    linkPath: `/buyer/purchase-orders/${order.id}`,
  });

  revalidatePath(`/supplier/purchase-orders/${order.id}`);
  revalidatePath(`/buyer/purchase-orders/${order.id}`);
  revalidatePath("/supplier/purchase-orders");
  revalidatePath("/buyer/purchase-orders");
  redirect(`/supplier/purchase-orders/${order.id}`);
}

export async function confirmReceipt(formData: FormData) {
  const session = await requireSession(["buyer"]);
  const purchaseOrderId = z.string().uuid().parse(formData.get("purchaseOrderId"));
  const receiptStatus = z
    .enum(["received_full", "received_with_issue"])
    .parse(formData.get("receiptStatus"));
  const note = optionalString(formData.get("note"));

  const db = getDb();
  const [order] = await db
    .select()
    .from(purchaseOrders)
    .where(
      and(
        eq(purchaseOrders.id, purchaseOrderId),
        eq(purchaseOrders.buyerOrganizationId, session.organizationId),
      ),
    )
    .limit(1);

  if (!order) throw new Error("FORBIDDEN");
  if (order.fulfillmentStatus !== "delivered") throw new Error("NOT_DELIVERED");

  await db
    .update(purchaseOrders)
    .set({
      receiptStatus,
      status: "delivered",
    })
    .where(eq(purchaseOrders.id, order.id));

  await db.insert(fulfillmentEvents).values({
    purchaseOrderId: order.id,
    fromStatus: order.fulfillmentStatus,
    toStatus: order.fulfillmentStatus,
    changedByUserId: session.id,
    note:
      note ??
      (receiptStatus === "received_full"
        ? "تأكيد الاستلام بالكامل"
        : "تأكيد الاستلام مع ملاحظة"),
  });

  if (order.purchaseRequestId) {
    await db
      .update(purchaseRequests)
      .set({ status: "closed" })
      .where(eq(purchaseRequests.id, order.purchaseRequestId));
  }

  await writeAuditLog({
    actorUserId: session.id,
    action: "receipt.confirm",
    entityType: "purchase_order",
    entityId: order.id,
    details: receiptStatus,
  });

  await notifyOrganizationUsers({
    organizationId: order.supplierOrganizationId,
    title: "تأكيد استلام من المشتري",
    body: `أكد المشتري استلام أمر ${order.code}.`,
    linkPath: `/supplier/purchase-orders/${order.id}`,
  });

  revalidatePath(`/buyer/purchase-orders/${order.id}`);
  revalidatePath(`/supplier/purchase-orders/${order.id}`);
  redirect(`/buyer/purchase-orders/${order.id}`);
}

/** Development-only: advance offer deadline so comparison/selection can be tested. */
export async function advanceOfferDeadlineForDemo(formData: FormData) {
  if (process.env.DEMO_AUTH_ENABLED === "false") {
    throw new Error("DEMO_DISABLED");
  }
  const session = await requireSession(["buyer"]);
  const purchaseRequestId = z.string().uuid().parse(formData.get("purchaseRequestId"));
  const db = getDb();
  const [request] = await db
    .select()
    .from(purchaseRequests)
    .where(
      and(
        eq(purchaseRequests.id, purchaseRequestId),
        eq(purchaseRequests.organizationId, session.organizationId),
      ),
    )
    .limit(1);
  if (!request) throw new Error("FORBIDDEN");

  const past = new Date(Date.now() - 60_000);
  await db
    .update(purchaseRequests)
    .set({ submissionDeadline: past })
    .where(eq(purchaseRequests.id, request.id));

  await recomputeOfferScores(request.id);

  await writeAuditLog({
    actorUserId: session.id,
    action: "demo.advance_deadline",
    entityType: "purchase_request",
    entityId: request.id,
  });

  revalidatePath(`/buyer/requests/${request.id}/offers`);
  invalidateBuyerListCaches(session.organizationId);
  invalidateSupplierOpportunityCaches();
  redirect(`/buyer/requests/${request.id}/offers`);
}

export async function updateSupplierProfile(formData: FormData) {
  const session = await requireSession(["supplier"]);
  const about = optionalString(formData.get("about"));
  const city = optionalString(formData.get("city"));
  const serviceCitiesRaw = optionalString(formData.get("serviceCities"));
  if (!city) throw new Error("CITY_REQUIRED");
  if (!serviceCitiesRaw) throw new Error("SERVICE_CITIES_REQUIRED");

  const serviceCities = serviceCitiesRaw
    .split(/[،,]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .join("، ");

  const db = getDb();
  await db
    .update(organizations)
    .set({ city })
    .where(eq(organizations.id, session.organizationId));

  const [profile] = await db
    .select()
    .from(supplierProfiles)
    .where(eq(supplierProfiles.organizationId, session.organizationId))
    .limit(1);

  if (profile) {
    await db
      .update(supplierProfiles)
      .set({ about: about ?? null, serviceCities })
      .where(eq(supplierProfiles.id, profile.id));
  } else {
    await db.insert(supplierProfiles).values({
      organizationId: session.organizationId,
      about: about ?? null,
      serviceCities,
    });
  }

  revalidatePath("/supplier/profile");
  revalidatePath("/supplier/opportunities");
  invalidateSupplierOpportunityCaches(session.organizationId);
  redirect("/supplier/profile?saved=1");
}

export async function refreshOfferScoresAction(formData: FormData) {
  const session = await requireSession(["buyer"]);
  const purchaseRequestId = z.string().uuid().parse(formData.get("purchaseRequestId"));
  const db = getDb();
  const [request] = await db
    .select({ id: purchaseRequests.id })
    .from(purchaseRequests)
    .where(
      and(
        eq(purchaseRequests.id, purchaseRequestId),
        eq(purchaseRequests.organizationId, session.organizationId),
      ),
    )
    .limit(1);
  if (!request) throw new Error("FORBIDDEN");
  await recomputeOfferScores(purchaseRequestId);
  revalidatePath(`/buyer/requests/${purchaseRequestId}/offers`);
}
