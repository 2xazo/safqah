import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { organizations, purchaseOrders } from "@/db/schema";
import { Badge, DataTable, EmptyState, PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/rbac";
import { formatDateTime, formatMoney } from "@/lib/format";
import { PURCHASE_ORDER_STATUS, statusTone } from "@/lib/labels";
import { alias } from "drizzle-orm/pg-core";

export default async function AdminPurchaseOrdersPage() {
  await requireRole(["admin"]);
  const db = getDb();
  const buyers = alias(organizations, "buyers");
  const suppliers = alias(organizations, "suppliers");

  const rows = await db
    .select({
      id: purchaseOrders.id,
      code: purchaseOrders.code,
      status: purchaseOrders.status,
      totalAmount: purchaseOrders.totalAmount,
      issuedAt: purchaseOrders.issuedAt,
      buyerName: buyers.name,
      supplierName: suppliers.name,
    })
    .from(purchaseOrders)
    .innerJoin(buyers, eq(buyers.id, purchaseOrders.buyerOrganizationId))
    .innerJoin(
      suppliers,
      eq(suppliers.id, purchaseOrders.supplierOrganizationId),
    )
    .orderBy(desc(purchaseOrders.createdAt));

  return (
    <>
      <PageHeader title="أوامر الشراء" description="جميع أوامر الشراء على المنصة." />
      {rows.length === 0 ? (
        <EmptyState title="لا توجد أوامر شراء" />
      ) : (
        <DataTable
          headers={["الرمز", "المشتري", "المورد", "الإجمالي", "الإصدار", "الحالة"]}
        >
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.code}</td>
              <td>{r.buyerName}</td>
              <td>{r.supplierName}</td>
              <td>{formatMoney(r.totalAmount)}</td>
              <td>{formatDateTime(r.issuedAt)}</td>
              <td>
                <Badge tone={statusTone(r.status)}>
                  {PURCHASE_ORDER_STATUS[r.status] ?? r.status}
                </Badge>
              </td>
            </tr>
          ))}
        </DataTable>
      )}
    </>
  );
}
