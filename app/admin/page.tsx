import Link from "next/link";
import { and, count, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import {
  competitions,
  complaints,
  deliveries,
  groupDeals,
  purchaseRequests,
} from "@/db/schema";
import { PageHeader, StatCard } from "@/components/ui";
import { requireRole } from "@/lib/rbac";
import { formatDate } from "@/lib/format";
import { COMPETITION_STATUS, PURCHASE_REQUEST_STATUS } from "@/lib/labels";

export default async function AdminDashboardPage() {
  await requireRole(["admin"]);
  const db = getDb();

  const [[pendingRequests], [readyDeals], [openComps], [lateDeliveries]] =
    await Promise.all([
      db
        .select({ value: count() })
        .from(purchaseRequests)
        .where(
          inArray(purchaseRequests.status, ["submitted", "under_review"]),
        ),
      db
        .select({ value: count() })
        .from(groupDeals)
        .where(eq(groupDeals.status, "ready")),
      db
        .select({ value: count() })
        .from(competitions)
        .where(inArray(competitions.status, ["open", "closed", "revealed"])),
      db
        .select({ value: count() })
        .from(deliveries)
        .where(
          and(
            inArray(deliveries.status, ["scheduled", "out_for_delivery"]),
          ),
        ),
    ]);

  const recentRequests = await db
    .select({
      id: purchaseRequests.id,
      code: purchaseRequests.code,
      title: purchaseRequests.title,
      status: purchaseRequests.status,
      createdAt: purchaseRequests.createdAt,
    })
    .from(purchaseRequests)
    .orderBy(desc(purchaseRequests.createdAt))
    .limit(6);

  const recentComps = await db
    .select()
    .from(competitions)
    .orderBy(desc(competitions.updatedAt))
    .limit(5);

  const [openComplaints] = await db
    .select({ value: count() })
    .from(complaints)
    .where(inArray(complaints.status, ["open", "in_review"]));

  return (
    <>
      <PageHeader
        eyebrow="غرفة التحكم"
        title="مركز العمليات"
        description="أهم الإجراءات التي تحتاج انتباه الإدارة — نظرة مباشرة على السوق."
        actions={
          <Link className="btn gold" href="/admin/competitions">
            المنافسات
          </Link>
        }
      />
      <div className="stat-grid">
        <StatCard
          value={pendingRequests.value}
          label="طلبات للمراجعة"
          href="/admin/purchase-requests"
          tone={0}
        />
        <StatCard
          value={readyDeals.value}
          label="صفقات جاهزة"
          href="/admin/group-deals"
          tone={1}
        />
        <StatCard
          value={openComps.value}
          label="منافسات نشطة"
          href="/admin/competitions"
          tone={2}
        />
        <StatCard
          value={openComplaints.value}
          label="بلاغات مفتوحة"
          href="/admin/complaints"
          tone={3}
        />
      </div>

      <section className="dashboard-grid">
        <div className="panel">
          <div className="panel-title">
            <h3>أحدث طلبات الشراء</h3>
            <Link href="/admin/purchase-requests">عرض الكل</Link>
          </div>
          {recentRequests.map((r) => (
            <div className="recent-row" key={r.id}>
              <span className="product-letter">ط</span>
              <div>
                <strong>{r.title}</strong>
                <small>{r.code}</small>
              </div>
              <span>{PURCHASE_REQUEST_STATUS[r.status]}</span>
              <b />
              <small>{formatDate(r.createdAt)}</small>
            </div>
          ))}
        </div>
        <aside className="panel tasks">
          <div className="panel-title">
            <h3>المنافسات</h3>
            <small style={{ color: "var(--muted)" }}>
              توريدات قيد المتابعة: {lateDeliveries.value}
            </small>
          </div>
          {recentComps.map((c) => (
            <div className="task" key={c.id}>
              <span className="dot" />
              <div>
                <strong>{c.title}</strong>
                <small>
                  {c.code} · {COMPETITION_STATUS[c.status]}
                </small>
              </div>
              <Link href={`/admin/competitions/${c.id}`}>←</Link>
            </div>
          ))}
        </aside>
      </section>
    </>
  );
}
