import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  competitions,
  groupDealMembers,
  groupDeals,
  products,
} from "@/db/schema";
import { Badge, PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/rbac";
import { formatDateTime, formatDate, formatNumber } from "@/lib/format";
import {
  COMPETITION_STATUS,
  GROUP_DEAL_STATUS,
  statusTone,
} from "@/lib/labels";

export default async function BuyerGroupDealDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireRole(["buyer"]);
  const db = getDb();

  const [membership] = await db
    .select({
      dealId: groupDeals.id,
      code: groupDeals.code,
      title: groupDeals.title,
      status: groupDeals.status,
      totalQuantity: groupDeals.totalQuantity,
      targetQuantity: groupDeals.targetQuantity,
      allocatedQuantity: groupDealMembers.allocatedQuantity,
      productName: products.name,
      createdAt: groupDeals.createdAt,
    })
    .from(groupDealMembers)
    .innerJoin(groupDeals, eq(groupDeals.id, groupDealMembers.groupDealId))
    .innerJoin(products, eq(products.id, groupDeals.productId))
    .where(
      and(
        eq(groupDeals.id, id),
        eq(groupDealMembers.organizationId, session.organizationId),
      ),
    )
    .limit(1);

  if (!membership) notFound();

  const [competition] = await db
    .select()
    .from(competitions)
    .where(eq(competitions.groupDealId, membership.dealId))
    .limit(1);

  return (
    <>
      <PageHeader
        title={membership.title}
        description={membership.code}
        actions={
          <Badge tone={statusTone(membership.status)}>
            {GROUP_DEAL_STATUS[membership.status] ?? membership.status}
          </Badge>
        }
      />
      <section className="panel">
        <div className="deal-numbers">
          <span>
            <small>المنتج</small>
            <b>{membership.productName}</b>
          </span>
          <span>
            <small>حصتك</small>
            <b>{formatNumber(membership.allocatedQuantity)}</b>
          </span>
          <span>
            <small>الكمية المجمعة</small>
            <b>{formatNumber(membership.totalQuantity)}</b>
          </span>
          <span>
            <small>الهدف</small>
            <b>{formatNumber(membership.targetQuantity)}</b>
          </span>
        </div>
        <p style={{ fontSize: 12, color: "var(--muted)" }}>
          تاريخ الإنشاء: {formatDateTime(membership.createdAt)}
        </p>
        {competition ? (
          <div className="sealed-banner">
            <span>◆</span>
            <div>
              <strong>
                المنافسة {competition.code} —{" "}
                {COMPETITION_STATUS[competition.status]}
              </strong>
              <p>
                موعد إغلاق التقديم: {formatDateTime(competition.submissionDeadline)} ·
                فتح العروض: {formatDateTime(competition.revealAt)}
              </p>
              <p style={{ marginTop: 6 }}>
                تفاصيل العروض التجارية تبقى سرية حتى موعد الفتح.
              </p>
            </div>
          </div>
        ) : (
          <p style={{ fontSize: 13, color: "var(--muted)" }}>
            لم تُطرح منافسة لهذه الصفقة بعد.
          </p>
        )}
        <Link className="btn outline" href="/buyer/group-deals">
          العودة للصفقات
        </Link>
      </section>
    </>
  );
}
