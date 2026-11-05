import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  competitionInvitations,
  competitions,
  groupDeals,
  products,
} from "@/db/schema";
import { Badge, PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/rbac";
import { formatDateTime, formatDate, formatNumber } from "@/lib/format";
import {
  COMPETITION_STATUS,
  INVITATION_STATUS,
  statusTone,
} from "@/lib/labels";

export default async function SupplierInvitationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireRole(["supplier"]);
  const db = getDb();

  const [row] = await db
    .select({
      invitationId: competitionInvitations.id,
      invitationStatus: competitionInvitations.status,
      invitedAt: competitionInvitations.invitedAt,
      competitionId: competitions.id,
      competitionCode: competitions.code,
      competitionTitle: competitions.title,
      competitionStatus: competitions.status,
      deadline: competitions.submissionDeadline,
      revealAt: competitions.revealAt,
      dealTitle: groupDeals.title,
      totalQuantity: groupDeals.totalQuantity,
      productName: products.name,
    })
    .from(competitionInvitations)
    .innerJoin(
      competitions,
      eq(competitions.id, competitionInvitations.competitionId),
    )
    .innerJoin(groupDeals, eq(groupDeals.id, competitions.groupDealId))
    .innerJoin(products, eq(products.id, groupDeals.productId))
    .where(
      and(
        eq(competitionInvitations.id, id),
        eq(
          competitionInvitations.supplierOrganizationId,
          session.organizationId,
        ),
      ),
    )
    .limit(1);

  if (!row) notFound();

  return (
    <>
      <PageHeader
        title={row.competitionTitle}
        description={`${row.competitionCode} · ${row.dealTitle}`}
        actions={
          <Badge tone={statusTone(row.invitationStatus)}>
            {INVITATION_STATUS[row.invitationStatus] ?? row.invitationStatus}
          </Badge>
        }
      />
      <section className="panel">
        <div className="sealed-banner">
          <span>◆</span>
          <div>
            <strong>عرضك سري ومحمي</strong>
            <p>
              لن يتمكن أي مورد أو مشتري من الاطلاع على بياناتك التجارية قبل{" "}
              {formatDateTime(row.revealAt)}.
            </p>
          </div>
        </div>
        <div className="deal-numbers">
          <span>
            <small>المنتج</small>
            <b>{row.productName}</b>
          </span>
          <span>
            <small>الكمية المطلوبة</small>
            <b>{formatNumber(row.totalQuantity)}</b>
          </span>
          <span>
            <small>حالة المنافسة</small>
            <b>{COMPETITION_STATUS[row.competitionStatus]}</b>
          </span>
          <span>
            <small>إغلاق التقديم</small>
            <b>{formatDateTime(row.deadline)}</b>
          </span>
        </div>
        <div className="panel-actions" style={{ marginTop: 16 }}>
          <Link
            className="btn primary"
            href={`/supplier/competitions/${row.competitionId}/bid`}
          >
            تقديم / تحديث العرض
          </Link>
          <Link
            className="btn outline"
            href={`/supplier/competitions/${row.competitionId}`}
          >
            تفاصيل المنافسة
          </Link>
        </div>
      </section>
    </>
  );
}
