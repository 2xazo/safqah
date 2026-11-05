import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { fulfillmentEvents, organizations, purchaseOrderItems, purchaseOrders } from "@/db/schema";
import { PageHeader, StatusPill } from "@/components/ui";
import { requireRole } from "@/lib/rbac";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { FULFILLMENT_FLOW, statusEntry } from "@/lib/status-labels";
import { updateFulfillmentStatus } from "@/app/actions/mutations";

export default async function SupplierPurchaseOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireRole(["supplier"]);
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
      buyerName: organizations.name,
      buyerCity: organizations.city,
    })
    .from(purchaseOrders)
    .innerJoin(organizations, eq(organizations.id, purchaseOrders.buyerOrganizationId))
    .where(
      and(eq(purchaseOrders.id, id), eq(purchaseOrders.supplierOrganizationId, session.organizationId)),
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

  const currentIndex = FULFILLMENT_FLOW.indexOf(po.fulfillmentStatus);
  const nextOptions = FULFILLMENT_FLOW.filter((_, index) => index > currentIndex);

  return (
    <>
      <PageHeader
        title={po.code}
        description={`المشتري: ${po.buyerName} · ${po.buyerCity}`}
        actions={<StatusPill kind="fulfillment" value={po.fulfillmentStatus} />}
      />

      <div className="offer-layout">
        <section className="panel">
          <h3 style={{ marginTop: 0 }}>بنود أمر التوريد</h3>
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

          <h3>سجل حالة التوريد</h3>
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
            حالة الاستلام لدى المشتري: {statusEntry("receipt", po.receiptStatus).label}
          </p>

          {nextOptions.length > 0 ? (
            <form action={updateFulfillmentStatus} style={{ marginTop: 18 }}>
              <input type="hidden" name="purchaseOrderId" value={po.id} />
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, marginBottom: 8 }}>
                تحديث حالة التوريد
                <select name="fulfillmentStatus" required defaultValue="" style={{ marginTop: 6 }}>
                  <option value="" disabled>
                    اختر الحالة التالية
                  </option>
                  {nextOptions.map((status) => (
                    <option key={status} value={status}>
                      {statusEntry("fulfillment", status).label}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ display: "block", fontSize: 11, marginBottom: 8 }}>
                ملاحظة (اختياري)
                <input name="note" style={{ marginTop: 6 }} />
              </label>
              <div className="panel-actions">
                <button className="btn primary" type="submit">
                  تحديث الحالة
                </button>
              </div>
            </form>
          ) : (
            <p className="warning" style={{ marginTop: 18 }}>
              تم الوصول لآخر حالة في مسار التوريد.
            </p>
          )}

          <Link className="btn ghost wide" href="/supplier/purchase-orders" style={{ marginTop: 14 }}>
            العودة لأوامر التوريد
          </Link>
        </aside>
      </div>
    </>
  );
}
