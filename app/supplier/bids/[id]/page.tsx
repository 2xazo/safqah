import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { bids, competitions } from "@/db/schema";
import { Badge, PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/rbac";
import { formatDateTime, formatDate, formatMoney } from "@/lib/format";
import { BID_STATUS, COMPETITION_STATUS, statusTone } from "@/lib/labels";

export default async function SupplierBidDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireRole(["supplier"]);
  const db = getDb();

  const [row] = await db
    .select({
      bid: bids,
      competitionCode: competitions.code,
      competitionTitle: competitions.title,
      competitionStatus: competitions.status,
      competitionId: competitions.id,
      deadline: competitions.submissionDeadline,
    })
    .from(bids)
    .innerJoin(competitions, eq(competitions.id, bids.competitionId))
    .where(
      and(
        eq(bids.id, id),
        eq(bids.supplierOrganizationId, session.organizationId),
      ),
    )
    .limit(1);

  if (!row) notFound();
  const { bid } = row;

  return (
    <>
      <PageHeader
        title={row.competitionTitle}
        description={row.competitionCode}
        actions={
          <Badge tone={statusTone(bid.status)}>
            {BID_STATUS[bid.status] ?? bid.status}
          </Badge>
        }
      />
      <section className="panel">
        <p style={{ fontSize: 12, color: "var(--muted)" }}>
          حالة المنافسة: {COMPETITION_STATUS[row.competitionStatus]} · الموعد:{" "}
          {formatDateTime(row.deadline)}
        </p>
        <div className="price-summary">
          <span>
            العلامة <b>{bid.brandName ?? "—"}</b>
          </span>
          <span>
            المنشأ <b>{bid.originCountry ?? "—"}</b>
          </span>
          <span>
            سعر الوحدة <b>{formatMoney(bid.unitPrice)}</b>
          </span>
          <span>
            الكمية المتاحة <b>{bid.availableQuantity ?? "—"}</b>
          </span>
          <span>
            التوصيل <b>{bid.deliveryDays ?? "—"} أيام</b>
          </span>
          <span>
            الصلاحية <b>{bid.shelfLifeMonths ?? "—"} شهر</b>
          </span>
          <span>
            رسوم التوصيل <b>{formatMoney(bid.deliveryFee)}</b>
          </span>
          <span>
            قُدّم في <b>{formatDateTime(bid.submittedAt)}</b>
          </span>
        </div>
        {bid.notes ? (
          <p style={{ fontSize: 13, marginTop: 12 }}>ملاحظات: {bid.notes}</p>
        ) : null}
        <div className="panel-actions" style={{ marginTop: 16 }}>
          {!bid.isLocked && bid.status !== "locked" ? (
            <Link
              className="btn primary"
              href={`/supplier/competitions/${row.competitionId}/bid`}
            >
              تحديث العرض
            </Link>
          ) : null}
          <Link className="btn outline" href="/supplier/bids">
            العودة لعروضي
          </Link>
        </div>
      </section>
    </>
  );
}
