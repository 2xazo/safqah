import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { organizations, purchaseOrders } from "@/db/schema";
import { DataTable, EmptyState, PageHeader, StatusPill } from "@/components/ui";
import { requireRole } from "@/lib/rbac";
import { formatDate, formatMoney } from "@/lib/format";

export default async function BuyerPurchaseOrdersPage() {
  const session = await requireRole(["buyer"]);
  const db = getDb();

  const rows = await db
    .select({
      id: purchaseOrders.id,
      code: purchaseOrders.code,
      fulfillmentStatus: purchaseOrders.fulfillmentStatus,
      receiptStatus: purchaseOrders.receiptStatus,
      totalAmount: purchaseOrders.totalAmount,
      expectedDeliveryDate: purchaseOrders.expectedDeliveryDate,
      supplierName: organizations.name,
    })
    .from(purchaseOrders)
    .innerJoin(organizations, eq(organizations.id, purchaseOrders.supplierOrganizationId))
    .where(eq(purchaseOrders.buyerOrganizationId, session.organizationId))
    .orderBy(desc(purchaseOrders.createdAt));

  return (
    <>
      <PageHeader
        title="أوامر الشراء"
        description="أوامر الشراء الصادرة بعد اختيار المورد المناسب."
      />
      {rows.length === 0 ? (
        <EmptyState
          title="لا توجد أوامر شراء"
          description="تُنشأ أوامر الشراء تلقائيًا فور اختيارك لعرض أحد الموردين."
        />
      ) : (
        <DataTable
          headers={[
            "رقم أمر الشراء",
            "المورد",
            "الإجمالي",
            "التسليم المتوقع",
            "حالة التوريد",
            "حالة الاستلام",
            "الإجراء",
          ]}
        >
          {rows.map((r) => (
            <tr key={r.id}>
              <td>
                <span className="ltr-iso">{r.code}</span>
              </td>
              <td>{r.supplierName}</td>
              <td>{formatMoney(r.totalAmount)}</td>
              <td>{formatDate(r.expectedDeliveryDate)}</td>
              <td>
                <StatusPill kind="fulfillment" value={r.fulfillmentStatus} />
              </td>
              <td>
                <StatusPill kind="receipt" value={r.receiptStatus} />
              </td>
              <td>
                <Link href={`/buyer/purchase-orders/${r.id}`}>عرض أمر الشراء</Link>
              </td>
            </tr>
          ))}
        </DataTable>
      )}
    </>
  );
}
