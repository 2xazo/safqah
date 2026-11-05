import Link from "next/link";
import { notFound } from "next/navigation";
import { count, eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  awardDecisions,
  bids,
  competitionInvitations,
  competitions,
  groupDeals,
  products,
} from "@/db/schema";
import { Badge, PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/rbac";
import { formatDateTime, formatDate, formatNumber } from "@/lib/format";
import {
  AWARD_STATUS,
  COMPETITION_STATUS,
  statusTone,
} from "@/lib/labels";
import { isCompetitionRevealed } from "@/lib/bids";

export default async function AdminCompetitionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireRole(["admin"]);
  const db = getDb();

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

  const revealed = isCompetitionRevealed(competition);
  const [[inviteCount], [bidCount]] = await Promise.all([
    db
      .select({ value: count() })
      .from(competitionInvitations)
      .where(eq(competitionInvitations.competitionId, id)),
    db.select({ value: count() }).from(bids).where(eq(bids.competitionId, id)),
  ]);

  const [award] = await db
    .select()
    .from(awardDecisions)
    .where(eq(awardDecisions.competitionId, id))
    .limit(1);

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
            <small>الدعوات</small>
            <b>{inviteCount.value}</b>
          </span>
          <span>
            <small>العروض</small>
            <b>{bidCount.value}</b>
          </span>
        </div>
        <p style={{ fontSize: 12, color: "var(--muted)" }}>
          إغلاق التقديم: {formatDateTime(competition.submissionDeadline)} · فتح
          العروض: {formatDateTime(competition.revealAt)} · السرية حتى:{" "}
          {formatDateTime(competition.sealedUntil)}
        </p>
        <div className="sealed-banner">
          <span>◆</span>
          <div>
            <strong>
              {revealed
                ? "العروض مفتوحة للإدارة"
                : "العروض ما زالت سرية — التفاصيل التجارية مخفية حتى موعد الفتح"}
            </strong>
            <p>
              المشترون والموردون لا يرون أسعار المنافسين قبل الفتح. الإدارة ترى
              التفاصيل بعد انتهاء فترة السرية.
            </p>
          </div>
        </div>
        {award ? (
          <p style={{ fontSize: 13 }}>
            قرار الترسية: {AWARD_STATUS[award.status]} ·{" "}
            {formatDateTime(award.decidedAt)}
          </p>
        ) : null}
        <div className="panel-actions">
          <Link
            className="btn primary"
            href={`/admin/competitions/${competition.id}/bids`}
          >
            {revealed ? "مقارنة العروض" : "عرض حالة العروض"}
          </Link>
          {revealed && competition.status !== "awarded" ? (
            <Link
              className="btn outline"
              href={`/admin/competitions/${competition.id}/award`}
            >
              شاشة الترسية
            </Link>
          ) : null}
          <Link className="btn outline" href="/admin/competitions">
            العودة
          </Link>
        </div>
      </section>
    </>
  );
}
