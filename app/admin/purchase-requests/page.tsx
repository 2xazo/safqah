import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { organizations, purchaseRequests } from "@/db/schema";
import { Badge, DataTable, EmptyState, PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/rbac";
import { formatDate } from "@/lib/format";
import { PURCHASE_REQUEST_STATUS, statusTone } from "@/lib/labels";

export default async function AdminPurchaseRequestsPage() {
  await requireRole(["admin"]);
  const db = getDb();

  const rows = await db
    .select({
      id: purchaseRequests.id,
      code: purchaseRequests.code,
      title: purchaseRequests.title,
      status: purchaseRequests.status,
      createdAt: purchaseRequests.createdAt,
      orgName: organizations.name,
    })
    .from(purchaseRequests)
    .innerJoin(
      organizations,
      eq(organizations.id, purchaseRequests.organizationId),
    )
    .orderBy(desc(purchaseRequests.createdAt));

  return (
    <>
      <PageHeader
        title="طلبات الشراء"
        description="جميع طلبات المشترين في المنصة."
      />
      {rows.length === 0 ? (
        <EmptyState title="لا توجد طلبات" />
      ) : (
        <DataTable headers={["الرمز", "المنشأة", "العنوان", "الحالة", "التاريخ"]}>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.code}</td>
              <td>{r.orgName}</td>
              <td>
                <strong>{r.title}</strong>
              </td>
              <td>
                <Badge tone={statusTone(r.status)}>
                  {PURCHASE_REQUEST_STATUS[r.status] ?? r.status}
                </Badge>
              </td>
              <td>{formatDate(r.createdAt)}</td>
            </tr>
          ))}
        </DataTable>
      )}
      <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 12 }}>
        للمنافسات والترسية راجع{" "}
        <Link href="/admin/competitions">صفحة المنافسات</Link>.
      </p>
    </>
  );
}
