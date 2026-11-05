import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { offerItems, offers, purchaseRequestItems } from "@/db/schema";
import { EmptyState, PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/rbac";
import { formatDate, formatDateTime } from "@/lib/format";
import { isDeadlinePassed } from "@/lib/workflow";
import { listPublishedOpportunitiesForSupplier } from "@/lib/matching";
import { OfferForm } from "@/components/offer-form";

export default async function SupplierOfferFormPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireRole(["supplier"]);
  const db = getDb();

  const opportunities = await listPublishedOpportunitiesForSupplier(session.organizationId);
  const opportunity = opportunities.find((o) => o.id === id);
  if (!opportunity) notFound();

  const items = await db
    .select({
      id: purchaseRequestItems.id,
      productName: purchaseRequestItems.productName,
      quantity: purchaseRequestItems.quantity,
      unitLabel: purchaseRequestItems.unitLabel,
      specificationNotes: purchaseRequestItems.specificationNotes,
      brandPreference: purchaseRequestItems.brandPreference,
      acceptedAlternatives: purchaseRequestItems.acceptedAlternatives,
    })
    .from(purchaseRequestItems)
    .where(eq(purchaseRequestItems.purchaseRequestId, id))
    .orderBy(purchaseRequestItems.sortOrder);

  const [existingOffer] = await db
    .select()
    .from(offers)
    .where(
      and(
        eq(offers.purchaseRequestId, id),
        eq(offers.supplierOrganizationId, session.organizationId),
      ),
    )
    .limit(1);

  const existingLines = existingOffer
    ? await db.select().from(offerItems).where(eq(offerItems.offerId, existingOffer.id))
    : [];

  const deadlinePassed = isDeadlinePassed(opportunity.submissionDeadline);
  const isLocked =
    existingOffer && (existingOffer.isLocked || ["locked", "selected", "not_selected"].includes(existingOffer.status));

  return (
    <>
      <PageHeader
        title={`تقديم عرض — ${opportunity.title}`}
        description={`${opportunity.code} · التسليم المطلوب: ${formatDate(
          opportunity.neededByDate,
        )} · آخر موعد للتقديم: ${formatDateTime(opportunity.submissionDeadline)}`}
      />

      {opportunity.status !== "published" || deadlinePassed ? (
        <EmptyState
          title="لا يمكن تقديم عرض على هذا الطلب"
          description={
            deadlinePassed
              ? "انتهى الموعد النهائي لاستقبال العروض على هذا الطلب."
              : "هذا الطلب لم يعد متاحًا لاستقبال العروض."
          }
          actionHref={`/supplier/opportunities/${id}`}
          actionLabel="العودة لتفاصيل الفرصة"
        />
      ) : isLocked ? (
        <EmptyState
          title="لقد قدّمت عرضك بالفعل"
          description="تم قفل عرضك ولا يمكن تعديله بعد التقديم."
          actionHref={`/supplier/offers/${existingOffer!.id}`}
          actionLabel="عرض تفاصيل عرضي"
        />
      ) : items.length === 0 ? (
        <EmptyState title="لا توجد بنود في هذا الطلب" />
      ) : (
        <OfferForm
          purchaseRequestId={id}
          items={items}
          neededByDate={opportunity.neededByDate}
          existing={
            existingOffer
              ? {
                  offerValidityDate: existingOffer.offerValidityDate,
                  deliveryFee: existingOffer.deliveryFee,
                  paymentTerms: existingOffer.paymentTerms,
                  notes: existingOffer.notes,
                  proposedDeliveryDate: existingOffer.proposedDeliveryDate,
                  lines: existingLines.map((line) => ({
                    purchaseRequestItemId: line.purchaseRequestItemId,
                    offeredProductName: line.offeredProductName,
                    brandName: line.brandName,
                    specificationNote: line.specificationNote,
                    availableQuantity: line.availableQuantity,
                    unitPrice: line.unitPrice,
                    isAlternative: line.isAlternative,
                  })),
                }
              : null
          }
        />
      )}

      <p style={{ marginTop: 16 }}>
        <Link href={`/supplier/opportunities/${id}`}>العودة لتفاصيل الفرصة</Link>
      </p>
    </>
  );
}
