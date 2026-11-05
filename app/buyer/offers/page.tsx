import Link from "next/link";
import { count, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { offers, purchaseRequests } from "@/db/schema";
import { DataTable, EmptyState, PageHeader, StatusPill } from "@/components/ui";
import { requireRole } from "@/lib/rbac";
import { formatDateTime } from "@/lib/format";
import { isDeadlinePassed } from "@/lib/workflow";

export default async function BuyerOffersPage() {
  const session = await requireRole(["buyer"]);
  const db = getDb();

  const rows = await db
    .select({
      id: purchaseRequests.id,
      code: purchaseRequests.code,
      title: purchaseRequests.title,
      status: purchaseRequests.status,
      submissionDeadline: purchaseRequests.submissionDeadline,
      selectedOfferId: purchaseRequests.selectedOfferId,
      offerCount: count(offers.id),
    })
    .from(purchaseRequests)
    .innerJoin(offers, eq(offers.purchaseRequestId, purchaseRequests.id))
    .where(eq(purchaseRequests.organizationId, session.organizationId))
    .groupBy(purchaseRequests.id)
    .orderBy(desc(purchaseRequests.createdAt));

  return (
    <>
      <PageHeader
        title="مقارنة العروض"
        description="طلبات الشراء التي وصلها عرض واحد أو أكثر من الموردين."
      />
      {rows.length === 0 ? (
        <EmptyState
          title="لا توجد عروض بعد"
          description="بمجرد أن يقدّم أحد الموردين عرضًا على أحد طلباتك سيظهر هنا للمقارنة بعد انتهاء الموعد."
        />
      ) : (
        <DataTable
          headers={["الطلب", "عدد العروض", "آخر موعد", "الحالة", "القرار", "الإجراء"]}
        >
          {rows.map((r) => {
            const deadlinePassed = isDeadlinePassed(r.submissionDeadline);
            const decision = r.selectedOfferId
              ? "تم اختيار المورد"
              : deadlinePassed
                ? "بانتظار قرارك"
                : "تُفتح المقارنة بعد انتهاء الموعد";
            return (
              <tr key={r.id}>
                <td>
                  <strong>{r.title}</strong>
                  <br />
                  <small className="ltr-iso" style={{ color: "var(--muted)" }}>
                    {r.code}
                  </small>
                </td>
                <td>{r.offerCount}</td>
                <td>{formatDateTime(r.submissionDeadline)}</td>
                <td>
                  <StatusPill kind="purchaseRequest" value={r.status} />
                </td>
                <td>{decision}</td>
                <td>
                  <Link href={`/buyer/requests/${r.id}/offers`}>مقارنة العروض</Link>
                </td>
              </tr>
            );
          })}
        </DataTable>
      )}
    </>
  );
}
