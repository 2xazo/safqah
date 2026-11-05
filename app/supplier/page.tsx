import Link from "next/link";
import { and, count, desc, eq, ne } from "drizzle-orm";
import { getDb } from "@/db";
import { notifications, offers, purchaseOrders } from "@/db/schema";
import { EmptyState, PageHeader, StatCard } from "@/components/ui";
import { requireRole } from "@/lib/rbac";
import { formatDateTime } from "@/lib/format";
import { opportunityState } from "@/lib/workflow";
import { listPublishedOpportunitiesForSupplier } from "@/lib/matching";

export default async function SupplierDashboardPage() {
  const session = await requireRole(["supplier"]);
  const db = getDb();
  const orgId = session.organizationId;

  const [
    opportunities,
    myOfferRows,
    [ordersNeedingAction],
    recentActivity,
  ] = await Promise.all([
    listPublishedOpportunitiesForSupplier(orgId),
    db
      .select({
        requestId: offers.purchaseRequestId,
        status: offers.status,
      })
      .from(offers)
      .where(eq(offers.supplierOrganizationId, orgId)),
    db
      .select({ value: count() })
      .from(purchaseOrders)
      .where(
        and(eq(purchaseOrders.supplierOrganizationId, orgId), ne(purchaseOrders.fulfillmentStatus, "delivered")),
      ),
    db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, session.id))
      .orderBy(desc(notifications.createdAt))
      .limit(6),
  ]);

  const offeredSet = new Set(myOfferRows.map((r) => r.requestId));
  const winnerSet = new Set(
    myOfferRows.filter((r) => r.status === "selected").map((r) => r.requestId),
  );
  const awaitingResult = {
    value: myOfferRows.filter(
      (offer) => offer.status === "submitted" || offer.status === "locked",
    ).length,
  };

  const newOpportunities = opportunities.filter(
    (o) =>
      opportunityState({
        requestStatus: o.status,
        submissionDeadline: o.submissionDeadline,
        hasOffer: offeredSet.has(o.id),
        isWinner: winnerSet.has(o.id),
      }) === "available",
  );

  const highlightedOpportunities = [...newOpportunities]
    .sort((a, b) => {
      const da = a.submissionDeadline ? new Date(a.submissionDeadline).getTime() : Infinity;
      const dbb = b.submissionDeadline ? new Date(b.submissionDeadline).getTime() : Infinity;
      return da - dbb;
    })
    .slice(0, 5);

  return (
    <>
      <PageHeader
        eyebrow="سوق الفرص"
        title={`مرحباً، ${session.organizationName}`}
        description="ملخص حي لفرص التوريد وعروضك وأوامر التوريد."
        actions={
          <Link className="btn gold" href="/supplier/opportunities">
            عرض فرص التوريد
          </Link>
        }
      />

      <div className="stat-grid">
        <StatCard
          value={newOpportunities.length}
          label="فرص توريد جديدة"
          href="/supplier/opportunities"
          tone={0}
        />
        <StatCard
          value={awaitingResult.value}
          label="عروض بانتظار النتيجة"
          href="/supplier/offers"
          tone={1}
        />
        <StatCard
          value={ordersNeedingAction.value}
          label="أوامر توريد بحاجة إجراء"
          href="/supplier/purchase-orders"
          tone={2}
        />
        <StatCard
          value={opportunities.length}
          label="إجمالي الفرص المتاحة"
          href="/supplier/opportunities"
          tone={3}
        />
      </div>

      <section className="dashboard-grid">
        <div className="panel">
          <div className="panel-title">
            <div>
              <span className="eyebrow">منافسة مفتوحة</span>
              <h3>فرص جديدة تحتاج عرضًا</h3>
            </div>
            <Link href="/supplier/opportunities">عرض الكل</Link>
          </div>
          {highlightedOpportunities.length === 0 ? (
            <EmptyState
              title="لا توجد فرص جديدة الآن"
              description="ستظهر هنا طلبات الشراء المطابقة لمدينتك وتصنيفاتك."
            />
          ) : (
            highlightedOpportunities.map((o) => (
              <Link
                key={o.id}
                href={`/supplier/opportunities/${o.id}`}
                className="recent-row"
                style={{ display: "grid" }}
              >
                <span className="product-letter" aria-hidden>
                  ف
                </span>
                <div>
                  <strong>{o.title}</strong>
                  <small className="ltr-iso">{o.code}</small>
                </div>
                <small>{o.deliveryCity}</small>
                <span />
                <small>{formatDateTime(o.submissionDeadline)}</small>
              </Link>
            ))
          )}
        </div>

        <aside className="panel tasks">
          <div className="panel-title">
            <div>
              <span className="eyebrow">الخط الزمني</span>
              <h3>النشاط الأخير</h3>
            </div>
          </div>
          {recentActivity.length === 0 ? (
            <p className="helper-text">لا يوجد نشاط بعد.</p>
          ) : (
            recentActivity.map((n) => (
              <div className="task" key={n.id}>
                <span className="dot" aria-hidden />
                <div>
                  <strong>{n.title}</strong>
                  <small>{n.body}</small>
                </div>
                {n.linkPath ? (
                  <Link className="task-link" href={n.linkPath}>
                    فتح
                  </Link>
                ) : null}
              </div>
            ))
          )}
        </aside>
      </section>
    </>
  );
}
