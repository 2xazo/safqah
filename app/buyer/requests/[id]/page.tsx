import Link from "next/link";
import { notFound } from "next/navigation";
import { and, count, eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  offers,
  purchaseOrders,
  purchaseRequestItems,
  purchaseRequests,
  purchaseRequestStatusHistory,
} from "@/db/schema";
import { PageHeader, StatusPill } from "@/components/ui";
import { requireRole } from "@/lib/rbac";
import { formatDate, formatDateTime } from "@/lib/format";
import { statusEntry } from "@/lib/status-labels";

export default async function BuyerRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireRole(["buyer"]);
  const db = getDb();

  const [request] = await db
    .select()
    .from(purchaseRequests)
    .where(
      and(eq(purchaseRequests.id, id), eq(purchaseRequests.organizationId, session.organizationId)),
    )
    .limit(1);

  if (!request) notFound();

  const items = await db
    .select()
    .from(purchaseRequestItems)
    .where(eq(purchaseRequestItems.purchaseRequestId, request.id))
    .orderBy(purchaseRequestItems.sortOrder);

  const history = await db
    .select()
    .from(purchaseRequestStatusHistory)
    .where(eq(purchaseRequestStatusHistory.purchaseRequestId, request.id));

  const [offerCount] = await db
    .select({ value: count() })
    .from(offers)
    .where(eq(offers.purchaseRequestId, request.id));

  const [relatedOrder] =
    request.status === "awarded"
      ? await db
          .select({ id: purchaseOrders.id, code: purchaseOrders.code })
          .from(purchaseOrders)
          .where(eq(purchaseOrders.purchaseRequestId, request.id))
          .limit(1)
      : [];

  return (
    <>
      <PageHeader
        title={request.title}
        description={`${request.code} · أُنشئ في ${formatDateTime(request.createdAt)}`}
        actions={<StatusPill kind="purchaseRequest" value={request.status} />}
      />

      <div className="offer-layout">
        <section className="panel">
          <h3 style={{ marginTop: 0 }}>بنود الطلب</h3>
          {items.map((item) => (
            <div className="product-line" key={item.id}>
              <div className="product-letter">م</div>
              <div>
                <h3>{item.productName}</h3>
                <p>{item.description || item.specificationNotes || "بدون ملاحظات مواصفات"}</p>
                {item.brandPreference ? <p>تفضيل العلامة: {item.brandPreference}</p> : null}
                {item.acceptedAlternatives ? <p>بدائل مقبولة: {item.acceptedAlternatives}</p> : null}
                {item.minShelfLifeMonths ? (
                  <p>الحد الأدنى للصلاحية: {item.minShelfLifeMonths} شهر</p>
                ) : null}
              </div>
              <strong>
                {item.quantity} {item.unitLabel}
              </strong>
            </div>
          ))}
          {request.notes ? (
            <p style={{ fontSize: 12, color: "var(--muted)" }}>ملاحظات عامة: {request.notes}</p>
          ) : null}
        </section>

        <aside className="panel decision-panel">
          <h3>تفاصيل التوصيل والموعد</h3>
          <div className="deadline" style={{ marginTop: 10 }}>
            آخر موعد لتقديم العروض
            <strong>{formatDateTime(request.submissionDeadline)}</strong>
          </div>
          <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 14 }}>
            تاريخ التسليم المطلوب: {formatDate(request.neededByDate)}
          </p>
          <p style={{ fontSize: 11, color: "var(--muted)" }}>
            مدينة التوصيل: {request.deliveryCity}
            {request.deliveryDistrict ? ` — ${request.deliveryDistrict}` : ""}
          </p>
          {request.deliveryAddressText ? (
            <p style={{ fontSize: 11, color: "var(--muted)" }}>
              العنوان: {request.deliveryAddressText}
            </p>
          ) : null}

          <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 14 }}>
            عدد العروض المستلمة: {offerCount.value}
          </p>

          {request.status === "published" ? (
            <Link
              className="btn primary wide"
              href={`/buyer/requests/${request.id}/offers`}
              style={{ marginTop: 12 }}
            >
              عرض العروض الواردة
            </Link>
          ) : null}

          {relatedOrder ? (
            <Link
              className="btn outline wide"
              href={`/buyer/purchase-orders/${relatedOrder.id}`}
              style={{ marginTop: 10 }}
            >
              عرض أمر الشراء {relatedOrder.code}
            </Link>
          ) : null}

          <div style={{ marginTop: 20 }}>
            <h3 style={{ fontSize: 13 }}>سجل الحالة</h3>
            {history.length === 0 ? (
              <p style={{ fontSize: 11, color: "var(--muted)" }}>لا يوجد سجل بعد.</p>
            ) : (
              history.map((h) => (
                <div className="task" key={h.id}>
                  <span className="dot" />
                  <div>
                    <strong>{statusEntry("purchaseRequest", h.toStatus).label}</strong>
                    <small>
                      {formatDateTime(h.createdAt)}
                      {h.note ? ` · ${h.note}` : ""}
                    </small>
                  </div>
                </div>
              ))
            )}
          </div>

          <Link className="btn ghost wide" href="/buyer/requests" style={{ marginTop: 14 }}>
            العودة للطلبات
          </Link>
        </aside>
      </div>
    </>
  );
}
