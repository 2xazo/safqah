import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { auditLogs, users } from "@/db/schema";
import { DataTable, EmptyState, PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/rbac";
import { formatDateTime } from "@/lib/format";

export default async function AdminAuditLogPage() {
  await requireRole(["admin"]);
  const db = getDb();

  const rows = await db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      entityType: auditLogs.entityType,
      entityId: auditLogs.entityId,
      details: auditLogs.details,
      createdAt: auditLogs.createdAt,
      actorName: users.fullName,
      actorEmail: users.email,
    })
    .from(auditLogs)
    .leftJoin(users, eq(users.id, auditLogs.actorUserId))
    .orderBy(desc(auditLogs.createdAt))
    .limit(200);

  return (
    <>
      <PageHeader
        title="سجل العمليات"
        description="آخر 200 عملية موثّقة في النظام."
      />
      {rows.length === 0 ? (
        <EmptyState title="لا توجد عمليات مسجّلة بعد" />
      ) : (
        <DataTable
          headers={["الوقت", "المستخدم", "الإجراء", "الكيان", "التفاصيل"]}
        >
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{formatDateTime(r.createdAt)}</td>
              <td>
                {r.actorName || "نظام"}
                {r.actorEmail ? (
                  <div style={{ fontSize: 10, color: "var(--muted)" }}>
                    {r.actorEmail}
                  </div>
                ) : null}
              </td>
              <td>{r.action}</td>
              <td>
                {r.entityType}
                {r.entityId ? (
                  <div style={{ fontSize: 10, color: "var(--muted)" }}>
                    {r.entityId.slice(0, 8)}…
                  </div>
                ) : null}
              </td>
              <td>{r.details || "—"}</td>
            </tr>
          ))}
        </DataTable>
      )}
    </>
  );
}
