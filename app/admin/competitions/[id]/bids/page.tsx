import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  bidScores,
  bids,
  competitions,
  organizations,
} from "@/db/schema";
import { Badge, DataTable, EmptyState, PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/rbac";
import { formatMoney } from "@/lib/format";
import { BID_STATUS, statusTone } from "@/lib/labels";
import { canViewBidCommercials, isCompetitionRevealed } from "@/lib/bids";

export default async function AdminCompetitionBidsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireRole(["admin"]);
  const db = getDb();

  const [competition] = await db
    .select()
    .from(competitions)
    .where(eq(competitions.id, id))
    .limit(1);

  if (!competition) notFound();

  const revealed = isCompetitionRevealed(competition);
  const canSeeCommercials = canViewBidCommercials({
    viewerRole: "admin",
    competition,
  });

  const rows = await db
    .select({
      id: bids.id,
      status: bids.status,
      unitPrice: bids.unitPrice,
      deliveryDays: bids.deliveryDays,
      shelfLifeMonths: bids.shelfLifeMonths,
      availableQuantity: bids.availableQuantity,
      brandName: bids.brandName,
      supplierName: organizations.name,
      totalScore: bidScores.totalScore,
      isRecommended: bidScores.isRecommended,
      isCheapest: bidScores.isCheapest,
    })
    .from(bids)
    .innerJoin(
      organizations,
      eq(organizations.id, bids.supplierOrganizationId),
    )
    .leftJoin(bidScores, eq(bidScores.bidId, bids.id))
    .where(eq(bids.competitionId, id));

  return (
    <>
      <PageHeader
        title={`عروض المنافسة — ${competition.code}`}
        description={
          canSeeCommercials
            ? "التفاصيل التجارية ظاهرة بعد انتهاء السرية."
            : "فترة السرية سارية: تُعرض حالة العروض فقط دون الأسعار."
        }
        actions={
          <Badge tone={revealed ? "green" : "gold"}>
            {revealed ? "مفتوحة" : "سرية"}
          </Badge>
        }
      />

      {rows.length === 0 ? (
        <EmptyState title="لا توجد عروض بعد" />
      ) : (
        <DataTable
          headers={
            canSeeCommercials
              ? [
                  "المورد",
                  "السعر",
                  "التوصيل",
                  "الصلاحية",
                  "الكمية",
                  "النتيجة",
                  "الحالة",
                ]
              : ["المورد", "حالة العرض", "ملاحظات السرية"]
          }
        >
          {rows.map((r) =>
            canSeeCommercials ? (
              <tr
                key={r.id}
                className={r.isRecommended ? "recommended-row" : undefined}
              >
                <td>
                  <strong>{r.supplierName}</strong>
                  {r.isRecommended ? (
                    <Badge tone="gold">موصى به</Badge>
                  ) : null}
                  {r.isCheapest ? (
                    <small className="sub">الأقل سعرًا</small>
                  ) : null}
                  <div style={{ fontSize: 10, color: "var(--muted)" }}>
                    {r.brandName}
                  </div>
                </td>
                <td>{formatMoney(r.unitPrice)}</td>
                <td>{r.deliveryDays ?? "—"}</td>
                <td>{r.shelfLifeMonths ?? "—"}</td>
                <td>{r.availableQuantity ?? "—"}</td>
                <td>
                  {r.totalScore ? (
                    <span className="score">{r.totalScore}%</span>
                  ) : (
                    "—"
                  )}
                </td>
                <td>
                  <Badge tone={statusTone(r.status)}>
                    {BID_STATUS[r.status] ?? r.status}
                  </Badge>
                </td>
              </tr>
            ) : (
              <tr key={r.id}>
                <td>{r.supplierName}</td>
                <td>
                  <Badge tone={statusTone(r.status)}>
                    {BID_STATUS[r.status] ?? r.status}
                  </Badge>
                </td>
                <td>البيانات التجارية مخفية حتى موعد الفتح</td>
              </tr>
            ),
          )}
        </DataTable>
      )}

      <div className="panel-actions" style={{ marginTop: 16 }}>
        {canSeeCommercials ? (
          <Link
            className="btn primary"
            href={`/admin/competitions/${competition.id}/award`}
          >
            الانتقال للترسية
          </Link>
        ) : null}
        <Link className="btn outline" href={`/admin/competitions/${competition.id}`}>
          تفاصيل المنافسة
        </Link>
      </div>
    </>
  );
}
