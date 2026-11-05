import Link from "next/link";
import { Badge, DataTable, EmptyState, PageHeader } from "@/components/ui";
import { listBuyerPurchaseRequests } from "@/lib/buyer-queries";
import { requireRole } from "@/lib/rbac";
import { formatDateTime } from "@/lib/format";
import { buyerRequestDisplayStatus } from "@/lib/status-labels";

export default async function BuyerRequestsPage() {
  const session = await requireRole(["buyer"]);
  const rows = await listBuyerPurchaseRequests(session.organizationId);
  const newestId = rows[0]?.id;

  return (
    <>
      <PageHeader
        title="طلباتي"
        description="جميع طلبات الشراء التابعة لمنشأتك، الأحدث أولًا."
        actions={
          <Link className="btn primary" href="/buyer/requests/new">
            طلب جديد
          </Link>
        }
      />
      {rows.length === 0 ? (
        <EmptyState
          title="لا توجد طلبات بعد"
          description="أنشئ أول طلب شراء لمنشأتك ليصل للموردين المناسبين."
          actionHref="/buyer/requests/new"
          actionLabel="إنشاء طلب شراء"
        />
      ) : (
        <DataTable
          headers={[
            "رقم الطلب",
            "العنوان",
            "عدد البنود",
            "آخر موعد للعروض",
            "الحالة",
            "الإجراء",
          ]}
        >
          {rows.map((r) => {
            const status = buyerRequestDisplayStatus(r.status, r.submissionDeadline);
            return (
              <tr
                key={r.id}
                className={r.id === newestId ? "recommended-row" : undefined}
              >
                <td>
                  <span className="ltr-iso">{r.code}</span>
                  {r.id === newestId ? (
                    <>
                      {" "}
                      <Badge tone="blue">الأحدث</Badge>
                    </>
                  ) : null}
                </td>
                <td>
                  <strong>{r.title}</strong>
                  {r.deliveryCity ? (
                    <>
                      <br />
                      <small style={{ color: "var(--muted)" }}>{r.deliveryCity}</small>
                    </>
                  ) : null}
                </td>
                <td>{r.itemCount}</td>
                <td>{formatDateTime(r.submissionDeadline)}</td>
                <td>
                  <Badge tone={status.tone}>{status.label}</Badge>
                </td>
                <td>
                  <Link href={`/buyer/requests/${r.id}`}>عرض التفاصيل</Link>
                </td>
              </tr>
            );
          })}
        </DataTable>
      )}
    </>
  );
}
