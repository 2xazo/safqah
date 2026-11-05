import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { offers, purchaseRequests } from "@/db/schema";
import { DataTable, EmptyState, PageHeader, StatusPill } from "@/components/ui";
import { requireRole } from "@/lib/rbac";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";

export default async function SupplierOffersPage() {
  const session = await requireRole(["supplier"]);
  const db = getDb();

  const rows = await db
    .select({
      id: offers.id,
      code: offers.code,
      status: offers.status,
      totalAmount: offers.totalAmount,
      proposedDeliveryDate: offers.proposedDeliveryDate,
      updatedAt: offers.updatedAt,
      requestId: purchaseRequests.id,
      requestTitle: purchaseRequests.title,
      requestCode: purchaseRequests.code,
    })
    .from(offers)
    .innerJoin(purchaseRequests, eq(purchaseRequests.id, offers.purchaseRequestId))
    .where(eq(offers.supplierOrganizationId, session.organizationId))
    .orderBy(desc(offers.updatedAt));

  return (
    <>
      <PageHeader title="عروضي" description="جميع العروض التي قدّمتها منشأتك على طلبات الشراء." />
      {rows.length === 0 ? (
        <EmptyState
          title="لا توجد عروض بعد"
          description="ابحث عن فرص التوريد المناسبة وقدّم أول عرض."
          actionHref="/supplier/opportunities"
          actionLabel="عرض فرص التوريد"
        />
      ) : (
        <DataTable
          headers={[
            "الطلب",
            "إجمالي العرض",
            "تاريخ التسليم المقترح",
            "آخر تحديث",
            "الحالة",
            "الإجراء",
          ]}
        >
          {rows.map((r) => (
            <tr key={r.id}>
              <td>
                <strong>{r.requestTitle}</strong>
                <br />
                <small className="ltr-iso" style={{ color: "var(--muted)" }}>
                  {r.requestCode}
                </small>
              </td>
              <td>{formatMoney(r.totalAmount)}</td>
              <td>{formatDate(r.proposedDeliveryDate)}</td>
              <td>{formatDateTime(r.updatedAt)}</td>
              <td>
                <StatusPill kind="offer" value={r.status} />
              </td>
              <td>
                <Link href={`/supplier/offers/${r.id}`}>عرض تفاصيل العرض</Link>
              </td>
            </tr>
          ))}
        </DataTable>
      )}
    </>
  );
}
