import Link from "next/link";
import { and, count, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { notifications, purchaseOrders } from "@/db/schema";
import { EmptyState, PageHeader, StatCard, StatusPill } from "@/components/ui";
import { listBuyerPublishedRequestSummaries } from "@/lib/buyer-queries";
import { requireRole } from "@/lib/rbac";
import { formatDateTime } from "@/lib/format";

export default async function BuyerDashboardPage() {
  const session = await requireRole(["buyer"]);
  const db = getDb();
  const orgId = session.organizationId;
  const now = new Date();

  const [
    requestSummaryRows,
    [activePOs],
    recentActivity,
  ] = await Promise.all([
    listBuyerPublishedRequestSummaries(orgId),
    db
      .select({ value: count() })
      .from(purchaseOrders)
      .where(
        and(
          eq(purchaseOrders.buyerOrganizationId, orgId),
          inArray(purchaseOrders.status, ["issued", "confirmed", "in_fulfillment"]),
        ),
      ),
    db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, session.id))
      .orderBy(desc(notifications.createdAt))
      .limit(6),
  ]);

  const publishedCount = { value: requestSummaryRows.length };
  const newOffersCount = {
    value: requestSummaryRows.reduce(
      (total, request) => total + request.activeOfferCount,
      0,
    ),
  };
  const needsActionRows = requestSummaryRows
    .filter(
      (request) =>
        request.offerCount > 0 &&
        (request.submissionDeadline?.getTime() ?? Number.NaN) < now.getTime(),
    )
    .sort(
      (a, b) =>
        (b.submissionDeadline?.getTime() ?? 0) -
        (a.submissionDeadline?.getTime() ?? 0),
    );
  const openRequestsRows = requestSummaryRows.filter(
    (request) =>
      (request.submissionDeadline?.getTime() ?? Number.NaN) >= now.getTime(),
  );

  return (
    <>
      <PageHeader
        eyebrow="مركز المشتريات"
        title={`مرحباً، ${session.organizationName}`}
        description="ملخص حي لطلبات الشراء والعروض وأوامر الشراء الخاصة بمنشأتك."
        actions={
          <Link className="btn gold" href="/buyer/requests/new">
            إنشاء طلب شراء
          </Link>
        }
      />

      <div className="stat-grid">
        <StatCard
          value={needsActionRows.length}
          label="طلبات تحتاج قرارك"
          href="/buyer/offers"
          tone={0}
        />
        <StatCard value={newOffersCount.value} label="عروض جديدة" href="/buyer/offers" tone={1} />
        <StatCard
          value={activePOs.value}
          label="أوامر شراء نشطة"
          href="/buyer/purchase-orders"
          tone={2}
        />
        <StatCard value={publishedCount.value} label="طلبات منشورة" href="/buyer/requests" tone={3} />
      </div>

      <section className="dashboard-grid">
        <div className="panel">
          <div className="panel-title">
            <div>
              <span className="eyebrow">منافسة مباشرة</span>
              <h3>طلبات تحتاج قرارك</h3>
            </div>
            <Link href="/buyer/offers">عرض الكل</Link>
          </div>
          {needsActionRows.length === 0 ? (
            <EmptyState
              title="لا توجد طلبات تحتاج إجراء الآن"
              description="عند انتهاء الموعد النهائي لأي طلب فيه عروض، سيظهر هنا لاختيار المورد المناسب."
            />
          ) : (
            needsActionRows.map((r) => (
              <Link
                key={r.id}
                href={`/buyer/requests/${r.id}/offers`}
                className="recent-row"
                style={{ display: "grid" }}
              >
                <span className="product-letter" aria-hidden>
                  ط
                </span>
                <div>
                  <strong>{r.title}</strong>
                  <small className="ltr-iso">{r.code}</small>
                </div>
                <StatusPill kind="purchaseRequest" value={r.status} />
                <small>{r.offerCount} عرض</small>
                <small>{formatDateTime(r.submissionDeadline)}</small>
              </Link>
            ))
          )}

          {openRequestsRows.length > 0 ? (
            <>
              <div className="panel-title" style={{ marginTop: 22 }}>
                <h3>طلبات تستقبل عروضًا</h3>
                <Link href="/buyer/requests">عرض الكل</Link>
              </div>
              {openRequestsRows.map((r) => (
                <Link
                  key={r.id}
                  href={`/buyer/requests/${r.id}`}
                  className="recent-row"
                  style={{ display: "grid" }}
                >
                  <span className="product-letter" aria-hidden>
                    ط
                  </span>
                  <div>
                    <strong>{r.title}</strong>
                    <small className="ltr-iso">{r.code}</small>
                  </div>
                  <span />
                  <span />
                  <small>حتى {formatDateTime(r.submissionDeadline)}</small>
                </Link>
              ))}
            </>
          ) : null}
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
