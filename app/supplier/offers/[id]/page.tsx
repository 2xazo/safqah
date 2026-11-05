import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { offerItems, offers, offerScores, purchaseRequests } from "@/db/schema";
import { Badge, PageHeader, StatusPill } from "@/components/ui";
import { requireRole } from "@/lib/rbac";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { isDeadlinePassed } from "@/lib/workflow";

export default async function SupplierOfferDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireRole(["supplier"]);
  const db = getDb();

  const [offer] = await db
    .select({
      id: offers.id,
      code: offers.code,
      status: offers.status,
      offerValidityDate: offers.offerValidityDate,
      deliveryFee: offers.deliveryFee,
      paymentTerms: offers.paymentTerms,
      notes: offers.notes,
      proposedDeliveryDate: offers.proposedDeliveryDate,
      meetsDeliveryDate: offers.meetsDeliveryDate,
      subtotalAmount: offers.subtotalAmount,
      taxAmount: offers.taxAmount,
      totalAmount: offers.totalAmount,
      submittedAt: offers.submittedAt,
      requestId: purchaseRequests.id,
      requestTitle: purchaseRequests.title,
      requestCode: purchaseRequests.code,
      requestStatus: purchaseRequests.status,
      submissionDeadline: purchaseRequests.submissionDeadline,
    })
    .from(offers)
    .innerJoin(purchaseRequests, eq(purchaseRequests.id, offers.purchaseRequestId))
    .where(and(eq(offers.id, id), eq(offers.supplierOrganizationId, session.organizationId)))
    .limit(1);

  if (!offer) notFound();

  const lines = await db.select().from(offerItems).where(eq(offerItems.offerId, offer.id));
  const [score] = await db.select().from(offerScores).where(eq(offerScores.offerId, offer.id)).limit(1);
  const deadlinePassed = isDeadlinePassed(offer.submissionDeadline);

  return (
    <>
      <PageHeader
        title={`عرضي — ${offer.requestTitle}`}
        description={`${offer.code} · للطلب ${offer.requestCode}`}
        actions={<StatusPill kind="offer" value={offer.status} />}
      />

      <div className="offer-layout">
        <section className="panel">
          <h3 style={{ marginTop: 0 }}>بنود العرض</h3>
          {lines.map((line) => (
            <div className="product-line" key={line.id}>
              <div className="product-letter">م</div>
              <div>
                <h3>{line.offeredProductName}</h3>
                <p>
                  {line.brandName ? `العلامة: ${line.brandName} · ` : ""}
                  {line.availableQuantity} × {formatMoney(line.unitPrice)}
                  {line.isAlternative ? " · بديل مقترح" : ""}
                </p>
              </div>
              <strong>{formatMoney(line.lineTotal)}</strong>
            </div>
          ))}
          <div className="price-summary">
            <span>
              المجموع الفرعي <b>{formatMoney(offer.subtotalAmount)}</b>
            </span>
            <span>
              رسوم التوصيل <b>{formatMoney(offer.deliveryFee)}</b>
            </span>
            <span>
              الضريبة <b>{formatMoney(offer.taxAmount)}</b>
            </span>
            <span className="total">
              الإجمالي <b>{formatMoney(offer.totalAmount)}</b>
            </span>
          </div>
        </section>

        <aside className="panel decision-panel">
          <h3>معلومات إضافية</h3>
          {offer.status === "locked" ? (
            <p className="helper-text" style={{ marginBottom: 12 }}>
              الحالة «مقفل» تعني أن العرض قُدِّم ولم يعد قابلاً للتعديل حتى انتهاء الموعد أو صدور القرار.
            </p>
          ) : null}
          <p style={{ fontSize: 13.5, color: "var(--muted)" }}>
            تاريخ التسليم المقترح: {formatDate(offer.proposedDeliveryDate)}
          </p>
          <p style={{ fontSize: 11, color: "var(--muted)" }}>
            صلاحية العرض: {formatDate(offer.offerValidityDate)}
          </p>
          {offer.paymentTerms ? (
            <p style={{ fontSize: 11, color: "var(--muted)" }}>شروط الدفع: {offer.paymentTerms}</p>
          ) : null}
          {offer.notes ? (
            <p style={{ fontSize: 11, color: "var(--muted)" }}>ملاحظات: {offer.notes}</p>
          ) : null}
          <p style={{ fontSize: 11, color: "var(--muted)" }}>
            قُدِّم في: {formatDateTime(offer.submittedAt)}
          </p>

          {deadlinePassed && score ? (
            <div className="sealed-banner" style={{ marginTop: 14 }}>
              <span>◎</span>
              <div>
                <strong>نتيجة التقييم متاحة</strong>
                <p>{score.explanation}</p>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                  {score.isBestValue ? <Badge tone="gold">أفضل قيمة</Badge> : null}
                  {score.isCheapest ? <Badge tone="green">الأقل سعرًا</Badge> : null}
                  {score.isFastest ? <Badge tone="blue">الأسرع توصيلًا</Badge> : null}
                  {score.isHighestRated ? <Badge tone="purple">الأعلى تقييمًا</Badge> : null}
                </div>
              </div>
            </div>
          ) : !deadlinePassed ? (
            <p className="warning" style={{ marginTop: 14 }}>
              يظهر ترتيب العروض بعد إغلاق باب التقديم على الطلب.
            </p>
          ) : null}

          <Link className="btn outline wide" href="/supplier/offers" style={{ marginTop: 14 }}>
            العودة لعروضي
          </Link>
          <Link
            className="btn ghost wide"
            href={`/supplier/opportunities/${offer.requestId}`}
            style={{ marginTop: 8 }}
          >
            عرض تفاصيل الطلب
          </Link>
        </aside>
      </div>
    </>
  );
}
