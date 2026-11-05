import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { deliveries, purchaseOrders } from "@/db/schema";
import { Badge, DataTable, EmptyState, PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/rbac";
import { formatDateTime } from "@/lib/format";
import { DELIVERY_STATUS, statusTone } from "@/lib/labels";

export default async function AdminDeliveriesPage() {
  await requireRole(["admin"]);
  const db = getDb();

  const rows = await db
    .select({
      id: deliveries.id,
      status: deliveries.status,
      scheduledAt: deliveries.scheduledAt,
      deliveredAt: deliveries.deliveredAt,
      carrierNotes: deliveries.carrierNotes,
      poCode: purchaseOrders.code,
    })
    .from(deliveries)
    .innerJoin(
      purchaseOrders,
      eq(purchaseOrders.id, deliveries.purchaseOrderId),
    )
    .orderBy(desc(deliveries.updatedAt));

  return (
    <>
      <PageHeader title="التوريدات" description="متابعة حالات التوصيل المرتبطة بأوامر الشراء." />
      {rows.length === 0 ? (
        <EmptyState title="لا توجد توريدات مسجّلة" />
      ) : (
        <DataTable
          headers={["أمر الشراء", "الحالة", "الجدولة", "التسليم", "ملاحظات"]}
        >
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.poCode}</td>
              <td>
                <Badge tone={statusTone(r.status)}>
                  {DELIVERY_STATUS[r.status] ?? r.status}
                </Badge>
              </td>
              <td>{formatDateTime(r.scheduledAt)}</td>
              <td>{formatDateTime(r.deliveredAt)}</td>
              <td>{r.carrierNotes || "—"}</td>
            </tr>
          ))}
        </DataTable>
      )}
    </>
  );
}
