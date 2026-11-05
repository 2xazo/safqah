import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { groupDeals, products } from "@/db/schema";
import { Badge, DataTable, EmptyState, PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/rbac";
import { formatNumber } from "@/lib/format";
import { GROUP_DEAL_STATUS, statusTone } from "@/lib/labels";

export default async function AdminGroupDealsPage() {
  await requireRole(["admin"]);
  const db = getDb();

  const rows = await db
    .select({
      id: groupDeals.id,
      code: groupDeals.code,
      title: groupDeals.title,
      status: groupDeals.status,
      totalQuantity: groupDeals.totalQuantity,
      targetQuantity: groupDeals.targetQuantity,
      productName: products.name,
    })
    .from(groupDeals)
    .innerJoin(products, eq(products.id, groupDeals.productId))
    .orderBy(desc(groupDeals.createdAt));

  return (
    <>
      <PageHeader title="الصفقات الجماعية" description="تجميعات الطلبات على مستوى المنصة." />
      {rows.length === 0 ? (
        <EmptyState title="لا توجد صفقات جماعية" />
      ) : (
        <DataTable
          headers={["الرمز", "العنوان", "المنتج", "الكمية", "الهدف", "الحالة"]}
        >
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.code}</td>
              <td>
                <strong>{r.title}</strong>
              </td>
              <td>{r.productName}</td>
              <td>{formatNumber(r.totalQuantity)}</td>
              <td>{formatNumber(r.targetQuantity)}</td>
              <td>
                <Badge tone={statusTone(r.status)}>
                  {GROUP_DEAL_STATUS[r.status] ?? r.status}
                </Badge>
              </td>
            </tr>
          ))}
        </DataTable>
      )}
      <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 12 }}>
        إدارة المنافسات من{" "}
        <Link href="/admin/competitions">هنا</Link>.
      </p>
    </>
  );
}
