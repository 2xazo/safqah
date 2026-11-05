import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { organizations, purchaseOrders } from "@/db/schema";
import { DataTable, EmptyState, PageHeader, StatusPill } from "@/components/ui";
import { requireRole } from "@/lib/rbac";
import { formatDate, formatMoney } from "@/lib/format";

export default async function SupplierPurchaseOrdersPage() {
  const session = await requireRole(["supplier"]);
  const db = getDb();

  const rows = await db
    .select({
      id: purchaseOrders.id,
      code: purchaseOrders.code,
      fulfillmentStatus: purchaseOrders.fulfillmentStatus,
      totalAmount: purchaseOrders.totalAmount,
      expectedDeliveryDate: purchaseOrders.expectedDeliveryDate,
      buyerName: organizations.name,
    })
    .from(purchaseOrders)
    .innerJoin(organizations, eq(organizations.id, purchaseOrders.buyerOrganizationId))
    .where(eq(purchaseOrders.supplierOrganizationId, session.organizationId))
    .orderBy(desc(purchaseOrders.createdAt));

  return (
    <>
      <PageHeader title="أوامر التوريد" description="أوامر الشراء الصادرة لمنشأتك من المشترين." />
      {rows.length === 0 ? (
        <EmptyState
          title="لا توجد أوامر توريد"
          description="ستظهر هنا أوامر الشراء بمجرد اختيار عرضك من أحد المشترين."
        />
      ) : (
        <DataTable
          headers={[
            "رقم الأمر",
            "المشتري",
            "الإجمالي",
            "التسليم المتوقع",
            "حالة التوريد",
            "الإجراء",
          ]}
        >
          {rows.map((r) => (
            <tr key={r.id}>
              <td>
                <span className="ltr-iso">{r.code}</span>
              </td>
              <td>{r.buyerName}</td>
              <td>{formatMoney(r.totalAmount)}</td>
              <td>{formatDate(r.expectedDeliveryDate)}</td>
              <td>
                <StatusPill kind="fulfillment" value={r.fulfillmentStatus} />
              </td>
              <td>
                <Link href={`/supplier/purchase-orders/${r.id}`}>إدارة أمر التوريد</Link>
              </td>
            </tr>
          ))}
        </DataTable>
      )}
    </>
  );
}
