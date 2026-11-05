import Link from "next/link";
import { notFound } from "next/navigation";
import { and, count, eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  bids,
  competitionInvitations,
  competitions,
  groupDeals,
  products,
} from "@/db/schema";
import { Badge, PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/rbac";
import { formatDateTime, formatDate, formatNumber } from "@/lib/format";
import { COMPETITION_STATUS, statusTone } from "@/lib/labels";
import { isCompetitionRevealed } from "@/lib/bids";

export default async function SupplierCompetitionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireRole(["supplier"]);
  const db = getDb();

  const [invitation] = await db
    .select()
    .from(competitionInvitations)
    .where(
      and(
        eq(competitionInvitations.competitionId, id),
        eq(
          competitionInvitations.supplierOrganizationId,
          session.organizationId,
        ),
      ),
    )
    .limit(1);

  if (!invitation) notFound();

  const [competition] = await db
    .select({
      id: competitions.id,
      code: competitions.code,
      title: competitions.title,
      status: competitions.status,
      submissionDeadline: competitions.submissionDeadline,
      revealAt: competitions.revealAt,
      sealedUntil: competitions.sealedUntil,
      totalQuantity: groupDeals.totalQuantity,
      productName: products.name,
    })
    .from(competitions)
    .innerJoin(groupDeals, eq(groupDeals.id, competitions.groupDealId))
    .innerJoin(products, eq(products.id, groupDeals.productId))
    .where(eq(competitions.id, id))
    .limit(1);

  if (!competition) notFound();

  const [ownBid] = await db
    .select({ id: bids.id, status: bids.status })
    .from(bids)
    .where(
      and(
        eq(bids.competitionId, id),
        eq(bids.supplierOrganizationId, session.organizationId),
      ),
    )
    .limit(1);

  const revealed = isCompetitionRevealed(competition);
  const [bidCount] = await db
    .select({ value: count() })
    .from(bids)
    .where(eq(bids.competitionId, id));

  return (
    <>
      <PageHeader
        title={competition.title}
        description={competition.code}
        actions={
          <Badge tone={statusTone(competition.status)}>
            {COMPETITION_STATUS[competition.status] ?? competition.status}
          </Badge>
        }
      />
      <section className="panel">
        <div className="deal-numbers">
          <span>
            <small>المنتج</small>
            <b>{competition.productName}</b>
          </span>
          <span>
            <small>الكمية</small>
            <b>{formatNumber(competition.totalQuantity)}</b>
          </span>
          <span>
            <small>إغلاق التقديم</small>
            <b>{formatDateTime(competition.submissionDeadline)}</b>
          </span>
          <span>
            <small>فتح العروض</small>
            <b>{formatDateTime(competition.revealAt)}</b>
          </span>
        </div>
        <div className="sealed-banner">
          <span>◆</span>
          <div>
            <strong>
              {revealed
                ? "تم فتح العروض"
                : "فترة السرية سارية — لا تُعرض الأسعار التجارية للمنافسين"}
            </strong>
            <p>
              عدد العروض المستلمة: {revealed ? bidCount.value : "مخفي حتى الفتح"}
            </p>
          </div>
        </div>
        <div className="panel-actions">
          <Link
            className="btn primary"
            href={`/supplier/competitions/${competition.id}/bid`}
          >
            {ownBid ? "تحديث عرضي" : "تقديم عرض"}
          </Link>
          {ownBid ? (
            <Link className="btn outline" href={`/supplier/bids/${ownBid.id}`}>
              عرض عرضي
            </Link>
          ) : null}
        </div>
      </section>
    </>
  );
}
