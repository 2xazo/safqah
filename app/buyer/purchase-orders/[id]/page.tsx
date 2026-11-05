import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { fulfillmentEvents, organizations, purchaseOrderItems, purchaseOrders } from "@/db/schema";
import { PageHeader, StatusPill } from "@/components/ui";
import { requireRole } from "@/lib/rbac";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { statusEntry } from "@/lib/status-labels";
import { confirmReceipt } from "@/app/actions/mutations";

export default async function BuyerPurchaseOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireRole(["buyer"]);
  const db = getDb();

  const [po] = await db
    .select({
      id: purchaseOrders.id,
      code: purchaseOrders.code,
      status: purchaseOrders.status,
      fulfillmentStatus: purchaseOrders.fulfillmentStatus,
      receiptStatus: purchaseOrders.receiptStatus,
      totalAmount: purchaseOrders.totalAmount,
      deliveryFee: purchaseOrders.deliveryFee,
      paymentTerms: purchaseOrders.paymentTerms,
      expectedDeliveryDate: purchaseOrders.expectedDeliveryDate,
      issuedAt: purchaseOrders.issuedAt,
      purchaseRequestId: purchaseOrders.purchaseRequestId,
      supplierName: organizations.name,
      supplierCity: organizations.city,
    })
    .from(purchaseOrders)
    .innerJoin(organizations, eq(organizations.id, purchaseOrders.supplierOrganizationId))
    .where(
      and(eq(purchaseOrders.id, id), eq(purchaseOrders.buyerOrganizationId, session.organizationId)),
    )
    .limit(1);

  if (!po) notFound();

  const items = await db
    .select()
    .from(purchaseOrderItems)
    .where(eq(purchaseOrderItems.purchaseOrderId, po.id));

  const events = await db
    .select()
    .from(fulfillmentEvents)
    .where(eq(fulfillmentEvents.purchaseOrderId, po.id))
    .orderBy(asc(fulfillmentEvents.createdAt));

  const canConfirmReceipt = po.fulfillmentStatus === "delivered" && po.receiptStatus === "pending";

  return (
    <>
      <PageHeader
        title={po.code}
        description={`المورد: ${po.supplierName} · ${po.supplierCity}`}
        actions={<StatusPill kind="fulfillment" value={po.fulfillmentStatus} />}
      />

      <div className="offer-layout">
        <section className="panel">
          <h3 style={{ marginTop: 0 }}>بنود أمر الشراء</h3>
          {items.map((item) => (
            <div className="product-line" key={item.id}>
              <div className="product-letter">م</div>
              <div>
                <h3>{item.productName}</h3>
                <p>
                  {item.quantity} × {formatMoney(item.unitPrice)}
                  {item.specificationNote ? ` · ${item.specificationNote}` : ""}
                </p>
              </div>
              <strong>{formatMoney(item.lineTotal)}</strong>
            </div>
          ))}
          <div className="price-summary">
            <span>
              رسوم التوصيل <b>{formatMoney(po.deliveryFee)}</b>
            </span>
            <span className="total">
              الإجمالي <b>{formatMoney(po.totalAmount)}</b>
            </span>
          </div>

          <h3>مسار التوريد</h3>
          {events.length === 0 ? (
            <p style={{ fontSize: 12, color: "var(--muted)" }}>لا يوجد سجل بعد.</p>
          ) : (
            <div className="delivery-timeline">
              {events.map((ev) => (
                <div className="complete" key={ev.id}>
                  <span>✓</span>
                  <strong>{statusEntry("fulfillment", ev.toStatus).label}</strong>
                  <small>{formatDateTime(ev.createdAt)}</small>
                </div>
              ))}
            </div>
          )}
        </section>

        <aside className="panel decision-panel">
          <h3>معلومات الأمر</h3>
          <p style={{ fontSize: 11, color: "var(--muted)" }}>
            تاريخ الإصدار: {formatDateTime(po.issuedAt)}
          </p>
          <p style={{ fontSize: 11, color: "var(--muted)" }}>
            التسليم المتوقع: {formatDate(po.expectedDeliveryDate)}
          </p>
          {po.paymentTerms ? (
            <p style={{ fontSize: 11, color: "var(--muted)" }}>شروط الدفع: {po.paymentTerms}</p>
          ) : null}
          <p style={{ fontSize: 11, color: "var(--muted)" }}>
            حالة الاستلام: <StatusPill kind="receipt" value={po.receiptStatus} />
          </p>

          {canConfirmReceipt ? (
            <form action={confirmReceipt} style={{ marginTop: 16 }}>
              <input type="hidden" name="purchaseOrderId" value={po.id} />
              <p className="warning" style={{ marginTop: 0 }}>
                تم تسليم أمر التوريد. يرجى تأكيد استلامك للأصناف.
              </p>
              <label className="check">
                <input type="radio" name="receiptStatus" value="received_full" defaultChecked required />
                استلمت جميع الأصناف بحالة جيدة
              </label>
              <label className="check">
                <input type="radio" name="receiptStatus" value="received_with_issue" required />
                استلمت الأصناف مع وجود ملاحظة
              </label>
              <label style={{ display: "block", fontSize: 11, marginTop: 8 }}>
                ملاحظة (اختياري)
                <input name="note" style={{ marginTop: 6 }} />
              </label>
              <div className="panel-actions" style={{ marginTop: 10 }}>
                <button className="btn primary" type="submit">
                  تأكيد الاستلام
                </button>
              </div>
            </form>
          ) : null}

          {po.purchaseRequestId ? (
            <Link
              className="btn ghost wide"
              href={`/buyer/requests/${po.purchaseRequestId}`}
              style={{ marginTop: 14 }}
            >
              عرض طلب الشراء الأصلي
            </Link>
          ) : null}
          <Link className="btn outline wide" href="/buyer/purchase-orders" style={{ marginTop: 10 }}>
            العودة لأوامر الشراء
          </Link>
        </aside>
      </div>
    </>
  );
}
